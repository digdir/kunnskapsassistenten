// The layout rules, ported from genki #210's `rules.ts` (its builder for new services) and driven by
// the catalogue instead of a table of their own, so there is one table. #210 names the zones
// `left`, `main` and `right`; these are the shell's `primary`, `main` and `secondary`.
import {
  blockCatalogue,
  blockSpec,
  defaultZone,
  isBlockId,
  isLook,
  placesOf,
  zones,
  type BlockId,
  type BlockOption,
  type Look,
  type Need,
  type Place,
  type Zone,
} from './catalogue.js';
import {
  isProfileData,
  profileProblems,
  type ProfileData,
  type ProfileProblem,
} from './profile.js';

export type BlockSettings = Readonly<Record<string, boolean | string>>;

export interface PlacedBlock {
  block: BlockId;
  /** Only what differs from the option's default. */
  settings?: BlockSettings | undefined;
}

/** What the builder edits, and what could be stored as a frontend definition (V2-0006). */
export interface AssistantLayout {
  version: 1;
  /** The template it started from. */
  template?: string | undefined;
  /**
   * The look it is drawn in. Without it, the template's (`templateLook`), as every layout was
   * drawn before the look was its own setting.
   */
  look?: Look | undefined;
  zones: Readonly<Record<Zone, readonly PlacedBlock[]>>;
  /**
   * The words it is drawn with: the assistant's name, its suggestions, each collection's fields
   * and links, the settings note. A host's own profile wins where it says something; this fills
   * the rest, so a service made in the builder needs no host code to look like itself.
   */
  profile?: ProfileData | undefined;
}

/**
 * The builder's state: the layout, and where each movable block goes when it is turned on again
 * (#210's `chosen`). `chosen` is screen state and stays out of the layout.
 */
export interface BuilderState {
  layout: AssistantLayout;
  chosen: Partial<Record<BlockId, Place>>;
  /**
   * The blocks a change of service turned off, each with its zone and options, so a service that
   * can back them again puts them back (`fitService`). Screen state too; a template forgets them.
   */
  held?: readonly HeldBlock[] | undefined;
}

/** A block a service could not back, where it stood and as it was set. */
export interface HeldBlock {
  zone: Zone;
  placed: PlacedBlock;
}

export const emptyLayout: AssistantLayout = {
  version: 1,
  zones: { primary: [], main: [], secondary: [] },
};

/**
 * The look a template draws when the layout names none: `next` for `knowledge-assistant-next`,
 * whose layouts were drawn in it before the look was their own setting, and `current` for the rest.
 */
export const templateLook = (template: string | undefined): Look =>
  template === 'knowledge-assistant-next' ? 'next' : 'current';

/** The look the layout is drawn in: its own, else its template's. */
export const lookOf = (layout: AssistantLayout): Look =>
  isLook(layout.look) ? layout.look : templateLook(layout.template);

/** The layout in another look, with its blocks and their options as they are. */
export const withLook = (state: BuilderState, look: Look): BuilderState => ({
  ...state,
  layout: { ...state.layout, look },
});

/** The layout with another profile, or none, its blocks and look as they are. */
export const withProfile = (
  state: BuilderState,
  profile: ProfileData | undefined,
): BuilderState => {
  const layout = { ...state.layout };
  if (profile) layout.profile = profile;
  else delete layout.profile;
  return { ...state, layout };
};

const orderIn = (zone: Zone, id: BlockId) => blockSpec(id).order[zone] ?? 0;

/** The zone's blocks in the catalogue's order, whatever order they were turned on in. */
const sorted = (zone: Zone, placed: readonly PlacedBlock[]) =>
  [...placed].sort((a, b) => orderIn(zone, a.block) - orderIn(zone, b.block));

/** Where the block stands, the first of its zones when it stands in two, or `undefined` when off. */
export const zoneOf = (layout: AssistantLayout, id: BlockId): Zone | undefined =>
  zones.find((zone) => layout.zones[zone].some((placed) => placed.block === id));

/** Every zone the block stands in, in the zones' order. */
export const zonesOf = (layout: AssistantLayout, id: BlockId): Zone[] =>
  zones.filter((zone) => layout.zones[zone].some((placed) => placed.block === id));

