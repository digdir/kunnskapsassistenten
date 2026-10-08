import { Navigate, useParams } from 'react-router';

/**
 * Route `/chat/:threadId`, the previous client's address for a thread (same id).
 * `replace`, so Back does not land on the old address and come straight back.
 */
export function PreviousClientThread() {
  const { threadId = '' } = useParams();
  return <Navigate replace to={`/threads/${encodeURIComponent(threadId)}`} />;
}
