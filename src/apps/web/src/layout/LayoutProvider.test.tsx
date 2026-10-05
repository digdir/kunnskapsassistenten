import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultViewportWidth, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { LAYOUT_STORAGE_KEY } from './persistence';
import { useAnswerSources } from './useAnswerSources';
import { useCitation } from './useCitation';
import { useFilterSelection } from './useFilterSelection';
import { useLayout } from './useLayout';
import type { SourceDocument } from '../model';
import {
  bothSidebarsMinViewport,
  defaultLayout,
  drawerMaxViewport,
  withCollapsed,
  type Layout,
} from './viewModel';

/**
 * Reads the signal a view uses to decide whether to take focus on mount, and
 * exposes the switch so a test can pull it.
 */
function Probe() {
  const { isSwitchedByUser, setActiveView, layout } = useLayout();
  return (
    <>
      <output data-testid="active">{layout.slots['primary-sidebar'].activeView}</output>
      <output data-testid="switched">{String(isSwitchedByUser('primary-sidebar'))}</output>
      <button type="button" onClick={() => setActiveView('primary-sidebar', 'threads')}>
        Tråder
      </button>
      <button type="button" onClick={() => setActiveView('primary-sidebar', 'sources')}>
        Kilder
      </button>
    </>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

describe('isSwitchedByUser', () => {
  it('is false on a page load, so nothing is taken from the skip link', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    // defaultLayout opens the primary sidebar on filters (answer 1). A view
    // that mounts for that reason was not asked for by anybody.
    expect(read('active')).toBe('filters');
    expect(read('switched')).toBe('false');
  });

  it('is true for the view the user switched to', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Tråder' }).click());

    expect(read('active')).toBe('threads');
    expect(read('switched')).toBe('true');
  });

  it('stays false when the request changed nothing', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    // `sources` does not sit in the primary sidebar, so the switch is ignored
    // and no view mounted that could claim focus.
    act(() => screen.getByRole('button', { name: 'Kilder' }).click());

    expect(read('active')).toBe('filters');
    expect(read('switched')).toBe('false');
  });
});

/**
 * Rule B, decided 2026-09-14: below `bothSidebarsMinViewport` the two
 * sidebars cannot both be open, so the provider keeps one.
 *
 * These test the provider and not the CSS. That the widths actually add up to
 * a window is measured against a real browser in tests/e2e/layout.spec.ts;
 * what is in question here is which panel is open, which is state.
 */