/** Where the block stands as the builder offers it: its zone, `both`, or `undefined` when off. */
export const placedAt = (layout: AssistantLayout, id: BlockId): Place | undefined => {
  const at = zonesOf(layout, id);
  return at.length > 1 ? 'both' : at[0];
};

export const isOn = (layout: AssistantLayout, id: BlockId) => zoneOf(layout, id) !== undefined;

/** The blocks that stand in a zone, in the zone's order. */
export const blocksIn = (layout: AssistantLayout, zone: Zone): BlockId[] =>
  sorted(zone, layout.zones[zone]).map((placed) => placed.block);

/** Where a block stands, else where it was chosen to go, else its default zone. */
export const placeOf = (state: BuilderState, id: BlockId): Place =>
  placedAt(state.layout, id) ?? state.chosen[id] ?? defaultZone(id);

const without = (layout: AssistantLayout, id: BlockId) =>
  Object.fromEntries(
    zones.map((zone) => [zone, layout.zones[zone].filter((placed) => placed.block !== id)]),
  ) as Record<Zone, PlacedBlock[]>;

const findPlaced = (layout: AssistantLayout, id: BlockId) =>
  zones.flatMap((zone) => layout.zones[zone]).find((placed) => placed.block === id);

/** Puts the block in the zone, or in both its zones, and out of any other, its options kept. */
const put = (layout: AssistantLayout, id: BlockId, place: Place): AssistantLayout => {
  const kept = findPlaced(layout, id) ?? { block: id };
  const rest = without(layout, id);
  const into = place === 'both' ? blockSpec(id).zones : [place];
  for (const zone of into) rest[zone] = sorted(zone, [...rest[zone], kept]);
  return { ...layout, zones: rest };
};

/** On, where it stood last or was chosen to go. A block that is on stays where it is. */
export const turnOn = (state: BuilderState, id: BlockId): BuilderState =>
  isOn(state.layout, id) ? state : { ...state, layout: put(state.layout, id, placeOf(state, id)) };

/** Off. A movable block remembers where it stood, for when it is turned on again. */
export const turnOff = (state: BuilderState, id: BlockId): BuilderState => {
  const at = placedAt(state.layout, id);
  if (!at) return state;
  return {
    ...state,
    layout: { ...state.layout, zones: without(state.layout, id) },
    chosen: blockSpec(id).zones.length > 1 ? { ...state.chosen, [id]: at } : state.chosen,
  };
};

/**
 * To another zone it may stand in; a zone it may not stand in changes nothing. A block that is
 * off is not turned on, but goes there when it is.
 */
export const moveTo = (state: BuilderState, id: BlockId, place: Place): BuilderState => {
  if (!placesOf(id).includes(place)) return state;
  return {
    ...state,
    layout: isOn(state.layout, id) ? put(state.layout, id, place) : state.layout,
    chosen: { ...state.chosen, [id]: place },
  };
};

/**
 * The layout fitted to another service: the blocks it cannot back are turned off and held, and the
 * blocks an earlier service turned off come back where they stood, with their options, once a
 * service can back them. A block the reader turned off by hand is not held, and stays off.
 */
export const fitService = (
  state: BuilderState,
  offered: (id: BlockId) => boolean,
): { state: BuilderState; dropped: BlockId[]; restored: BlockId[] } => {
  const dropped: BlockId[] = [];
  let held: HeldBlock[] = [...(state.held ?? [])];
  let layout = state.layout;
  for (const zone of zones) {
    for (const placed of state.layout.zones[zone]) {
      if (offered(placed.block)) continue;
      // Held where it stands now, in each of its zones, and no longer where it stood before.
      if (!dropped.includes(placed.block)) {
        dropped.push(placed.block);
        held = held.filter((entry) => entry.placed.block !== placed.block);
      }
      held.push({ zone, placed });
      layout = { ...layout, zones: without(layout, placed.block) };
    }
  }
  const restored: BlockId[] = [];
  const kept: HeldBlock[] = [];
  for (const entry of held) {
    const id = entry.placed.block;
    // A block held in both its zones comes back to both.
    const back = restored.includes(id);
    if (!back && (dropped.includes(id) || !offered(id) || isOn(layout, id))) {
      if (!isOn(layout, id)) kept.push(entry);
      continue;
    }
    const rest = layout.zones[entry.zone].filter((placed) => placed.block !== id);
    layout = {
      ...layout,
      zones: { ...layout.zones, [entry.zone]: sorted(entry.zone, [...rest, entry.placed]) },
    };
    if (!back) restored.push(id);
  }
  return {
    state: { ...state, layout, ...(kept.length > 0 ? { held: kept } : { held: undefined }) },
    dropped,
    restored,
  };
};

