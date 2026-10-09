import { Route, Routes } from 'react-router';
import { LayoutProvider } from './layout/LayoutProvider';
import { Shell } from './layout/Shell';
import { infoPageElement, infoPages } from './routes/info/infoPages';
import { NewConversation } from './routes/NewConversation';
import { NotFound } from './routes/NotFound';
import { PreviousClientThread } from './routes/PreviousClientThread';
import { Thread } from './routes/Thread';

/**
 * Two layout routes: on conversation routes the slot's view draws the main column, every other
 * page draws its own (`routeOwnsMain`). Layout state lives in `LayoutProvider`, above the shell,
 * so remounting the shell between them loses nothing.
 */
export function App() {
  return (
    <LayoutProvider>
      <Routes>
        <Route path="chat/:threadId" element={<PreviousClientThread />} />
        <Route element={<Shell />}>
          <Route index element={<NewConversation />} />
          <Route path="threads/:threadId" element={<Thread />} />
        </Route>
        <Route element={<Shell routeOwnsMain />}>
          {infoPages.map((page) => (
            <Route key={page.path} path={page.path} element={infoPageElement(page)} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </LayoutProvider>
  );
}
