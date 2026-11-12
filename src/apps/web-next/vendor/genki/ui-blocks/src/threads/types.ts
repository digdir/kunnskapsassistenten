/** One conversation in the list, as the host maps it from the platform's `Conversation`. */
export interface ThreadItem {
  id: string;
  /** The platform's `topic`, or the name the person gave it. Empty is drawn as «Uten tittel». */
  title: string;
  /** When the thread last changed: ISO 8601, epoch milliseconds or a `Date`. Groups and dates the row. */
  updatedAt: string | number | Date;
  /** The dataset the thread was asked of. Pass it only when the list mixes several. */
  dataset?: string | undefined;
}
