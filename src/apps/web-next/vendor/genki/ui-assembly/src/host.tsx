// What a host that tries the assistant on real threads keeps beside `<Assistant>`: a notice the
// reader sees and hears for a while, the colour scheme kept in the browser and followed across
// tabs, and feedback, rename and delete that are only logged and said, never sent. The UI blocks
// preview and the app builder's «Prøv assistenten» are such hosts. Nothing here calls the API.
import { Alert } from '@digdir/designsystemet-react';
import type { ColorScheme } from '@genai/ui-blocks';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThreadRow } from './api.js';
import { useT } from './i18n.js';
import type { AssistantFeedback } from './useAssistant.js';

/** How long a notice stays on screen, in milliseconds. */
export const noticeTime = 7000;

/**
 * `say(text)` and the region that shows it for `noticeTime`, as a polite live region. Draw the
 * region once, beside the assistant, and give `say` to its `onNotice`.
 */
export const useNotice = () => {
  const [notice, setNotice] = useState<{ id: number; text: string }>();
  const next = useRef(0);
  const say = useCallback((text: string) => setNotice({ id: (next.current += 1), text }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), noticeTime);
    return () => clearTimeout(timer);
  }, [notice]);
  const view: ReactNode = (
    <div className="uia-notice" role="status">
      {notice ? (
        <Alert key={notice.id} data-color="info" data-size="sm">
          {notice.text}
        </Alert>
      ) : null}
    </div>
  );
  return [say, view] as const;
};

const schemeOf = (value: unknown): ColorScheme =>
  value === 'light' || value === 'dark' ? value : 'auto';

/**
 * The reader's colour scheme, on `<html data-color-scheme>` and in localStorage under `key`, and
 * followed when another tab changes it, as kunnskapsassistenten's colorScheme.ts does. It starts
 * from the scheme the page already has, which a script in its head sets before the first paint.
 */
export const useStoredColorScheme = (key: string) => {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    schemeOf(document.documentElement.dataset.colorScheme),
  );
  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
    try {
      localStorage.setItem(key, scheme);
    } catch {
      // A private window: the choice lasts for the page.
    }
  }, [key, scheme]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setScheme(schemeOf(event.newValue));
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [key]);
  return [scheme, setScheme] as const;
};

/** Where a log-only host writes what it did not send. */
export type LogOnly = (what: 'feedback' | 'rename' | 'delete', detail: unknown) => void;

/** How long feedback shows «Sender …», as a real request would. */
const feedbackTime = 400;

/**
 * `onFeedback`, `onRename` and `onDelete` for `<Assistant>` that only log and say what they would
 * have done, for a host that must never change a real thread. A rename and a delete last until a
 * reload. `say` and `log` should be stable: a `useNotice` and a module's function.
 */
export const useLogOnly = (say: (text: string) => void, log: LogOnly) => {
  const t = useT();
  return useMemo(
    () => ({
      onFeedback: (feedback: AssistantFeedback) => {
        log('feedback', feedback);
        const rating = t(feedback.rating === 'up' ? 'assembly.ratingUp' : 'assembly.ratingDown');
        say(
          feedback.reasons.length > 0
            ? t('assembly.logOnlyFeedbackReasons', { rating, reasons: feedback.reasons.join(', ') })
            : t('assembly.logOnlyFeedback', { rating }),
        );
        return new Promise<void>((done) => setTimeout(done, feedbackTime));
      },
      onRename: (thread: ThreadRow, title: string) => {
        log('rename', { id: thread.id, title });
        say(t('assembly.logOnlyRename', { title }));
        return Promise.resolve();
      },
      onDelete: (thread: ThreadRow) => {
        log('delete', { id: thread.id });
        say(t('assembly.logOnlyDelete', { title: thread.title || t('threads.untitled') }));
        return Promise.resolve();
      },
    }),
    [say, log, t],
  );
};
