import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { FilterContext } from '../../layout/filterContext';
import { PanelHeadContext } from '../../layout/panelHeadContext';
import { emptyFilterSelection, type FilterFacet } from '../../model';
import { FiltersView } from './FiltersView';

/**
 * The view reads two pieces of shell state, so both contexts are mounted the
 * way LayoutProvider mounts them. No documents: the document list is its own
 * test, and this one is about the facets.
 *
 * The router is here because the corpus chooser switches corpus by starting a
 * new thread, and `useCorpus` navigates to do it — so the view now needs a
 * router the way it needs the two contexts.
 */
function renderView(facets?: FilterFacet[]) {
  return render(
    <MemoryRouter>
      <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
        <AnswerSourcesContext value={inertAnswerSources}>
          <FiltersView siblingViews={['filters']} onShowView={() => {}} facets={facets} />
        </AnswerSourcesContext>
      </FilterContext>
    </MemoryRouter>,
  );
}

describe('FiltersView', () => {
  it('says so when there are no facets, instead of showing nothing', () => {
    renderView([]);

    expect(
      screen.getByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
    ).toBeTruthy();
    expect(screen.queryByText('Henter filtre')).toBeNull();
  });

  it('does not mistake an empty list for still loading', () => {
    const { container } = renderView([]);

    // An empty array is truthy, so the loading branch has to test !facets and
    // the empty branch facets.length === 0. Getting that wrong showed a
    // skeleton forever, or nothing at all.
    expect(container.querySelector('.filters-view__loading')).toBeNull();
  });

  it('shows a field per facet when there are facets', () => {
    renderView([
      {
        dimension: 'documentType',
        label: 'Dokumenttype',
        values: [{ value: 'arsrapport', label: 'Årsrapport', count: 3 }],
      },
    ]);

    expect(
      screen.queryByRole('heading', { name: 'Filtrering er ikke tilgjengelig ennå' }),
    ).toBeNull();
    expect(screen.getByLabelText('Dokumenttype')).toBeTruthy();
  });

  /*
   * The filters first and the documents under the line (Simens issue 76,
   * 30.09): the corpus line, then «Dokumenter» and «Fra Kudos», then «Dine
   * dokumenter». The line is decoration and says nothing to a screen reader;
   * the headings under it do that.
   */
  it('draws the filters above a line and the documents under it', () => {
    const { container } = renderView([
      {
        dimension: 'documentType',
        label: 'Dokumenttype',
        values: [{ value: 'arsrapport', label: 'Årsrapport', count: 3 }],
      },
    ]);

    const line = container.querySelector('hr');
    const corpus = container.querySelector('.filters-view__corpus');
    const documents = screen.getByRole('heading', { name: 'Dokumenter' });
    const own = screen.getByRole('heading', { name: 'Dine dokumenter' });

    expect(line?.getAttribute('aria-hidden')).toBe('true');
    // Top to bottom, in the order the reader tabs and reads.
    const order = [screen.getByLabelText('Dokumenttype'), line, corpus, documents, own];
    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1]!.compareDocumentPosition(order[index] as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    // No second line: the one line is the break (the brief).
    expect(container.querySelectorAll('hr')).toHaveLength(1);
  });

  it('keeps the corpus line out of the pinned head', () => {
    const { container } = renderView([]);

    expect(container.querySelector('.view-head .filters-view__corpus')).toBeNull();
    expect(container.querySelector('.view-head')?.textContent).toContain('Filtrering');
  });
});

/*
 * A switch here from the thread list takes focus back to «Tråder», because
 * the button that was pressed went away with its view. «Ny tråd» switches
 * here too (Simens issue 75, round 2), and then the focus belongs to the
 * compose field the click asked for.
 */
describe('focus on a switch from the thread list', () => {
  // «Tråder» is drawn on the panel's row, which only a shell has; this is
  // that row, without the rest of the shell.
  const row = document.createElement('div');

  function renderSwitched() {
    document.body.append(row);
    return render(
      <MemoryRouter>
        <PanelHeadContext value={{ element: row }}>
          <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
            <AnswerSourcesContext value={inertAnswerSources}>
              <FiltersView
                siblingViews={['threads']}
                onShowView={() => {}}
                switchedByUser
                facets={[]}
              />
            </AnswerSourcesContext>
          </FilterContext>
        </PanelHeadContext>
      </MemoryRouter>,
    );
  }

  afterEach(() => row.remove());

  it('goes to «Tråder» when it was dropped', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    renderSwitched();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tråder' }));
  });

  it('stays where it is when something already has it', () => {
    const field = document.createElement('textarea');
    document.body.append(field);
    field.focus();

    renderSwitched();

    expect(document.activeElement).toBe(field);
    field.remove();
  });
});
