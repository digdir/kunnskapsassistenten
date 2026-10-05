import { ToggleGroup } from '@digdir/designsystemet-react';
import { MonitorIcon, MoonIcon, SunIcon } from '@navikt/aksel-icons';
import { setColorScheme, type ColorScheme } from './colorScheme';
import { useColorScheme } from './useColorScheme';

/**
 * Light, dark, or whatever the operating system says. Simens issue 85: the
 * app followed the system and nothing else, and a reader has to be able to
 * choose.
 *
 * `ToggleGroup` and not a `Switch` or a `Dropdown`, from
 * design/designsystemet/komponenter/: a switch is on or off and this has three
 * answers, one of them «follow the system», which is the default and has to
 * stay reachable after a reader has tried the other two. A Dropdown is a list
 * of actions with no selected state, and its own page says a stored value
 * belongs in `Select` or `ToggleGroup`. The group is a radio group underneath,
 * so a screen reader says «1 av 3» and which is chosen.
 *
 * Words beside the icons, not icons alone. Designsystemet asks for a tooltip
 * on an icon-only item, and at the foot of a 400 px panel there is room for
 * the words, which say more than a sun does.
 */
const choices: { value: ColorScheme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Lys', Icon: SunIcon },
  { value: 'dark', label: 'Mørk', Icon: MoonIcon },
  // «Auto» and not «Automatisk» (Simens issue 85a): three items share the
  // width of the panel, and the longest word decided how narrow the other two
  // got.
  { value: 'auto', label: 'Auto', Icon: MonitorIcon },
];

function isColorScheme(value: string): value is ColorScheme {
  return choices.some((choice) => choice.value === value);
}

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
