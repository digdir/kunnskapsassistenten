import { Route, Routes } from 'react-router';
import { LayoutProvider } from './layout/LayoutProvider';
import { Shell } from './layout/Shell';
import { infoPageElement, infoPages } from './routes/info/infoPages';
import { NewConversation } from './routes/NewConversation';
import { NotFound } from './routes/NotFound';
import { PreviousClientThread } from './routes/PreviousClientThread';
import { Thread } from './routes/Thread';

/**
 * Routes are English, like the rest of the code. The text they render is
 * Norwegian.
 *
 *   /                   new conversation, empty state
 *   /threads/:threadId  one conversation
 *   /chat/:threadId     the same, as the previous client links to it
 *   /onboarding         ┐
 *   /endringslogg       ├ a page about Kunnskapsassistenten itself
 *   /om-prosjektet      ┘
 *   anything else       «siden finnes ikke»
 *
 * Two layout routes and not one, because the shell is mounted differently for
 * the two kinds of page. The conversation routes let the view in the slot draw
 * the main column; every other page draws its own (`routeOwnsMain`). A single
 * layout route could not say that, and `/tull` would get the front page's
 * welcome screen under the words «siden finnes ikke» — as would the changelog.
 *
 * The three information pages are Norwegian addresses among English routes,
 * and on purpose: they are the addresses the old Kunnskapsassistenten uses.
 * They come from one list, see src/routes/info/infoPages.tsx.
 *
 * Switching between the two remounts the shell. The layout lives above it, in
 * `LayoutProvider`, so nothing a reader has set up is lost — and navigating
 * to or from a broken address is not a thing that happens twice a minute.
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
