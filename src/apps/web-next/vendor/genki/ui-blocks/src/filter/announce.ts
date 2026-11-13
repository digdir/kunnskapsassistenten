import { createContext, useContext } from 'react';

/** The filter's live region, for a block in its head, so what happens is read in order. */
export const AnnounceContext = createContext<((text: string) => void) | undefined>(undefined);

export const useFilterAnnouncer = () => useContext(AnnounceContext);

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/** Text for a live region, made new with a no-break space when it repeats. */
export const freshText = (previous: string, text: string) =>
  previous === text ? `${text}${NO_BREAK_SPACE}` : text;
