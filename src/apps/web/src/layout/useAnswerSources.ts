import { use } from 'react';
import { AnswerSourcesContext, type AnswerSourcesContextValue } from './answerSourcesContext';

/**
 * The sources behind the answer on screen. See answerSourcesContext.ts for
 * why the shell holds them rather than either view.
 */
export function useAnswerSources(): AnswerSourcesContextValue {
  const value = use(AnswerSourcesContext);
  if (!value) {
    throw new Error('useAnswerSources må brukes inne i en LayoutProvider.');
  }
  return value;
}
