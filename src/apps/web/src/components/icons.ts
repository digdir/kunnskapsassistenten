/**
 * Icons under role names. The one place the vendor's side-named icons may appear, since the
 * naming rule is about our own vocabulary. The glyphs picture today's layout.
 */
export {
  SidebarLeftIcon as PrimarySidebarIcon,
  SidebarRightIcon as SecondarySidebarIcon,
  SidebarBothIcon as BothSidebarsIcon,
  // The arrow's direction belongs to today's layout; a moved panel keeps the
  // role and may need another glyph.
  ArrowLeftIcon as BackIcon,
} from '@navikt/aksel-icons';

// No side in these names, but they go through here so changing a glyph is a one-line change.
export { FunnelIcon as FilterIcon, PencilWritingIcon as NewThreadIcon } from '@navikt/aksel-icons';
