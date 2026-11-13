# Feature flags

Flags are trials, meant to be tried side by side and removed once the choice is
made. The other settings are choices that stay. Every flag is off until someone
turns it on, and they are stored per browser under `ka.flags.v1`. «Logg ut»
deletes them (`beforeLogout` in `src/api/session.ts`).

## Turning a flag on

- **The page:** «Eksperimenter» on Innstillinger (`/innstillinger`), linked
  from the foot of the navigation panel. One switch per flag. The old address
  `#feature-flags` lands there.
- **A link:** `?flagg=year-ranges`, or several with commas (`?flagg=a,b`). The
  link only turns flags on. The parameter is taken out of the address and
  Innstillinger opens, so whoever got the link sees what was turned on and can
  turn it off. Unknown ids do nothing.

## The flags

| Id                     | What                                                                                         | Issue                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `year-ranges`          | The year field takes periods, such as 2021 or 2023–2028, and consecutive years are one tag   | [digdir/kunnskapsassistenten#115](https://github.com/digdir/kunnskapsassistenten/issues/115) |
| `compact-filter-chips` | One tag when many values in a field are chosen; all chosen is one tag without the flag       | [digdir/kunnskapsassistenten#116](https://github.com/digdir/kunnskapsassistenten/issues/116) |
| `filters-right-panel`  | The filters above the sources in the sources panel, the navigation panel with threads only   | [digdir/kunnskapsassistenten#84](https://github.com/digdir/kunnskapsassistenten/issues/84)   |
| `excerpt-citations`    | Answers from the genki environment that cites by excerpt; offered only where the BFF has one | [digdir/kunnskapsassistenten#237](https://github.com/digdir/kunnskapsassistenten/issues/237) |

## Flags the server carries out

A flag with `needsServer` is done by the BFF, not the browser. Innstillinger
shows it only when `/api/v2/me` offers it, and while it is on every call to
the BFF carries a header saying so (`src/api/trials.ts`). The BFF alone
decides what that means; the browser never names a genki environment.

- `excerpt-citations`: `/api/v2/me` says `excerptTrial: true` when the server
  has `KA_EXCERPT_ENVIRONMENT`, and the header is
  `KA-Trial-Excerpt-Citations: 1` (`src/decisions/0016`).

## Adding and removing

- **Adding:** a row in `FLAGS` in `flags.ts`, with an id, a title, a one-line
  description and a link to the issue. Read the flag with `useFlag('id')`, or
  `isFlagOn('id')` outside a component.
- **Removing:** once the choice is made, delete the row and every `useFlag`
  call for it. TypeScript reports the calls that are left. A flag stored in a
  browser but not in the list reads as off and is dropped on the next write,
  and a link naming it turns nothing on.
- Never reuse an id for another trial: an old link would turn on something
  other than what it promised.

## Retired ids

| Id               | Outcome                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile-top-row` | Standard below 774 px: the panel buttons in a row at the top ([digdir/kunnskapsassistenten#120](https://github.com/digdir/kunnskapsassistenten/issues/120)) |
