/* The Norwegian strings the chat view owns. The wording is the designer's,
  taken verbatim from Figma, so it is not reworded here, and it is collected
  in one file so a language review is possible at all. */

import { shortcutModifier } from '../../layout/shortcutModifier';

/** Under the compose field, in all four chatInput variants. */
export const DISCLAIMER = 'Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.';

/** Placeholder in the compose field. */
export const COMPOSE_PLACEHOLDER = 'Hva vil du vite mer om?';

/** Fixed; a follow-up generated from the answer is wanted later. */
export const CLOSING_QUESTION = 'Er det noe mer jeg kan hjelpe deg med?';

/** Three suggestions on the empty state; they fill the field and do not
    send. All three name documents only the mock corpus holds, so elsewhere
    they invite questions it cannot answer. See `kickstartersFor`. */
export const KICKSTARTERS = [
  'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  'Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?',
  'Hva rapporterer Digdir om prioriteringene i tildelingsbrevene fra 2022 og 2023 sammenlignet med årsrapportene?',
] as const;

/** The three for a corpus nobody has written suggestions for: about the
    documents and not anything in them, since they must hold over a corpus
    this code has never seen. Whole questions, or the button reads broken. */
export const GENERAL_KICKSTARTERS = [
  'Hva handler dokumentene i dette korpuset om?',
  'Gi meg en oversikt over de viktigste temaene.',
  'Oppsummer det viktigste i noen få punkter.',
] as const;

// Written out and not imported, so this module of words stays one;
// `kickstartersPerCorpus.test.ts` ties them. `kudos-pilot` is deliberately
// NOT here: Kudos by name, but other agencies' reports.
const CORPUS_WITH_OWN_KICKSTARTERS = 'mock';

/** The three suggestions to offer over `corpusKey`. Everything else gets the
    general three, which is the safe direction to be wrong in. */
export function kickstartersFor(corpusKey: string | undefined): readonly string[] {
  return corpusKey === CORPUS_WITH_OWN_KICKSTARTERS ? KICKSTARTERS : GENERAL_KICKSTARTERS;
}

/** Fixed for now, model generated later. The language is not consistent, but
    it is the designer's wording, so it stays. */
export const FOLLOW_UP_QUESTIONS = [
  'Kan du utdype?',
  'Identifiser utfordringer',
  'Lag relaterte spørsmål',
] as const;

/* A stopped answer. The sources arrive in the last frame of the stream, so a
  stopped answer has none, and the `[n]` markers left in the text point
  nowhere. Saying so keeps them from reading as a bug. */

/** Under the text of an answer the reader stopped. */
export const ABORTED_NOTE = 'Svaret ble avbrutt, så kildene bak det kom aldri fram.';

/** The same, for a turn stopped while it was still searching: there is no
    answer to say anything about, so it names what there was. */
export const ABORTED_BEFORE_ANSWER = 'Du stoppet søket før svaret begynte.';

/** Under a turn that failed, once its alert is gone. It says less than the
    alert on purpose: which error it was is not written down with the turn,
    and a note that guessed would be worse. */
export const FAILED_NOTE = 'Dette spørsmålet fikk ikke noe svar. Noe gikk galt underveis.';

/** The only action on a stopped answer: ask the same question again. */
export const REGENERATE = 'Generer på nytt';

// Backend status `needs-clarification`
// (design/eksisterende/api-for-frontend.md l.208). The wording frames the
// card as a question and not a failure, because nothing went wrong.

/** The `Tag` at the top of the clarification card. */
export const CLARIFICATION_TAG = 'Trenger avklaring';

/** Replaces COMPOSE_PLACEHOLDER while a clarification is the last message. */
export const CLARIFICATION_PLACEHOLDER = 'Svar på spørsmålet over …';

/** What the polite live region says when the clarification arrives. */
export const CLARIFICATION_ANNOUNCEMENT = 'Kunnskapsassistenten trenger en avklaring.';

/** What the polite region says while the conversation is read. Through the
    region the view already keeps in the page: one arriving WITH its text was
    inserted, not changed, and announces nothing. */
export const READING_THREAD = 'Henter samtalen';

/** The page title before anything is asked: the conversation is the one «Ny
   tråd» starts, and the thread list calls it that too. */
export const NEW_THREAD_TITLE = 'Ny tråd';

// The shortcut to the compose field, which is deep in the tab order. Ctrl
// and not the bare key: a single character key shortcut is WCAG 2.1.4, level
// A, and this one could not be switched off. See useComposerShortcut.ts.

/** A small hint by the field, naming the modifier the shell's skip link
    names: the two say the same key out loud, so the test for which one this
    machine has lives in one place. A function, because a constant is read
    before a test can say otherwise. */
export function shortcutHint(): string {
  return `Trykk ${shortcutModifier()} + / for å hoppe hit`;
}

/** The same for a screen reader. The key is spelled out and not shown as the
    character: «/» is «skråstrek» in some voices and silence in others. */
export const SHORTCUT_DESCRIPTION =
  'Trykk Ctrl og skråstrek, eller Cmd og skråstrek, for å flytte skrivemerket hit fra hvor som helst på siden.';

// Not an error but an answer with an empty source list (API-bestilling A16),
// so it is drawn as an answer. Two versions, because only one is honest at a
// time: a reader who has not touched the filter cannot loosen it.

/** The reader had narrowed the corpus, so the filter is the first thing to try. */
export const NO_HITS_FILTERED = [
  'Fant ingen utdrag om dette i dokumentene som er valgt.',
  '',
  'Prøv å løsne filteret, eller still spørsmålet med andre ord.',
].join('\n');

/** Nothing was filtered away, so the words in the question are all there is to change. */
export const NO_HITS_WHOLE_CORPUS = [
  'Fant ingen utdrag om dette i dokumentene.',
  '',
  'Prøv å stille spørsmålet med andre ord, gjerne med ord du venter å finne i dokumentene.',
].join('\n');

/** What the polite live region says when the search came back empty. */
export const NO_HITS_ANNOUNCEMENT = 'Fant ingen utdrag om dette i dokumentene.';

/** The agent choice in the compose field. The prefix is in the button's name
   and not on it: the agent's name is enough to see, and «agent-rag» on its own
   says nothing to a screen reader about what the button changes. */
export const AGENT_PREFIX = 'Agent: ';
/** On the button when the BFF has not said which agent is its default. */
export const AGENT_DEFAULT_LABEL = 'Standard';
/** Over the list of agents. */
export const AGENT_HEADING = 'Velg agent';

/** Over a finished answer with no sources behind it. Without it, an answer
   with no sources looks exactly like one with them, and only the sources
   panel says otherwise. */
export const NO_SOURCES_WARNING =
  'Svaret har ingen kilder. Kontroller det mot originaldokumentene før du bruker det.';
