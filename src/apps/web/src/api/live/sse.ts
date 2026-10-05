/**
 * A server-sent events decoder.
 *
 * Kept separate from the MCP client because it is the part with the sharp
 * edges: a frame can be split across two network chunks, a comment line
 * (`: ping`, which this server sends every 15 seconds) is not data, and a
 * frame can carry several `data:` lines that belong together.
 */
export type SseMessage = {
  /** The `event:` field, when the frame has one. */
  event?: string;
  /** Every `data:` line in the frame, joined with newlines. */
  data: string;
};

export type SseDecoder = {
  /** Feeds a chunk of text and returns whatever frames it completed. */
  push: (text: string) => SseMessage[];
  /** Returns a trailing frame that never got its blank line. */
  flush: () => SseMessage[];
};

function parseFrame(raw: string): SseMessage | undefined {
  const data: string[] = [];
  let event: string | undefined;

  for (const line of raw.split('\n')) {
    // A line starting with a colon is a comment. The server uses those as
    // keep-alives through intermediate proxies.
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');

    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
  }

  if (data.length === 0 && event === undefined) return undefined;
  return { event, data: data.join('\n') };
}

export function createSseDecoder(): SseDecoder {
  let buffer = '';

  return {
    push(text: string) {
      buffer += text.replace(/\r\n/g, '\n');
      const frames: SseMessage[] = [];

      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const frame = parseFrame(buffer.slice(0, split));
        if (frame) frames.push(frame);
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf('\n\n');
      }

      return frames;
    },

    flush() {
      const rest = buffer.trim();
      buffer = '';
      if (!rest) return [];
      const frame = parseFrame(rest);
      return frame ? [frame] : [];
    },
  };
}
