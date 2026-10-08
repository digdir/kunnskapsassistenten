import type { Context } from 'hono';
import type { AskRequest, TurnEvent } from '@ka/contract';
import type { Env } from './apiShared.ts';
import { config } from './config.ts';
import * as convos from './conversations.ts';
import { resolveAskFilter, toFilterBy } from './facets.ts';
import { ask } from './mcp.ts';
import * as sourceStore from './sourceStore.ts';
import * as threadFilters from './threadFilters.ts';

/** How a version gives the turn's events to its client. */
export type Present<E> = (events: AsyncIterable<TurnEvent>) => AsyncIterable<E>;

/**
 * `POST …/ask` for one API version: the same question to headless-rag, the
 * same checks and the same memory of sources and filters, with the events in
 * the version's own format (`present`). The memory reads the events before
 * they are presented, so both versions remember the same thing.
 */
export function askRoute<E>(present: Present<E>) {
  return async (c: Context<Env>) => {
    let body: AskRequest;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Ugyldig JSON.' }, 400);
    }

    const query = (body.query ?? '').trim();
    if (!query) return c.json({ error: 'Spørsmålet kan ikke være tomt.' }, 400);
    if (query.length > config.maxQueryLength) {
      return c.json(
        { error: `Spørsmålet er for langt (maks ${config.maxQueryLength} tegn).` },
        400,
      );
    }

    // From the cache, unless the cache is cold and only the facets can tell
    // «all» from too many (`resolveAskFilter`).
    const asked = await resolveAskFilter((body as { filter?: unknown }).filter);
    if (!asked.ok) return c.json(asked.body, 400);
    const requested = asked.filter;
    const model =
      typeof (body as { model?: unknown }).model === 'string'
        ? (body as { model: string }).model
        : undefined;
    const userId = c.get('userId');
    let conversationId =
      typeof body.conversationId === 'string' ? body.conversationId : undefined;

    // Discarded on purpose: detail() is the ownership check.
    if (conversationId) {
      try {
        await convos.detail(userId, conversationId);
      } catch {
        return c.json({ error: 'Fant ikke samtalen.' }, 404);
      }
    }

    let created: { id: string; topic: string } | null = null;
    if (!conversationId) {
      try {
        const conv = await convos.create(userId, convos.topicFrom(query));
        conversationId = conv.id;
        created = { id: conv.id, topic: conv.topic };
        // Now, not after the answer: the client reads the thread when
        // `conversation` arrives, and locks the filter from what it reads.
        threadFilters.remember(conv.id, requested);
      } catch {
        return c.json({ error: 'Kunne ikke opprette samtale.' }, 502);
      }
    }

    const filterBy = toFilterBy(threadFilters.recall(conversationId) ?? requested);
    const notes = [
      sourceStore.answerSources(conversationId),
      ...(created ? [threadFilters.forgetIfFailed(created.id)] : []),
    ];

    // Accumulating, compressing or dropping X-Accel-Buffering re-buffers the stream.
    const encoder = new TextEncoder();
    const upstreamAbort = new AbortController();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          if (created) send({ type: 'conversation', ...created });
          const events = ask(
            query,
            userId,
            conversationId,
            upstreamAbort.signal,
            model,
            filterBy,
          );
          for await (const event of present(noted(events, notes))) send(event);
        } catch (err) {
          const message =
            err instanceof Error && err.name === 'AbortError'
              ? 'Avbrutt.'
              : 'Uventet feil mot backend.';
          if (!(err instanceof Error && err.name === 'AbortError')) console.error(err);
          send({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
      cancel() {
        upstreamAbort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  };
}

async function* noted(
  events: AsyncIterable<TurnEvent>,
  notes: Array<(event: TurnEvent) => void>,
): AsyncGenerator<TurnEvent> {
  for await (const event of events) {
    for (const note of notes) note(event);
    yield event;
  }
}
