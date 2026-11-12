import type { AssistantApi } from '@genai/ui-assembly';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { BACK_LABEL } from './BackToClassic';
import type { Me } from './session';

const me: Me = {
  name: 'Testperson Testesen',
  organisation: 'Testvirksomheten',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: false,
};

const fakeApi = (): AssistantApi => ({
  loadModels: vi.fn(async () => [
    {
      id: 'kunnskapsassistenten__default',
      _service: 'kunnskapsassistenten',
      _service_title: 'Kunnskapsassistenten',
      _pickable: true,
      _chat: true,
    },
  ]),
  loadThreads: vi.fn(async () => [
    { id: 't1', title: 'En tråd', updatedAt: Date.now(), service: 'kunnskapsassistenten' },
    { id: 't2', title: 'En annen tjenestes tråd', updatedAt: Date.now(), service: 'annen' },
  ]),
  loadThread: vi.fn(async () => ({ title: 'En tråd', turns: [] })),
  loadCorpora: vi.fn(async () => []),
  loadFields: vi.fn(async () => []),
  loadFacets: vi.fn(async () => []),
  loadAbout: vi.fn(async () => undefined),
  ask: async function* () {},
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the next client', () => {
  it("lists only this service's threads, and the person at the panel's foot", async () => {
    render(<App me={me} api={fakeApi()} />);
    expect(await screen.findByText('En tråd')).toBeTruthy();
    expect(screen.queryByText('En annen tjenestes tråd')).toBeNull();
    expect(screen.getAllByRole('button', { name: me.name }).length).toBeGreaterThan(0);
  });

  it("has «Tilbake til gammel versjon» in the profile menu, after the menu's pages", async () => {
    const onSwitch = vi.fn();
    render(<App me={me} api={fakeApi()} onSwitchBack={onSwitch} />);
    const [button] = await screen.findAllByRole('button', { name: me.name });
    fireEvent.click(button!);
    const menu = document.querySelector('.uib-shell-profile-menu') as HTMLElement;
    // jsdom does not open a popover, so the menu counts as hidden.
    const back = await within(menu).findByRole('button', { name: BACK_LABEL, hidden: true });
    const settings = within(menu).getByText('Innstillinger');
    expect(
      settings.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const signOut = within(menu).getByRole('link', { name: /Logg ut/, hidden: true });
    expect(
      back.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(back);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledOnce());
  });

  it('keeps its choices under ka-next. in this browser', async () => {
    render(<App me={me} api={fakeApi()} />);
    await screen.findByText('En tråd');
    await waitFor(() =>
      expect(Object.keys(localStorage).every((key) => key.startsWith('ka-next.'))).toBe(true),
    );
    expect(Object.keys(localStorage).length).toBeGreaterThan(0);
  });
});
