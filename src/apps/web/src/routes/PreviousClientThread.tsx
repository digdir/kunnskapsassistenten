import { Navigate, useParams } from 'react-router';

/**
 * Route `/chat/:threadId`, the address the previous client shares a thread
 * under. Its id is the same conversation id, so the thread opens under
 * `/threads/:threadId`.
 *
 * `replace`, so Back does not land on the old address and come straight back.
 */
export function PreviousClientThread() {
  const { threadId = '' } = useParams();
  return <Navigate replace to={`/threads/${encodeURIComponent(threadId)}`} />;
}
