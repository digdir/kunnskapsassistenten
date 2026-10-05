import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatErrorText } from '../views/chat/errorText';
import { errorFromBackend } from './backendErrors';

/*
 * The texts are the backend's own, copied from digdir-headless-rag: the agent
 * loop's `summarize-llm-exception` (skills/builtin/agent/loop.clj), the stream
 * watchdog in llm/openai.cljc, the key and dataset checks in mcp/tools.clj,
 * and the BFF's own sentences in apps/server/src/mcp.ts and server.ts.
 */
const STREAM_STALL =
  'LLM request failed at iteration 2: LLM streaming: no event received for 30000ms. ' +
  'The provider stream stalled, or ended without a [DONE] terminator. ' +
  'Raise LLM_STREAM_IDLE_TIMEOUT_MS if a healthy stream legitimately pauses this long.';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorFromBackend', () => {
  it.each([
    ['en strøm som stoppet opp', STREAM_STALL, 'model-unavailable'],
    [
      'en strøm som stoppet opp, uten agent-løkkas forstavelse',
      STREAM_STALL.replace('LLM request failed at iteration 2: ', ''),
      'model-unavailable',
    ],
    [
      'en 400 fra modellen',
      'LLM request failed at iteration 0 (status 400): clj-http: status 400',
      'model-unavailable',
    ],
    ['en brutt TLS-økt', 'LLM request failed at iteration 0: Tag mismatch', 'model-unavailable'],
    // Modellens 401 og 403 gjelder backendens nøkkel mot modellen, ikke leserens
    // tilgang (docs/onboarding.md i headless-rag).
    [
      'en 401 fra modellen',
      'LLM request failed at iteration 0 (status 401): Interceptor Exception: status: 401',
      'model-unavailable',
    ],
    [
      'en 403 fra modellen',
      'LLM request failed at iteration 0 (status 403): Interceptor Exception: status: 403',
      'model-unavailable',
    ],
    [
      'en manglende hemmelighet',
      'LLM request failed at iteration 0: Missing secret :openai-api-key: set OPENAI_API_KEY. Tried [:env].',
      'model-unavailable',
    ],
    [
      'for mange kall mot modellen',
      'LLM request failed at iteration 1 (status 429): clj-http: status 429',
      'rate-limited',
    ],
    [
      'et modellkall som gikk ut på tid',
      'LLM request failed at iteration 3: request timed out',
      'timeout',
    ],
    ['Azure som gikk ut på tid', 'Azure OpenAI request timed out', 'timeout'],
    [
      'en nøkkel uten tilgang til datasettet',
      'API key is not allowed to access the requested dataset: kudos/kudos-full',
      'unauthorized',
    ],
    ['BFF-ens 504 fra backend', 'Backend svarte 504.', 'timeout'],
    ['en tekst ingen kjenner', 'Agent not found: ka-agent', 'unknown'],
  ])('gir riktig kode for %s', (_case, text, code) => {
    expect(errorFromBackend(text).code).toBe(code);
  });

  it('viser aldri backendens egen tekst', () => {
    // Uten oversettingen sto akkurat denne teksten som svar i chatten.
    const error = errorFromBackend(STREAM_STALL);

    expect(error).toEqual({ code: 'model-unavailable' });
    expect(error.message).toBeUndefined();
  });

  it('legger backendens tekst i konsollen, så den kan feilsøkes', () => {
    errorFromBackend(STREAM_STALL);

    expect(console.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(console.warn).mock.calls[0]).toContainEqual(
      expect.objectContaining({ text: STREAM_STALL }),
    );
  });

  it('gir unknown uten melding for en tekst den ikke kjenner', () => {
    expect(errorFromBackend('Something new went wrong.')).toEqual({ code: 'unknown' });
  });

  it('tar en kode foran teksten', () => {
    // Koden sier backenden med vilje; teksten er skrevet for den som drifter.
    expect(errorFromBackend(STREAM_STALL, 'retrieval-unavailable')).toEqual({
      code: 'retrieval-unavailable',
    });
  });

  it('leser backendens egne koder', () => {
    // Uten tekst, så det er koden alene som avgjør.
    expect(errorFromBackend(undefined, 'agent_not_authorized')).toEqual({ code: 'unauthorized' });
    expect(errorFromBackend('No dataset scope available.', 'no_dataset_scope')).toEqual({
      code: 'unknown',
    });
  });

  /*
   * headless-rag main 1c65865 (#15), measured 5.10 against :8093: the
   * backend refuses the reader's filter before the tool runs.
   */
  it('gjør backendens avviste filter til filter-refused, med hva som må endres', () => {
    expect(
      errorFromBackend(
        'Invalid `retrieve-filter-by`: A filter field takes at most 100 options.',
        'invalid_overrides',
      ),
    ).toEqual({
      code: 'filter-refused',
      message: 'Filteret har mer enn 100 verdier valgt i ett felt. Velg høyst 100, eller alle.',
    });
    expect(
      errorFromBackend(
        'Invalid `retrieve-filter-by`: Filter options cannot contain a backtick, a backslash or a control character.',
        'invalid_overrides',
      ),
    ).toEqual({
      code: 'filter-refused',
      message:
        'Et av valgene i filteret har tegn eller en lengde søket ikke tar imot. Fjern det valget.',
    });
  });

  it('gir filter-refused med den generelle setningen for en annen avvisning', () => {
    expect(
      errorFromBackend(
        'Invalid `retrieve-filter-by`: A filter takes at most 20 fields.',
        'invalid_overrides',
      ),
    ).toEqual({ code: 'filter-refused' });
  });

  it('tilbyr ikke å sende det samme filteret igjen', () => {
    const text = chatErrorText(errorFromBackend('Invalid', 'invalid_overrides'));
    expect(text.retryable).toBe(false);
  });

  it('lar ikke en kode som heter som en egenskap på Object slå til', () => {
    expect(errorFromBackend('x', 'toString')).toEqual({ code: 'unknown' });
  });

  it('oversetter BFF-ens setning om for lange spørsmål til sin egen', () => {
    expect(errorFromBackend('Spørsmålet er for langt (maks 2000 tegn).')).toEqual({
      code: 'question-too-long',
      message: 'Spørsmålet er lengre enn de 2000 tegnene tjenesten tar imot.',
    });
  });

  it('ber leseren korte ned et for langt spørsmål, uten å tilby samme spørsmål igjen', () => {
    // Det leseren ser: grensen fra BFF-en, så rådet fra koden. «Prøv igjen»
    // ville sendt det samme spørsmålet og fått samme nei.
    const shown = chatErrorText(errorFromBackend('Spørsmålet er for langt (maks 2000 tegn).'));

    expect(shown).toEqual({
      title: 'Spørsmålet er for langt',
      message:
        'Spørsmålet er lengre enn de 2000 tegnene tjenesten tar imot. ' +
        'Kort det ned, for eksempel ved å dele det i to spørsmål, og send det på nytt.',
      retryable: false,
    });
  });

  it('tar BFF-ens 413 som et for langt spørsmål', () => {
    // Grensen på 64 kB slår til før lengdesjekken, så det er ikke noe tall å vise.
    expect(errorFromBackend('Forespørselen er for stor.')).toEqual({ code: 'question-too-long' });
  });

  it('sier at tråden er borte når BFF-en ikke fant samtalen', () => {
    expect(errorFromBackend('Fant ikke samtalen.')).toEqual({ code: 'thread-not-found' });
  });

  it('ber leseren starte en ny tråd, uten å tilby samme spørsmål i samme tråd igjen', () => {
    // «Prøv igjen» ville sendt spørsmålet til den samme samtalen og fått 404 igjen.
    expect(chatErrorText(errorFromBackend('Fant ikke samtalen.'))).toEqual({
      title: 'Tråden er borte',
      message:
        'Tråden finnes ikke lenger, kanskje fordi den er slettet et annet sted. ' +
        'Start en ny tråd med «Ny tråd» i trådlista, og still spørsmålet der.',
      retryable: false,
    });
  });

  it('sier det samme som klienten selv når BFF-en mistet forbindelsen', () => {
    expect(errorFromBackend('Forbindelsen til backend ble brutt.')).toEqual({
      code: 'unknown',
      message: 'Forbindelsen brøt sammen mens svaret kom.',
    });
  });

  it('beholder statusen når BFF-en bare sa hva backend svarte', () => {
    expect(errorFromBackend('Backend svarte 502.')).toEqual({
      code: 'unknown',
      message: 'Kunnskapsassistenten svarte med feil (502).',
    });
  });

  it('logger ingenting når det ikke kom noen tekst', () => {
    expect(errorFromBackend(undefined)).toEqual({ code: 'unknown' });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
