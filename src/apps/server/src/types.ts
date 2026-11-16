/** The shapes this server passes between sign-in, its routes and genki. */

/** The signed-in person, as Entra ID or Ansattporten names them. */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** An organisation a person may act for, from Ansattporten or genki. */
export interface Organisation {
  orgNumber: string;
  name: string;
}

/** `POST /api/next/feedback`: a rating of one answer, by its run. */
export interface FeedbackRequest {
  conversationId: string;
  taskId: string;
  rating: 'up' | 'down';
  /** The reasons picked with the rating. */
  reasons?: string[];
  comment?: string;
}

/** `unavailable` when the backend has run ids but takes no feedback. */
export interface FeedbackResponse {
  ok: boolean;
  unavailable?: boolean;
}
