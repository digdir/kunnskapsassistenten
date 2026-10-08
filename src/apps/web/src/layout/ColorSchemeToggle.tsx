import { ToggleGroup } from '@digdir/designsystemet-react';
import { MonitorIcon, MoonIcon, SunIcon } from '@navikt/aksel-icons';
import { setColorScheme, type ColorScheme } from './colorScheme';
import { useColorScheme } from './useColorScheme';

const choices: { value: ColorScheme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Lys', Icon: SunIcon },
  { value: 'dark', label: 'Mørk', Icon: MoonIcon },
  // «Auto», not «Automatisk»: three items share the panel's width, and the longest word decides
  // how narrow the other two get.
  { value: 'auto', label: 'Auto', Icon: MonitorIcon },
];

function isColorScheme(value: string): value is ColorScheme {
  return choices.some((choice) => choice.value === value);
}

/**
 * Light, dark, or follow the operating system (digdir/kunnskapsassistenten#85). A `ToggleGroup`:
 * three answers and a stored selection, read as a radio group by screen readers. Words beside the
 * icons, since Designsystemet asks for a tooltip on icon-only items.
 */
export function ColorSchemeToggle() {
  const scheme = useColorScheme();

  return (
    <ToggleGroup
      aria-label="Fargemodus"
      className="color-scheme-toggle"
      data-size="sm"
      onChange={(value) => {
        if (isColorScheme(value)) setColorScheme(value);
      }}
      value={scheme}
      variant="secondary"
    >
      {choices.map(({ value, label, Icon }) => (
        <ToggleGroup.Item key={value} value={value}>
          <Icon aria-hidden />
          {label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup>
  );
}
