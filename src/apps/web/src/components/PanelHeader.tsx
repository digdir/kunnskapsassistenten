import { Heading } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';

export type PanelHeaderProps = {
  /** Norwegian. The panel's visible heading. */
  title: string;
  /**
   * Heading level, semantics only. The shell renders the page title as
   * level 1, so a panel heading is level 2 unless it sits inside another
   * section.
   */
  level?: 2 | 3 | 4 | 5 | 6;
  /** Visual size, independent of `level`. */
  size?: '2xs' | 'xs' | 'sm' | 'md';
  /** Buttons and links that belong to the panel, beside the heading. */
  actions?: ReactNode;
  /** Text under the heading, such as «Søk i kildene». */
  children?: ReactNode;
};

/**
 * The top of a panel: a heading, optional actions beside it, optional text
 * under it. Every panel uses this so the three of them line up.
 */
export function PanelHeader({
  title,
  level = 2,
  size = 'xs',
  actions,
  children,
}: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-header__top">
        <Heading level={level} data-size={size}>
          {title}
        </Heading>
        {actions ? <div className="panel-header__actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
