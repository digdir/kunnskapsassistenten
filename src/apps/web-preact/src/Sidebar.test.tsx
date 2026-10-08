import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Sidebar } from './Sidebar.tsx';

afterEach(cleanup);

const conversations = [
  { id: 'a', topic: 'Hvilke tildelingsbrev nevner sikkerhet?', created: 3 },
  { id: 'b', topic: 'Hvor mange årsverk har Digdir?', created: 2 },
  { id: 'c', topic: 'Status på KI i Norge', created: 1 },
];

const noop = () => {};

function show(over: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <Sidebar
      conversations={conversations}
      activeId={null}
      open
      onToggle={noop}
      onOpen={noop}
      onNew={noop}
      onRename={noop}
      onDelete={noop}
      {...over}
    />,
  ).container;
}

const titles = (host: Element) =>
  [...host.querySelectorAll('.thread-open')].map((b) => b.textContent);

const search = (host: Element, value: string) =>
  fireEvent.input(host.querySelector('.thread-search')!, { target: { value } });

describe('Sidebar', () => {
  test('lists every thread when the search box is empty', () => {
    expect(titles(show())).toHaveLength(3);
  });

  test('search narrows the list, case-insensitively', () => {
    const host = show();
    search(host, 'ÅRSVERK');
    expect(titles(host)).toEqual(['Hvor mange årsverk har Digdir?']);
  });

  test('says "Ingen tråder ennå" when there are none at all', () => {
    const host = show({ conversations: [] });
    expect(host.querySelector('.thread-empty')?.textContent).toBe('Ingen tråder ennå.');
  });

  test('says "Ingen treff" when a search matches nothing', () => {
    const host = show();
    search(host, 'zzz');
    expect(host.querySelector('.thread-empty')?.textContent).toBe('Ingen treff.');
  });

  test('marks exactly one thread active', () => {
    const active = show({ activeId: 'b' }).querySelectorAll('.thread-row.is-active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain('Hvor mange årsverk');
  });

  test('opening a thread reports its id, not its title', () => {
    const opened: string[] = [];
    const host = show({ onOpen: (id) => opened.push(id) });
    fireEvent.click(host.querySelectorAll('.thread-open')[2]!);
    expect(opened).toEqual(['c']);
  });

  test('rename commits the edited title on Enter', () => {
    const renamed: Array<[string, string]> = [];
    const host = show({ onRename: (id, title) => renamed.push([id, title]) });
    fireEvent.click(screen.getByLabelText(/Gi nytt navn til Hvilke/));
    const input = screen.getByLabelText('Nytt navn');
    fireEvent.input(input, { target: { value: 'Nytt navn' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(renamed).toEqual([['a', 'Nytt navn']]);
    expect(host.querySelector('input[aria-label="Nytt navn"]')).toBeNull();
  });

  test('rename ignores a title that is only whitespace', () => {
    const renamed: string[] = [];
    show({ onRename: (_id, title) => renamed.push(title) });
    fireEvent.click(screen.getByLabelText(/Gi nytt navn til Hvilke/));
    const input = screen.getByLabelText('Nytt navn');
    fireEvent.input(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(renamed).toEqual([]);
  });

  test('Escape abandons a rename without calling back', () => {
    const renamed: string[] = [];
    show({ onRename: (_id, title) => renamed.push(title) });
    fireEvent.click(screen.getByLabelText(/Gi nytt navn til Hvilke/));
    const input = screen.getByLabelText('Nytt navn');
    fireEvent.input(input, { target: { value: 'Forkastet' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(renamed).toEqual([]);
  });

  test('delete reports the id', () => {
    const deleted: string[] = [];
    show({ onDelete: (id) => deleted.push(id) });
    fireEvent.click(screen.getByLabelText('Slett Status på KI i Norge'));
    expect(deleted).toEqual(['c']);
  });

  test('collapsed, it shows only the reopen button', () => {
    const host = show({ open: false });
    expect(host.querySelectorAll('.thread-open')).toHaveLength(0);
    expect(host.textContent).toMatch(/Vis tråder/);
  });

  test('"Vis andres tråder" is inert, not a live link', () => {
    const toggle = show().querySelector('.scope-toggle')!;
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    expect(toggle.tagName.toLowerCase()).toBe('span');
  });

  test('a signed-in user can log out', () => {
    const host = show({ user: { name: 'Kari Nordmann', email: 'kari@example.com' } });
    expect(host.textContent).toContain('Kari Nordmann');
    expect(host.querySelector('a[href="/auth/logout"]')).toBeTruthy();
  });

  test('without sign-in there is nothing to log out of', () => {
    expect(show().querySelector('a[href="/auth/logout"]')).toBeNull();
  });
});
