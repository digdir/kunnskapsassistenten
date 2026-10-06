/**
 * The Norwegian strings the chat view owns.
 *
 * Taken verbatim from the curated Figma section «Hva skjer når du åpner
 * Kunnskapsassistenten?» and from the `chatInput` and `kickstarters`
 * molecules, so the wording is the designer's. Collected here rather than
 * spread through the components: every user-visible string in one file is
 * what makes a language review possible (open question 60).
 */

/** Under the compose field, in all four chatInput variants. */
export const DISCLAIMER = 'Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.';

/** Placeholder in the compose field. */
export const COMPOSE_PLACEHOLDER = 'Hva vil du vite mer om?';

/** Fixed for now; a follow-up generated from the answer is wanted later (answer 18). */
export const CLOSING_QUESTION = 'Er det noe mer jeg kan hjelpe deg med?';

/**
 * Three suggestions on the empty state. They fill the compose field, they do
 * not send (answer 40).
 *
 * These three name documents: annual reports from DSS, an Udir evaluation,
 * letters of allocation from Digdir. They belong to the mock corpus, which
 * holds those 938 Kudos documents and can answer them.
 *
 * They were shown over every corpus until today — including 351 Wikipedia
 * articles, which can answer none of them. That is not a claim that reads
 * oddly, it is an invitation to ask three questions the corpus cannot answer
 * (brukerblikk 5, funn 2). See `kickstartersFor`.
 */
export const KICKSTARTERS = [
  'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  'Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?',
  'Hva rapporterer Digdir om prioriteringene i tildelingsbrevene fra 2022 og 2023 sammenlignet med årsrapportene?',
] as const;

/**
 * The three for a corpus nobody has written suggestions for.
 *
 * Deliberately about the documents rather than about anything in them: these
 * have to hold over a corpus this code has never seen, so every one of them
 * asks what is there rather than assuming what is. A suggestion that named a
 * subject would be the same mistake again, one corpus further along.
 *
 * Whole questions, and not «Hvilke dokumenter finnes om …?» with the subject
 * left for the reader. A kickstarter fills the field and leaves the caret
 * there, so an unfinished one would work — but it reads as a broken label on
 * the button before it is picked, and the button is the thing the reader
 * judges first.
 */
export const GENERAL_KICKSTARTERS = [
  'Hva handler dokumentene i dette korpuset om?',
  'Gi meg en oversikt over de viktigste temaene.',
  'Oppsummer det viktigste i noen få punkter.',
] as const;

/**
 * The one corpus the three named questions belong to.
 *
 * The key is written out rather than imported from src/api/corpus.ts, so this
 * module of words stays a module of words. `kickstartersPerCorpus.test.ts`
 * ties the two together, so renaming it there turns that test red instead of
 * quietly dropping mock down to the general three.
 *
 * `kudos-pilot` is NOT here, and that is measured rather than assumed. The
 * name says Kudos and the mock corpus is Kudos, so the two looked like one
 * case — but the pilot is five annual reports from 2025, from other agencies
 * than the ones these questions name. Asked over it, «DSS sine årsrapporter»
 * came back as «finner ikke DSS» with no sources at all, while the general
 * three got real answers with sources (KA CC, målt live på #111). A corpus
 * gets its own list when someone has written one against the documents that
 * are actually in it.
 */
const CORPUS_WITH_OWN_KICKSTARTERS = 'mock';

/**
 * The three suggestions to offer over `corpusKey`.
 *
 * Everything else gets the general three, which is the safe direction to be
 * wrong in: a general question over Kudos still works, and a named question
 * over a corpus that does not hold those documents does not.
 */
export function kickstartersFor(corpusKey: string | undefined): readonly string[] {
  return corpusKey === CORPUS_WITH_OWN_KICKSTARTERS ? KICKSTARTERS : GENERAL_KICKSTARTERS;
}

/**
 * Fixed in the first version, model generated in the second (answer 29).
 *
 * The language is not consistent — one question and two imperatives — but it
 * is the designer's wording, so it stays until someone decides otherwise.
 */
export const FOLLOW_UP_QUESTIONS = [
  'Kan du utdype?',
  'Identifiser utfordringer',
  'Lag relaterte spørsmål',
] as const;

/*
 * A stopped answer (reise 9 in design/brukerreiser-2026-09-15.md). The
 * sources arrive in the last frame of the stream, so an answer that was
 * stopped has none — and the `[n]` markers left in the text point nowhere.
 * Saying that is what keeps them from reading as a bug.
 */

/** Under the text of an answer the reader stopped. */
export const ABORTED_NOTE = 'Svaret ble avbrutt, så kildene bak det kom aldri fram.';

/**
 * The same, for a turn stopped while it was still searching.
 *
 * There is no answer to say anything about — «svaret ble avbrutt» would be
 * about text that never existed — so it names what there was: a search, and a
 * reader who stopped it (#4, funn A).
 */
export const ABORTED_BEFORE_ANSWER = 'Du stoppet søket før svaret begynte.';

