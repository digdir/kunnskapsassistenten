import { Dropdown, Field, Heading, Label, Select } from '@digdir/designsystemet-react';
import { ChevronDownIcon } from '@navikt/aksel-icons';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { classes } from '../dom.js';
import { useT } from './i18n.js';
import { toolMode } from './toolMode.js';

export interface ShellTool {
  /** Stable across renders: the tool's state is kept by it. */
  id: string;
  /** Its name, on the heading, the tab or the dropdown's option: «Kilder». */
  label: string;
  content: ReactNode;
  /**
   * Its icon, `aria-hidden`: beside its name in the `tinted` switcher, and on a button of its own
   * where the host draws one, as on the folded panel (`ShellPanel.rail`).
   */
  icon?: ReactNode;
}

export interface ShellToolsProps {
  /** In the order they are offered. */
  tools: readonly ShellTool[];
  /**
   * The tool shown, by its id. Without it, the block keeps its own, the first to begin with. As
   * `VariantPicker` and `CorpusChoice`, a controlled choice of one.
   */
  value?: string | undefined;
  /** The reader chose another tool. */
  onChange?: ((id: string) => void) | undefined;
  /** The heading's level when there is one tool, 2 by default. */
  headingLevel?: 2 | 3 | 4 | undefined;
  /**
   * The panel's pinned region (`ShellPanel.pinnedRef`), to draw the heading, tabs or dropdown in,
   * so they stay while the tool scrolls. `null` until the region is there: nothing is drawn.
   * Without it, the switcher stands over the tool.
   */
  pinIn?: Element | null | undefined;
  /**
   * `tinted`, the dev boards' switcher (dev-verktoy-2 and -3), each tool with its icon: two tools
   * as a pair of joined buttons on a tinted ground, the chosen one plain with a border, and three or
   * more as a tinted button, as wide as the panel, that opens a menu of the tools. `default`, grey
   * tabs and Designsystemet's `Select`.
   */
  variant?: 'default' | 'tinted' | undefined;
  className?: string | undefined;
}

/**
 * The tools in the secondary panel, offered by how many there are, as the design's tool rule
 * says: one gets a heading, two get tabs, three or more a dropdown (board 3, SP10; #168). Every
 * tool stays mounted while hidden, so a search or a scroll position in one survives a visit to
 * another. The tool's own heading is the app's to leave out: here the switcher names it.
 */