/** On, in the zone given: what a drop into a zone does. A zone it may not stand in changes nothing. */
export const placeIn = (state: BuilderState, id: BlockId, place: Place): BuilderState =>
  placesOf(id).includes(place) ? moveTo(turnOn(state, id), id, place) : state;

/** The value of each option, the defaults filled in. */
export const settingsOf = (layout: AssistantLayout, id: BlockId): BlockSettings => {
  const stored = findPlaced(layout, id)?.settings ?? {};
  return Object.fromEntries(
    blockSpec(id).options.map((option) => [option.id, stored[option.id] ?? option.default]),
  );
};

/** One option changed. Only what differs from the default is kept. */
export const withSetting = (
  state: BuilderState,
  id: BlockId,
  option: string,
  value: boolean | string,
): BuilderState => {
  const spec = blockSpec(id).options.find((o) => o.id === option);
  const at = zonesOf(state.layout, id);
  if (!spec || at.length === 0) return state;
  // A block in both its zones has one set of options, kept alike in each.
  const zoneMap = { ...state.layout.zones };
  for (const zone of at)
    zoneMap[zone] = zoneMap[zone].map((p) => {
      if (p.block !== id) return p;
      const rest = Object.fromEntries(
        Object.entries(p.settings ?? {}).filter(([key]) => key !== option),
      );
      const settings = value === spec.default ? rest : { ...rest, [option]: value };
      return Object.keys(settings).length > 0 ? { block: id, settings } : { block: id };
    });
  return { ...state, layout: { ...state.layout, zones: zoneMap } };
};

// The secondary panel's rule is the shell's: the builder reads the blocks, never the other way.
export { toolMode, type ToolMode } from '../shell/toolMode.js';

// ── Checks, from V2-0006 ──

export type LayoutProblem =
  | { rule: 'unknown-block'; block: string; zone: Zone }
  | { rule: 'zone-not-allowed'; block: BlockId; zone: Zone }
  | { rule: 'placed-twice'; block: BlockId }
  | { rule: 'not-built'; block: BlockId }
  | {
      rule: 'missing-partner';
      block: BlockId;
      option?: string;
      /** The first of the blocks that would do, and the need that names them all. */
      partner: BlockId;
      need: Need;
    }
  | { rule: 'needs-unmet'; block: BlockId; option?: string; need: Need }
  | ProfileProblem;

/** The blocks a `component:*` need asks for, any one of which will do; none for other needs. */
export const partnersOf = (need: Need): BlockId[] =>
  need.startsWith('component:') ? need.slice('component:'.length).split('|').filter(isBlockId) : [];

/**
 * The options the layout itself turns on. One left at its default asks nothing: it is simply not
 * in force where its needs are not met, as Fotnoter on by default in a layout without Kilder.
 */
const storedOn = (layout: AssistantLayout, id: BlockId): BlockOption[] => {
  const stored = findPlaced(layout, id)?.settings ?? {};
  return blockSpec(id).options.filter((option) => stored[option.id] === true);
};

/**
 * Every rule a layout breaks, each with the rule's name, as genki reports a problem elsewhere:
 * - every block is in the catalogue and stands in a zone it may;
 * - no block is placed twice, but one that may stand in both its zones, once in each;
 * - a block that is not built is not placed;
 * - a block, and each option the layout turns on, comes with the blocks it depends on
 *   (`component:*`);
 * - their other needs are met, when `met` says which are;
 * - the profile, when there is one, keeps to its limits (`profileProblems`).
 */