/**
 * Under a turn that failed, once the alert about it is gone.
 *
 * The live failure has the alert below it, which says what went wrong and
 * offers the way on; a turn that carries this one has outlived that alert —
 * it was restored from the store, or the reader has asked something since.
 * Then the card is the only thing left to say why there is no answer under
 * the question, and «Tenkte i 4 sekunder» over nothing is a riddle without
 * it.
 *
 * It says less than the alert did on purpose. Which error it was is not
 * written down with the turn, and a note that guessed would be worse than one
 * that only says the turn did not finish.
 */
export const FAILED_NOTE = 'Dette spørsmålet fikk ikke noe svar. Noe gikk galt underveis.';

/** The only action on a stopped answer: ask the same question again. */
export const REGENERATE = 'Generer på nytt';

/*
 * The agent asking for more before it answers: backend status
 * `needs-clarification` (design/eksisterende/api-for-frontend.md l.208).
 *
 * The wording is the conductor's, from the brief. It frames the card as a
 * question to the reader rather than as a failed answer, which is what it is:
 * nothing went wrong, the assistant just needs one more thing.
 */

/** The `Tag` at the top of the clarification card. */
export const CLARIFICATION_TAG = 'Trenger avklaring';

/** Replaces COMPOSE_PLACEHOLDER while a clarification is the last message. */
export const CLARIFICATION_PLACEHOLDER = 'Svar på spørsmålet over …';

/** What the polite live region says when the clarification arrives. */
export const CLARIFICATION_ANNOUNCEMENT = 'Kunnskapsassistenten trenger en avklaring.';

/**
 * What the polite region says while the conversation at the address is being
 * read.
 *
 * Said through the region the view already keeps in the page, and not by an
 * element of its own. A live region that arrives WITH its text is a region a
 * screen reader has no update to announce — it was inserted, not changed —
 * and the one here is mounted, empty, from the first render (KA CC on #156).
 */
export const READING_THREAD = 'Henter samtalen';

/**
 * The page title before anything is asked: the conversation is the one «Ny
 * tråd» starts, and the thread list calls it that too.
 */
export const NEW_THREAD_TITLE = 'Ny tråd';

/*
 * The keyboard shortcut to the compose field (reise 7 and 15). The field is
 * tab stop 22 of 38 on a thread page, for the thing a reader does most often.
 *
 * Ctrl and not the bare key: a single character key shortcut is WCAG 2.1.4,
 * level A, and this one could not be switched off. See useComposerShortcut.ts.
 */

/**
 * A small hint by the field, for anyone looking at the screen.
 *
 * It names the modifier the reader's own keyboard has. Both work everywhere —
 * the handler takes `ctrlKey` or `metaKey` — so this is about which one to
 * say, not which one to accept, and «Ctrl + / (Cmd + / på Mac)» is a lot of
 * parenthesis for a line that shares its row with the disclaimer.
 *
 * A function and not a constant, because the answer depends on the machine
 * and a module constant would be read before a test could say otherwise.
 */
export function shortcutHint(): string {
  // `userAgentData` is not in Safari or Firefox, and the user agent string is
  // what is left. It is only choosing a word, so a wrong guess costs a reader
  // one confusing label and nothing else.
  const apple = /Mac|iPhone|iPad/u.test(navigator.userAgent);
  return `Trykk ${apple ? 'Cmd' : 'Ctrl'} + / for å hoppe hit`;
}

/**
 * The same thing for a screen reader, on the field itself.
 *
 * The key is spelled out rather than shown as the character: «/» read aloud is
 * «skråstrek» in some voices and silence in others, and a shortcut nobody can
 * hear the name of is not a shortcut. Both modifiers are named here, where
 * there is room for it.
 */
export const SHORTCUT_DESCRIPTION =
  'Trykk Ctrl og skråstrek, eller Cmd og skråstrek, for å flytte skrivemerket hit fra hvor som helst på siden.';

/*
 * A search that found nothing (design/brukerreiser-2026-09-15.md, punkt 12).
 *
 * Not an error and not in red: the assistant did what it was asked, looked
 * through the documents and came back empty-handed. That is an answer with an
 * empty source list, and API-bestilling A16 asks the backend to treat it as
 * one too. So it is drawn as an answer — a turn in the thread, with the
 * sources panel saying the same thing in its own words — rather than as an
 * alert with «Prøv igjen» under it. Asking the same question again against
 * the same documents gives the same nothing.
 *
 * Two versions, because the advice differs and only one of them is honest at
 * a time: a reader who has not touched the filter cannot loosen it, and being
 * told to is one more thing to go looking for.
 */

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

/**
 * The agent choice in the compose field. The prefix is in the button's name
 * and not on it: the agent's name is enough to see, and «agent-rag» on its own
 * says nothing to a screen reader about what the button changes.
 */
export const AGENT_PREFIX = 'Agent: ';
/** On the button when the BFF has not said which agent is its default. */
export const AGENT_DEFAULT_LABEL = 'Standard';
/** Over the list of agents. */
export const AGENT_HEADING = 'Velg agent';
