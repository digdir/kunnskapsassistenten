import { HttpError, type AssistantApi } from '@genai/ui-assembly';
import { describe, expect, it, vi } from 'vitest';
import { withSignIn } from './api';

const failing = (status: number): AssistantApi => {
  const fail = async () => {
    throw new HttpError(status, `${status}`);
  };
  return {
    loadModels: fail,
    loadThreads: fail,
    loadThread: fail,
    loadCorpora: fail,
    loadFields: fail,
    loadFacets: fail,
    loadAbout: fail,
    ask: async function* () {
      yield* [];
      throw new HttpError(status, `${status}`);
    },
  };
};

describe('a call refused with 401', () => {
  it('goes to the sign-in when the session is gone', async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => true);
    await expect(api.loadThreads()).rejects.toThrow('401');
    expect(signIn).toHaveBeenCalledOnce();
  });

  it('also from a question', async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => true);
    const asking = api.ask({
      question: 'x',
      model: 'kunnskapsassistenten__default',
      steps: false,
      signal: new AbortController().signal,
    });
    await expect(asking.next()).rejects.toThrow('401');
    expect(signIn).toHaveBeenCalledOnce();
  });

  it("stays, with genki's refusal shown, while the session holds", async () => {
    const signIn = vi.fn();
    const api = withSignIn(failing(401), signIn, async () => false);
    await expect(api.loadModels()).rejects.toThrow('401');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('another failure never leads to the sign-in', async () => {
    const signIn = vi.fn();
    const gone = vi.fn(async () => true);
    await expect(withSignIn(failing(502), signIn, gone).loadCorpora()).rejects.toThrow('502');
    expect(gone).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});
