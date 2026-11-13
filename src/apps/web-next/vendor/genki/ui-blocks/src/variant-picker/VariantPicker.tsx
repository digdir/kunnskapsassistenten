import { Dropdown } from '@digdir/designsystemet-react';
import { CheckmarkIcon, ChevronDownIcon } from '@navikt/aksel-icons';
import { Fragment, useId, useRef, useState } from 'react';
import { useT } from './i18n.js';

export interface VariantOption {
  /** What the app sends as `model`, the platform's `id`. */
  id: string;
  /** The platform's `_variant_title`. */
  title: string;
  /** One line on what the variant is for. */
  description?: string | undefined;
  /** The service it belongs to, the platform's `_service_title`, which heads its variants. */
  service?: string | undefined;
}

/** The variants under their service, in the order each service first comes. */
const byService = (variants: readonly VariantOption[]) => {
  const groups: { service: string | undefined; variants: VariantOption[] }[] = [];
  for (const variant of variants) {
    const group = groups.find(({ service }) => service === variant.service);
    if (group) group.variants.push(variant);
    else groups.push({ service: variant.service, variants: [variant] });
  }
  return groups;
};

export interface VariantPickerProps {
  /** The variants a person may pick, the platform's `_pickable` rows of one service. */
  variants: readonly VariantOption[];
  /** The id of the variant in use. Without it the button says «Standard». */
  value?: string | undefined;
  /** The person chose a variant, by its id. As `CorpusChoice`, a controlled choice of one. */
  onChange?: ((id: string) => void) | undefined;
  /** @deprecated `value`, the name every block uses; kept until hosts have moved. */
  chosen?: string | undefined;
  /** @deprecated `onChange`, the name every block uses; kept until hosts have moved. */
  onChoose?: ((id: string) => void) | undefined;
  /**
   * Designsystemet's `data-color` for the button and the list. Neutral unless given, as
   * kunnskapsassistenten draws its picker in the question field.
   */
  color?: string | undefined;
  /** The list's titles as headings at this level; none by default, so the outline stays whole. */
  headingLevel?: 2 | 3 | 4 | 5 | 6 | undefined;
  /** On the button, for the block it sits in to place it. */
  className?: string | undefined;
}

const colored = (color: string | undefined) => (color ? { 'data-color': color } : {});

/**
 * Which variant of the service answers. A `Dropdown` of buttons, not an ARIA menu, which without
 * arrow keys and typeahead is worse than none. The chosen one says so with `aria-current`.
 */
export const VariantPicker = ({
  variants,
  value,
  onChange,
  chosen: oldChosen,
  onChoose,
  color = 'neutral',
  headingLevel,
  className,
}: VariantPickerProps) => {
  const t = useT();
  const titleId = useId();
  const chosen = value ?? oldChosen;
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (variants.length < 2) return null;
  const title =
    variants.find((variant) => variant.id === chosen)?.title ?? t('variantPicker.default');

  const choose = (id: string) => {
    setOpen(false);
    (onChange ?? onChoose)?.(id);
    trigger.current?.focus();
  };

  return (
    <Dropdown.TriggerContext>
      {/* The name holds what the button shows, so voice control still finds it (WCAG 2.5.3). */}
      <Dropdown.Trigger
        aria-label={t('variantPicker.label', { title })}
        className={['uib-variant-picker-trigger', className].filter(Boolean).join(' ')}
        {...colored(color)}
        data-size="sm"
        ref={trigger}
        variant="tertiary"
      >
        <span className="uib-variant-picker-current">{title}</span>
        <ChevronDownIcon aria-hidden />
      </Dropdown.Trigger>
      <Dropdown
        className="uib-variant-picker-list"
        {...colored(color)}
        data-overscroll="contain"
        data-size="sm"
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        placement="top-end"
      >
        {byService(variants).map((group, index) => (
          <Fragment key={`${index}:${group.service ?? ''}`}>
            {/* Designsystemet's list heading either way; an outline entry only when asked. */}
            <Dropdown.Heading
              id={`${titleId}-${index}`}
              level={headingLevel ?? 2}
              role={headingLevel === undefined ? 'none' : undefined}
            >
              {group.service ?? t('variantPicker.heading')}
            </Dropdown.Heading>
            <Dropdown.List aria-labelledby={`${titleId}-${index}`}>
              {group.variants.map((variant) => {
                const isChosen = variant.id === chosen;
                return (
                  <Dropdown.Item key={variant.id}>
                    <Dropdown.Button
                      aria-current={isChosen ? 'true' : undefined}
                      className="uib-variant-picker-option"
                      onClick={() => choose(variant.id)}
                    >
                      <span className="uib-variant-picker-text">
                        <span className="uib-variant-picker-name">{variant.title}</span>
                        {variant.description ? (
                          <span className="uib-variant-picker-description">
                            {variant.description}
                          </span>
                        ) : null}
                      </span>
                      {isChosen ? (
                        <CheckmarkIcon aria-hidden className="uib-variant-picker-check" />
                      ) : null}
                    </Dropdown.Button>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.List>
          </Fragment>
        ))}
      </Dropdown>
    </Dropdown.TriggerContext>
  );
};
