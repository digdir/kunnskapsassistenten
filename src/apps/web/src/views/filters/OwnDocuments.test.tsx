import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadErrorCode, UserDocument } from '../../model';
import { OwnDocuments } from './OwnDocuments';

/**
 * «Dine dokumenter»: the drop zone, and what the reader has dropped.
 *
 * `useUserDocuments` is the shell's (#117) and reads a module store, so the
 * five states are reached by standing in for the hook — the same way the
 * corpus tests stand in for `useCorpus`. What is asserted is this view's
 * half: which of the states is drawn, and that nothing invites an action the
 * service cannot do.
 */
const hook = vi.hoisted(() => ({
  documents: [] as UserDocument[],
  unavailable: undefined as UploadErrorCode | undefined,
  upload: vi.fn(async (file: File) => ({ id: 'ny', name: file.name }) as unknown as UserDocument),
  remove: vi.fn(async () => {}),
}));

vi.mock('../../layout/useUserDocuments', () => ({
  useUserDocuments: () => ({
    documents: hook.documents,
    ready: hook.documents.filter((document) => document.status === 'ready'),
    uploading: hook.documents.some((document) => document.status === 'uploading'),
    unavailable: hook.unavailable,
    upload: hook.upload,
    remove: hook.remove,
  }),
}));

const doc = (over: Partial<UserDocument> = {}): UserDocument => ({
  id: 'a',
  name: 'Årsrapport 2025.pdf',
  type: 'pdf',
  size: 2_400_000,
  status: 'ready',
  progress: 100,
  uploadedAt: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  hook.documents = [];
  hook.unavailable = undefined;
  hook.upload.mockClear();
  hook.remove.mockClear();
});