function Sidebars() {
  const { layout, setCollapsed } = useLayout();
  const { showCitation } = useCitation();

  return (
    <>
      <output data-testid="primary">
        {layout.slots['primary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <output data-testid="secondary">
        {layout.slots['secondary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <button type="button" onClick={() => setCollapsed('primary-sidebar', false)}>
        Vis tråder og filter
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', false)}>
        Vis kilder
      </button>
      <button type="button" onClick={() => showCitation(1)}>
        Kilde 1
      </button>
    </>
  );
}

/** Both sidebars open, which `defaultLayout` is not: sources starts collapsed. */
const bothSidebarsOpen = withCollapsed(defaultLayout, 'secondary-sidebar', false);

const click = (name: string) => act(() => screen.getByRole('button', { name }).click());

function renderSidebars(initialLayout?: Layout) {
  return render(
    <LayoutProvider initialLayout={initialLayout}>
      <Sidebars />
    </LayoutProvider>,
  );
}

describe('én åpen sidekolonne under brytepunktet', () => {
  beforeEach(() => setViewportWidth(defaultViewportWidth));

  it('lar begge stå åpne på brytepunktet', () => {
    // Exactly at the breakpoint everything fits, to the pixel. The rule is
    // «narrower than», not «narrower than or equal to», and 1440 is the one
    // width where that distinction is the whole design.
    setViewportWidth(bothSidebarsMinViewport);
    renderSidebars();

    click('Vis kilder');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });

  it('kollapser navigasjonspanelet når kildepanelet åpnes under brytepunktet', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();

    click('Vis kilder');

    // The slot the user asked for wins; the other one gives.
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet når navigasjonspanelet åpnes under brytepunktet', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars(bothSidebarsOpen);

    click('Vis tråder og filter');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet når vinduet krymper forbi brytepunktet', () => {
    renderSidebars();
    click('Vis kilder');
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');

    act(() => setViewportWidth(bothSidebarsMinViewport - 1));

    // Nobody asked for anything, so the panel that gives is the one decided
    // in advance: the sources panel.
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet med én gang på et vindu som alt er for smalt', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);

    // A layout handed in from outside knows nothing about the window it is
    // about to be drawn in, so the rule cannot wait for a change to react to.
    renderSidebars(bothSidebarsOpen);

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('lar en kildehenvisning følge samme regel', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();

    // A `[n]` in the answer is a request to open the sources panel, and it
    // has to cost the same as pressing the button does.
    click('Kilde 1');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
  });

  it('åpner ingenting av seg selv når vinduet vokser igjen', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();
    click('Vis kilder');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');

    act(() => setViewportWidth(bothSidebarsMinViewport));

    // The rule takes a panel away when there is no room. It does not hand one
    // back: a panel that opened itself because the window grew would undo a
    // choice the user made, and the user is the only one who collapses things
    // on purpose.
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });
});

describe('over brytepunktet', () => {
  beforeEach(() => setViewportWidth(defaultViewportWidth));

  it('rører ingenting', () => {
    setViewportWidth(bothSidebarsMinViewport + 96);
    renderSidebars();

    click('Vis kilder');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });
});

/**
 * The sources panel opening itself when an answer brings sources, decided
 * 2026-09-15 (rolle-5e, punkt 2).
 *
 * The rule has three ways to say no — the user closed it, there is no room,
 * the answer brought nothing — and each of them is a separate test, because
 * each is a different way for it to go wrong in front of a user.
 */
const twoDocuments = [
  { id: 'd1', title: 'Årsrapport 2022', excerpts: [] },
  { id: 'd2', title: 'Årsrapport 2023', excerpts: [] },
] as unknown as SourceDocument[];

function Sources() {
  const { layout, setCollapsed } = useLayout();
  const { setDocuments } = useAnswerSources();

  return (
    <>
      <output data-testid="secondary">
        {layout.slots['secondary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <output data-testid="primary">
        {layout.slots['primary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <button type="button" onClick={() => setDocuments(twoDocuments)}>
        Svar med kilder
      </button>
      <button type="button" onClick={() => setDocuments([])}>
        Svar uten kilder
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', true)}>
        Skjul kilder
      </button>
      <button type="button" onClick={() => setCollapsed('primary-sidebar', true)}>
        Skjul tråder og filter
      </button>
    </>
  );
}

function renderSources(initialLayout?: Layout) {
  return render(
    <LayoutProvider initialLayout={initialLayout}>
      <Sources />
    </LayoutProvider>,
  );
}

describe('kildepanelet åpner seg selv', () => {
  beforeEach(() => setViewportWidth(defaultViewportWidth));

  it('åpner når svaret har kilder og det er plass', () => {
    setViewportWidth(bothSidebarsMinViewport);
    renderSources();
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');

    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
    // Regel B er ikke i veien på brytepunktet, så navigasjonspanelet blir.
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
  });

  it('lar være når svaret ikke har kilder', () => {
    renderSources();
    click('Svar uten kilder');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('lar være når brukeren selv har lukket panelet', () => {
    renderSources();
    click('Svar med kilder');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');

    click('Skjul kilder');
    // Et oppfølgingssvar med nye kilder skal ikke overstyre det valget.
    click('Svar uten kilder');
    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('lar være under brytepunktet når navigasjonspanelet er åpent', () => {
    // Her ville regel B kollapset navigasjonspanelet for å gi plass. Å ta et
    // panel fra brukeren er noe de må be om, ikke noe et svar gjør.
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSources();

    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
  });

  it('åpner under brytepunktet når navigasjonspanelet alt er kollapset', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSources();
    click('Skjul tråder og filter');

    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });

  it('lar være i skuff-modus, der panelet ville vært en modal over svaret', () => {
    // Under 1139 er et åpent panel en skuff: en modal, med fokusfelle og
    // inert bakgrunn. Den ville lagt seg over svaret som nettopp kom og tatt
    // tastaturet fra leseren midt i at de leser det.
    //
    // Og den kommer seg forbi de andre vaktene: skuff-modus folder begge
    // sidekolonnene bort, så `roomForBoth` er sann fordi navigasjonspanelet
    // er kollapset. «Er det plass» har ikke noe svar her — det finnes ingen
    // ved siden av.
    setViewportWidth(drawerMaxViewport - 1);
    renderSources();
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');

    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('åpner igjen så snart vinduet er over skuff-grensa', () => {
    // Den andre halvdelen av den samme regelen: det er skuff-modus som er
    // grunnen, ikke bredden i seg selv. På 1139 er det plass ved siden av, og
    // da er et svar med kilder fortsatt god nok grunn til å åpne panelet.
    setViewportWidth(drawerMaxViewport);
    renderSources();
    click('Skjul tråder og filter');

    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });

  it('teller ikke regel B sin kollaps som brukerens valg', () => {
    // Dette er hele grunnen til at «lukket av brukeren» er egen tilstand og
    // ikke bare «er kollapset». Krymper vinduet, tar regelen panelet — og
    // hadde det blitt husket som en preferanse, ville én endring av
    // vindusbredden slått av kildepanelet for resten av økta.
    setViewportWidth(bothSidebarsMinViewport);
    renderSources();
    click('Svar med kilder');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');

    act(() => setViewportWidth(bothSidebarsMinViewport - 1));
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');

    act(() => setViewportWidth(bothSidebarsMinViewport));
    click('Svar uten kilder');
    click('Svar med kilder');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });
});

/**
 * What survives a reload, decided 2026-09-15 (rolle-5h, punkt 2).
 *
 * A reload is a new mounting here: the provider reads storage once on mount
 * and writes on every change, so unmounting and rendering again walks exactly
 * the path a reload walks. jsdom keeps `localStorage` between the two, and
 * src/test/setup.ts empties it between tests.
 */
function Remembered() {
  const { layout, setCollapsed } = useLayout();
  const { selection, setSelection } = useFilterSelection();
  const { setDocuments } = useAnswerSources();

  return (
    <>
      <output data-testid="primary">
        {layout.slots['primary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <output data-testid="secondary">
        {layout.slots['secondary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <output data-testid="filter">{selection.organisation.join(', ')}</output>
      <button type="button" onClick={() => setCollapsed('primary-sidebar', true)}>
        Skjul tråder og filter
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', false)}>
        Vis kilder
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', true)}>
        Skjul kilder
      </button>
      <button type="button" onClick={() => setSelection({ ...selection, organisation: ['nkom'] })}>
        Velg Nkom
      </button>
      <button type="button" onClick={() => setDocuments(twoDocuments)}>
        Svar med kilder
      </button>
    </>
  );
}

let mounted: ReturnType<typeof render> | undefined;

/** Leave the page. Storage keeps whatever the last commit wrote. */
function close(): void {
  mounted?.unmount();
  mounted = undefined;
}

/** Open the page, as a reload does: a fresh provider on the same storage. */
function open(initialLayout?: Layout): void {
  close();
  mounted = render(
    <LayoutProvider initialLayout={initialLayout}>
      <Remembered />
    </LayoutProvider>,
  );
}

describe('det appen husker til neste gang', () => {
  beforeEach(() => {
    mounted = undefined;
    setViewportWidth(defaultViewportWidth);
  });

  it('husker at en sidekolonne er lagt sammen', () => {
    open();
    expect(read('primary')).toBe('åpen');

    click('Skjul tråder og filter');
    open();

    expect(read('primary')).toBe('kollapset');
  });

  it('husker filtervalget', () => {
    open();
    click('Velg Nkom');

    open();

    expect(read('filter')).toBe('nkom');
  });

  it('husker at brukeren selv lukket kildepanelet', () => {
    open();
    click('Vis kilder');
    click('Skjul kilder');

    open();
    expect(read('secondary')).toBe('kollapset');

    // The panel opening itself on an answer with sources is what this has to
    // stay out of the way of. Collapsed alone cannot say it: collapsed is
    // also the default, so «I closed this» would be forgotten by the reload
    // and the next answer would push the panel back at somebody who shut it.
    click('Svar med kilder');
    expect(read('secondary')).toBe('kollapset');
  });

  it('lar regel B overstyre det som er husket', () => {
    open();
    click('Vis kilder');
    expect(read('secondary')).toBe('åpen');

    // Same browser, narrower window. Both sidebars were open when the page
    // was left, and this one cannot hold both. Closed before the resize on
    // purpose: what is under test is the first render in a narrow window,
    // not the rule reacting to a change.
    close();
    setViewportWidth(bothSidebarsMinViewport - 1);
    open();

    expect(read('primary')).toBe('åpen');
    expect(read('secondary')).toBe('kollapset');
  });

  it('lar et layout som er gitt inn vinne over det som er husket', () => {
    open();
    click('Skjul tråder og filter');

    open(bothSidebarsOpen);

    expect(read('primary')).toBe('åpen');
    expect(read('secondary')).toBe('åpen');
  });

  it('åpner på standard når lageret inneholder tull', () => {
    // The reader is free to edit this by hand, and a `collapsed` that is the
    // number 3 would otherwise reach `aria-expanded`.
    localStorage.setItem(LAYOUT_STORAGE_KEY, '{ikke json');
    open();
    expect(read('primary')).toBe('åpen');
    expect(read('secondary')).toBe('kollapset');

    close();
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ collapsed: { 'primary-sidebar': 3 } }),
    );
    open();
    expect(read('primary')).toBe('åpen');
  });
});