export const ShellTools = ({
  tools,
  value,
  onChange,
  headingLevel = 2,
  pinIn,
  variant = 'default',
  className,
}: ShellToolsProps) => {
  const t = useT();
  const id = useId();
  const [own, setOwn] = useState<string>();
  // The tinted dropdown's menu, controlled as the profile menu: a choice closes it.
  const [menuOpen, setMenuOpen] = useState(false);
  const chosen = value ?? own;
  const current = tools.find((tool) => tool.id === chosen) ?? tools[0];
  const tabs = useRef(new Map<string, HTMLButtonElement | null>());
  const mode = toolMode(tools.length);
  if (mode === 'none' || !current) return null;
  const tinted = variant === 'tinted';

  const choose = (next: string) => {
    setOwn(next);
    if (next !== current.id) onChange?.(next);
  };
  const panelId = (tool: ShellTool) => `${id}-panel-${tool.id}`;
  const tabId = (tool: ShellTool) => `${id}-tab-${tool.id}`;
  // The icon and the name, each in a box of its own so the name can be cut with «…».
  const named = (tool: ShellTool, className: string) =>
    tinted ? (
      <>
        {tool.icon}
        <span className={className}>{tool.label}</span>
      </>
    ) : (
      tool.label
    );

  // The arrows move between the tabs and choose as they go, Home and End go to the ends: the
  // tabs pattern with automatic activation, one tab stop for the list.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = tools.findIndex((tool) => tool.id === current.id);
    const to =
      event.key === 'ArrowRight'
        ? (at + 1) % tools.length
        : event.key === 'ArrowLeft'
          ? (at - 1 + tools.length) % tools.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tools.length - 1
              : undefined;
    if (to === undefined) return;
    event.preventDefault();
    const next = tools[to];
    if (!next) return;
    choose(next.id);
    tabs.current.get(next.id)?.focus();
  };

  const panels = tools.map((tool) => (
    <div
      className="uib-shell-tool"
      hidden={tool.id !== current.id || undefined}
      id={panelId(tool)}
      key={tool.id}
      {...(mode === 'tabs'
        ? { role: 'tabpanel', 'aria-labelledby': tabId(tool) }
        : mode === 'dropdown'
          ? { role: 'region', 'aria-label': tool.label }
          : {})}
    >
      {tool.content}
    </div>
  ));

  const menu = (
    <Dropdown.TriggerContext>
      <Dropdown.Trigger
        // Named by the tool it shows first, as it reads, then by what it does (WCAG 2.5.3).
        aria-label={t('shell.toolChoice', { tool: current.label })}
        className="uib-shell-tools-trigger"
        variant="tertiary"
      >
        {named(current, 'uib-shell-tools-label')}
        <ChevronDownIcon aria-hidden className="uib-shell-tools-chevron" />
      </Dropdown.Trigger>
      <Dropdown
        className="uib-shell-tools-menu"
        // Pinned to neutral as the profile menu: the tools are the panel's own, grey as drawn.
        data-color="neutral"
        onClose={() => setMenuOpen(false)}
        onOpen={() => setMenuOpen(true)}
        open={menuOpen}
        placement="bottom-start"
      >
        {/* Buttons, not role="menu", as Designsystemet recommends without the arrows. */}
        <Dropdown.List>
          {tools.map((tool) => (
            <Dropdown.Item key={tool.id}>
              <Dropdown.Button
                aria-current={tool.id === current.id || undefined}
                onClick={() => {
                  setMenuOpen(false);
                  choose(tool.id);
                }}
              >
                {named(tool, 'uib-shell-tools-label')}
              </Dropdown.Button>
            </Dropdown.Item>
          ))}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  );

  const switcher =
    mode === 'heading' ? (
      <Heading className="uib-shell-tools-heading" data-size="xs" level={headingLevel}>
        {current.label}
      </Heading>
    ) : mode === 'tabs' ? (
      <div
        aria-label={t('shell.tools')}
        className="uib-shell-tools-tabs"
        // On the row itself: the row may stand in the panel's pinned region, apart from the tools.
        data-variant={tinted ? 'tinted' : undefined}
        role="tablist"
      >
        {tools.map((tool) => {
          const selected = tool.id === current.id;
          return (
            <button
              aria-controls={panelId(tool)}
              aria-selected={selected}
              className="uib-shell-tools-tab ds-focus"
              id={tabId(tool)}
              key={tool.id}
              onClick={() => choose(tool.id)}
              onKeyDown={onTabKey}
              ref={(element) => {
                tabs.current.set(tool.id, element);
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {named(tool, 'uib-shell-tools-label')}
            </button>
          );
        })}
      </div>
    ) : tinted ? (
      menu
    ) : (
      <Field className="uib-shell-tools-choice">
        <Label className="ds-sr-only">{t('shell.tools')}</Label>
        <Select value={current.id} onChange={(event) => choose(event.currentTarget.value)}>
          {tools.map((tool) => (
            <Select.Option key={tool.id} value={tool.id}>
              {tool.label}
            </Select.Option>
          ))}
        </Select>
      </Field>
    );

  return (
    <div
      className={classes('uib-shell-tools', className)}
      data-mode={mode}
      data-variant={tinted ? 'tinted' : undefined}
    >
      {pinIn === undefined ? switcher : pinIn && createPortal(switcher, pinIn)}
      {panels}
    </div>
  );
};
