import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Filters, type Selection } from './Filters.tsx';

const facets = [
  {
    field: 'type',
    label: 'dokumenttyper',
    options: [
      { value: 'Tildelingsbrev', count: 3378 },
      { value: 'Statusrapport', count: 1709 },
      { value: 'Evaluering', count: 1472 },
    ],
  },
  { field: 'concerned_years', label: 'år', options: [{ value: '2024', count: 12 }] },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ facets }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function show(selection: Selection = {}, locked = false) {
  const onChange = vi.fn();
  const { container } = render(
    <Filters selection={selection} locked={locked} onChange={onChange} />,
  );
  await waitFor(() => expect(container.querySelectorAll('.facet').length).toBe(2));
  return { host: container, onChange };
}

describe('Filters', () => {
  test('renders nothing until the facets arrive', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { container } = render(<Filters selection={{}} locked={false} onChange={() => {}} />);
    expect(container.querySelector('.filters')).toBeNull();
  });

  test('a field with nothing selected reads "Velg"', async () => {
    await show();
    expect(screen.getByText(/Velg\s+dokumenttyper/)).toBeTruthy();
  });

  test('a field with a selection reads "Valgt"', async () => {
    await show({ type: ['Evaluering'] });
    expect(screen.getByText(/Valgt\s+dokumenttyper/)).toBeTruthy();
  });

  test('a chip carries the facet count, which is why the label changes', async () => {
    const { host } = await show({ type: ['Statusrapport'] });
    expect(host.querySelector('.ds-chip')?.textContent).toBe('Statusrapport (1709)');
  });

  test('a selected value the backend no longer facets on shows without a count', async () => {
    const { host } = await show({ type: ['Utgått dokumenttype'] });
    expect(host.querySelector('.ds-chip')?.textContent).toBe('Utgått dokumenttype');
  });

  test('picking an option adds it to that field only', async () => {
    const { host, onChange } = await show();
    fireEvent.click(host.querySelectorAll('.ds-combobox__input__wrapper')[0]!);
    fireEvent.click(screen.getByText('Evaluering'));
    expect(onChange).toHaveBeenCalledWith({ type: ['Evaluering'] });
  });

  test('clicking a chip removes that value', async () => {
    const { host, onChange } = await show({ type: ['Statusrapport', 'Evaluering'] });
    fireEvent.click(host.querySelectorAll('.ds-chip')[0]!);
    expect(onChange).toHaveBeenCalledWith({ type: ['Evaluering'] });
  });

  test('the clear button empties the field', async () => {
    const { onChange } = await show({ type: ['Statusrapport'] });
    fireEvent.click(screen.getByLabelText('Fjern alt'));
    expect(onChange).toHaveBeenCalledWith({ type: [] });
  });

  test('locked: clicking the control does not open the list', async () => {
    const { host } = await show({ type: ['Statusrapport'] }, true);
    expect(host.querySelectorAll('.ds-combobox__disabled')).toHaveLength(2);
    fireEvent.click(host.querySelectorAll('.ds-combobox__input__wrapper')[0]!);
    expect(host.querySelector('.facet-options')).toBeNull();
  });

  test('locked: the text input is disabled, so typing cannot open the list either', async () => {
    const { host } = await show({ type: ['Statusrapport'] }, true);
    const input = host.querySelectorAll('.ds-combobox__input')[0] as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  test('locked: chips are disabled, so a selection cannot be removed', async () => {
    const { host } = await show({ type: ['Statusrapport'] }, true);
    const chip = host.querySelector('.ds-chip') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });

  test('locked: no clear button, so a thread filter cannot be emptied mid-thread', async () => {
    await show({ type: ['Statusrapport'] }, true);
    expect(screen.queryByLabelText('Fjern alt')).toBeNull();
  });

  test('typing filters the option list', async () => {
    const { host } = await show();
    fireEvent.click(host.querySelectorAll('.ds-combobox__input__wrapper')[0]!);
    fireEvent.input(host.querySelectorAll('.ds-combobox__input')[0]!, {
      target: { value: 'evaluer' },
    });
    expect(host.querySelectorAll('.facet-option')).toHaveLength(1);
  });

  test('an option list with no matches says so', async () => {
    const { host } = await show();
    fireEvent.click(host.querySelectorAll('.ds-combobox__input__wrapper')[0]!);
    fireEvent.input(host.querySelectorAll('.ds-combobox__input')[0]!, {
      target: { value: 'zzz' },
    });
    expect(host.querySelector('.facet-empty')?.textContent).toBe('Ingen treff.');
  });

  describe('when the backend cannot take filters', () => {
    function stubCapabilities(filters: boolean) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => ({
          ok: true,
          json: async () =>
            url.includes('capabilities') ? { capabilities: { filters } } : { facets },
        })),
      );
    }

    test('the row still renders, so the feature stays discoverable', async () => {
      stubCapabilities(false);
      const { host } = await show();
      expect(host.querySelector('.filters')).not.toBeNull();
      expect(host.querySelectorAll('.facet').length).toBe(2);
    });

    test('every input is disabled and says why', async () => {
      stubCapabilities(false);
      const { host } = await show();
      await waitFor(() => expect(host.querySelector('.ds-combobox__disabled')).not.toBeNull());
      for (const input of host.querySelectorAll('input.ds-combobox__input')) {
        expect((input as HTMLInputElement).disabled).toBe(true);
      }
      for (const facet of host.querySelectorAll('.facet')) {
        expect(facet.getAttribute('title')).toContain('tar ikke imot filtre');
      }
    });

    test('a hint explains the state rather than leaving it silent', async () => {
      stubCapabilities(false);
      const { host } = await show();
      await waitFor(() => expect(host.querySelector('.filter-hint')).not.toBeNull());
      expect(host.querySelector('.filter-hint')?.textContent).toContain('backenden');
    });

    test('no hint and no disabling once the backend supports it', async () => {
      stubCapabilities(true);
      const { host } = await show();
      await waitFor(() => expect(host.querySelectorAll('.facet').length).toBe(2));
      expect(host.querySelector('.filter-hint')).toBeNull();
      expect(host.querySelector('.ds-combobox__disabled')).toBeNull();
    });

    test('the locked reason is kept distinct from the unsupported one', async () => {
      stubCapabilities(true);
      const { host } = await show({}, true);
      await waitFor(() => expect(host.querySelector('.ds-combobox__disabled')).not.toBeNull());
      expect(host.querySelector('.facet')?.getAttribute('title')).toContain('låst til tråden');
      expect(host.querySelector('.filter-hint')).toBeNull();
    });
  });
});
