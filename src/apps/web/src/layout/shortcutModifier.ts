/**
 * The modifier key to NAME for the compose-field shortcut; the handler accepts both. Guessed from
 * the user agent, since `userAgentData` is missing in Safari and Firefox, and a wrong guess only
 * costs a label.
 */
export function shortcutModifier(): 'Ctrl' | 'Cmd' {
  return /Mac|iPhone|iPad/u.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';
}