export const layoutProblems = (
  layout: AssistantLayout,
  met?: (need: Need) => boolean,
): LayoutProblem[] => {
  const problems: LayoutProblem[] = [];
  const seen = new Map<BlockId, Zone[]>();
  for (const zone of zones) {
    for (const placed of layout.zones[zone]) {
      const id: unknown = placed.block;
      if (!isBlockId(id)) {
        problems.push({ rule: 'unknown-block', block: String(id), zone });
        continue;
      }
      const spec = blockSpec(id);
      const at = seen.get(id) ?? [];
      // Twice is once too many, except a block that may stand in both its zones, once in each.
      if (at.length > 0 && (!spec.both || at.includes(zone)))
        problems.push({ rule: 'placed-twice', block: id });
      seen.set(id, [...at, zone]);
      if (!spec.zones.includes(zone)) problems.push({ rule: 'zone-not-allowed', block: id, zone });
      if (spec.status === 'planned') problems.push({ rule: 'not-built', block: id });
    }
  }
  for (const id of seen.keys()) {
    const check = (needs: readonly Need[], option?: string) => {
      for (const need of needs) {
        const [partner, ...others] = partnersOf(need);
        if (partner) {
          if (!seen.has(partner) && !others.some((other) => seen.has(other)))
            problems.push({
              rule: 'missing-partner',
              block: id,
              partner,
              need,
              ...(option ? { option } : {}),
            });
        } else if (met && !met(need)) {
          problems.push({ rule: 'needs-unmet', block: id, need, ...(option ? { option } : {}) });
        }
      }
    };
    check(blockSpec(id).needs);
    for (const option of storedOn(layout, id)) check(option.needs ?? [], option.id);
  }
  if (layout.profile) problems.push(...profileProblems(layout.profile));
  return problems;
};

/**
 * Whether an option is in force: on, drawn in the layout's look, with a block it depends on placed
 * for each such need, and its other needs met when `met` says which are. Fotnoter on Chat is off
 * while both Kilder and Dokumentvisning are, whatever the switch says, so a footnote never points
 * nowhere; follow-ups are off in the next look, which draws none.
 */
export const optionInForce = (
  layout: AssistantLayout,
  id: BlockId,
  option: string,
  met?: (need: Need) => boolean,
) => {
  const spec = blockSpec(id).options.find((o) => o.id === option);
  if (!spec || spec.status === 'planned' || !isOn(layout, id)) return false;
  if (spec.looks && !spec.looks.includes(lookOf(layout))) return false;
  const value = settingsOf(layout, id)[option];
  if (value !== true) return false;
  return (spec.needs ?? []).every((need) => {
    const partners = partnersOf(need);
    return partners.length > 0
      ? partners.some((partner) => isOn(layout, partner))
      : !met || met(need);
  });
};

/** Each block in its zone's order, and nothing the catalogue does not hold. */
export const normalised = (layout: AssistantLayout): AssistantLayout => ({
  ...layout,
  zones: Object.fromEntries(
    zones.map((zone) => [
      zone,
      sorted(
        zone,
        layout.zones[zone].filter((placed) => isBlockId(placed.block)),
      ),
    ]),
  ) as Record<Zone, PlacedBlock[]>,
});

/** Every built block on, in its default zone: where the builder starts. */
export const defaultLayout: AssistantLayout = normalised({
  version: 1,
  zones: Object.fromEntries(
    zones.map((zone) => [
      zone,
      blockCatalogue
        .filter((spec) => spec.status === 'built' && defaultZone(spec.id) === zone)
        .map((spec) => ({ block: spec.id })),
    ]),
  ) as Record<Zone, PlacedBlock[]>,
});

/**
 * A layout read from JSON, when it is one: the shape only, not the rules. A look must be known,
 * and a profile must be data of the right shape (`isProfileData`).
 */
export const isAssistantLayout = (value: unknown): value is AssistantLayout => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as {
    version?: unknown;
    look?: unknown;
    zones?: unknown;
    profile?: unknown;
  };
  if (candidate.version !== 1 || typeof candidate.zones !== 'object' || candidate.zones === null)
    return false;
  if (candidate.look !== undefined && !isLook(candidate.look)) return false;
  if (candidate.profile !== undefined && !isProfileData(candidate.profile)) return false;
  const zoneMap = candidate.zones as Record<string, unknown>;
  return zones.every(
    (zone) =>
      Array.isArray(zoneMap[zone]) &&
      (zoneMap[zone] as unknown[]).every(
        (placed) =>
          typeof placed === 'object' &&
          placed !== null &&
          typeof (placed as { block?: unknown }).block === 'string',
      ),
  );
};
