// DOM helpers the blocks share, the same file in every block's branch so they merge cleanly.

/** Class names joined, the empty ones left out. */
export const classes = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');

/** A main-button click with no modifier, the host's to handle; any other is the browser's. */
export const plainClick = (event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Whether what is dragged holds files, not text or a link. */
export const hasFiles = (event: { dataTransfer: DataTransfer | null }) =>
  [...(event.dataTransfer?.types ?? [])].includes('Files');