describe('Dine dokumenter', () => {
  it('tom: sonen inviterer, og lista finnes ikke', () => {
    render(<OwnDocuments />);

    expect(screen.getByRole('heading', { name: 'Dine dokumenter' })).toBeTruthy();
    expect(screen.getByText('Velg filer')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    // Merkelappen hører til noe som virker; se live-tilfellet under.
    expect(screen.getByText('Ny')).toBeTruthy();
  });

  it('sier hvilke filtyper og hvor stor, i sonens egen beskrivelse', () => {
    // Designsystemet krever at typer, størrelse og bruk står i
    // `Field.Description` og ikke bare i knappen (file-upload.md).
    render(<OwnDocuments />);

    const zone = screen.getByText(/Kun PDF og \.docx/);
    // Samme tall som grensa sjekkes mot: «21 MB» ville vært sant i desimale
    // enheter og et annet tall for én regel.
    expect(zone.textContent).toContain('20 MB');
  });

  it('laster opp filene som velges, én om gangen', async () => {
    render(<OwnDocuments />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.docx,application/pdf');

    const files = [
      new File(['a'], 'en.pdf', { type: 'application/pdf' }),
      new File(['b'], 'to.docx'),
    ];
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(hook.upload).toHaveBeenCalledTimes(2));
    expect(hook.upload.mock.calls.map(([file]) => file.name)).toEqual(['en.pdf', 'to.docx']);
  });

  it('laster: raden viser hvor langt det er kommet', () => {
    hook.documents = [doc({ status: 'uploading', progress: 40 })];
    render(<OwnDocuments />);

    expect(screen.getByText(/Laster opp … 40 %/)).toBeTruthy();
  });

  it('klar: raden sier type og størrelse, og ingenting mer', () => {
    // Et «Klar» under hver ferdige fil er et ord per rad i et panel som alt
    // er over høydebudsjettet, og leseren ser at fila er der.
    hook.documents = [doc()];
    render(<OwnDocuments />);

    expect(screen.getByText('Årsrapport 2025.pdf')).toBeTruthy();
    expect(screen.getByText('PDF · 2,4 MB')).toBeTruthy();
    expect(screen.queryByText(/Klar/)).toBeNull();
  });

  it('feilet: raden sier hvorfor, med ordene for den ene årsaken', () => {
    hook.documents = [doc({ status: 'failed', errorCode: 'too-large', size: 30_000_000 })];
    render(<OwnDocuments />);

    expect(screen.getByText('Filen er større enn 20 MB.')).toBeTruthy();
  });

  it('fjerner en fil, og sier i navnet hvilken', () => {
    hook.documents = [doc(), doc({ id: 'b', name: 'Notat.docx', type: 'docx' })];
    render(<OwnDocuments />);

    // «Fjern» fire ganger er fire kontroller en skjermleser ikke kan skille.
    fireEvent.click(screen.getByRole('button', { name: 'Fjern Notat.docx' }));

    expect(hook.remove).toHaveBeenCalledWith('b');
  });

  it('live: sonen står, men inviterer ikke til noe tjenesten ikke kan', () => {
    hook.unavailable = 'unavailable';
    render(<OwnDocuments />);

    // Seksjonen skjules ikke — leseren skal vite at dette finnes.
    expect(screen.getByRole('heading', { name: 'Dine dokumenter' })).toBeTruthy();
    // Ordlyden fra designet, og samme setning som binderset i skrivefeltet (#3).
    expect(screen.getByText('Snart kan du laste opp dokumenter her')).toBeTruthy();
    expect(screen.getByText('Kommer snart')).toBeTruthy();

    // Men ingen kontroll som ikke kan virke, ingen etikett uten noe å navngi,
    // og ingen «Ny» over den.
    expect(screen.queryByText('Velg filer')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText('Last opp egne dokumenter')).toBeNull();
    expect(screen.queryByText('Ny')).toBeNull();
  });
  it('sier fra i en live-region når en fil kommer inn, blir klar og feiler', () => {
    /*
     * WCAG 4.1.3: raden byttet tekst i stillhet, så en skjermleserbruker fikk
     * ingen kvittering på at fila kom inn og ingen beskjed om at den ble
     * avvist (KA CC på #124). Regionen står montert hele tida — en som dukker
     * opp sammen med teksten sin blir aldri lest opp.
     */
    const { container, rerender } = render(<OwnDocuments />);
    const region = container.querySelector('output.ds-sr-only') as HTMLElement;
    expect(region).toBeTruthy();
    expect(region.textContent).toBe('');

    hook.documents = [doc({ status: 'uploading', progress: 0 })];
    rerender(<OwnDocuments />);
    expect(region.textContent).toBe('Laster opp Årsrapport 2025.pdf');

    // Prosenten sier den ikke: den endrer seg tjue ganger og ville begravd
    // setningen som betyr noe.
    hook.documents = [doc({ status: 'uploading', progress: 60 })];
    rerender(<OwnDocuments />);
    expect(region.textContent).toBe('Laster opp Årsrapport 2025.pdf');

    hook.documents = [doc({ status: 'ready' })];
    rerender(<OwnDocuments />);
    expect(region.textContent).toBe('Årsrapport 2025.pdf er lastet opp');

    hook.documents = [doc({ status: 'failed', errorCode: 'failed' })];
    rerender(<OwnDocuments />);
    expect(region.textContent).toBe(
      'Årsrapport 2025.pdf ble ikke lastet opp. Opplastingen mislyktes. Prøv igjen.',
    );
  });

  it('sier ingenting om dokumenter som alt lå der da panelet ble tegnet', () => {
    // Filer hentet fra lageret ved lasting er ikke nyheter, og «er lastet
    // opp» om tre av dem ville vært en påstand om noe som skjer nå.
    hook.documents = [doc(), doc({ id: 'b', name: 'Notat.docx', type: 'docx' })];
    const { container } = render(<OwnDocuments />);

    expect(container.querySelector('output.ds-sr-only')?.textContent).toBe('');
  });

  it('flytter fokus til raden under når en fil fjernes', () => {
    /*
     * WCAG 2.4.3: knappen avmonterer seg selv, og uten dette faller
     * tastaturet til `<body>`, som er over hopp-lenka. Målt av KA CC med ekte
     * Tab og Enter; samme felle som ga fire funn i PR #3.
     */
    hook.documents = [doc(), doc({ id: 'b', name: 'Notat.docx', type: 'docx' })];
    const { rerender } = render(<OwnDocuments />);

    fireEvent.click(screen.getByRole('button', { name: 'Fjern Årsrapport 2025.pdf' }));
    hook.documents = [doc({ id: 'b', name: 'Notat.docx', type: 'docx' })];
    rerender(<OwnDocuments />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fjern Notat.docx' }));
  });

  it('flytter fokus oppover når den siste raden fjernes', () => {
    hook.documents = [doc(), doc({ id: 'b', name: 'Notat.docx', type: 'docx' })];
    const { rerender } = render(<OwnDocuments />);

    fireEvent.click(screen.getByRole('button', { name: 'Fjern Notat.docx' }));
    hook.documents = [doc()];
    rerender(<OwnDocuments />);

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Fjern Årsrapport 2025.pdf' }),
    );
  });

  it('flytter fokus til filvelgeren når lista blir tom', () => {
    hook.documents = [doc()];
    const { rerender } = render(<OwnDocuments />);

    fireEvent.click(screen.getByRole('button', { name: 'Fjern Årsrapport 2025.pdf' }));
    hook.documents = [];
    rerender(<OwnDocuments />);

    expect(document.activeElement).toBe(document.querySelector('input[type="file"]'));
  });
});
