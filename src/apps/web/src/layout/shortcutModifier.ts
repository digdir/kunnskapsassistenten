/**
 * The modifier key to NAME for the compose-field shortcut, on this machine.
 *
 * Both work everywhere — the handler takes `ctrlKey` or `metaKey` — so this
 * is about which word to say, not which key to accept.
 *
 * `userAgentData` is not in Safari or Firefox, and the user agent string is
 * what is left. It only chooses a word, so a wrong guess costs a reader one
 * confusing label and nothing else.
 *
 * Lives here, in the shell, because the skip link is the shell's own chrome
 * and the shell does not import a view to build it — the same rule that put
 * `COMPOSER_ID` in ids.ts. `shortcutHint()` in src/views/chat/text.ts holds a
 * second copy of this test; it should read this one when #3 next touches that
 * file (H3 in design/hoydebudsjett-forslag-2026-09-21.md takes the hint out
 * of the footer, so it may go away instead).
 */
export function shortcutModifier(): 'Ctrl' | 'Cmd' {
  return /Mac|iPhone|iPad/u.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';
}
