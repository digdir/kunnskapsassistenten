# Kunnskapsassistenten V2 (draft)

**This is a draft.** V2 is a library of assistant components, built on
Designsystemet, and a few kits that put them together. KA is to be built from
it, and organisations will later build their own assistant from it in genki's
portal. The plan is issue #167, with its sub-issues #168 to #182. Nothing here
is final until the team has decided; for now this is a skeleton, with no
components yet.

`src/apps/web` is V1, today's app. It is not changed for V2, so the two can be
compared. Nothing in V2 imports from it. The rules for working here, and the
contract with genki, are in [CLAUDE.md](CLAUDE.md).

## What is here

| Path          | What                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`   | The contract with genki and the conventions for V2                                                                                                                                         |
| `kits/`       | One JSON file per kit: layout, core, optional components with defaults, and what each needs from the service. **A draft**: a first proposal, to check with the team and the service owners |
| `components/` | The component library, an npm workspace package. Empty for now                                                                                                                             |
| `playground/` | Every component alone and together (#169), a Vite app. Empty for now                                                                                                                       |

## Commands

From `src/`, Node 24. The root scripts CI runs cover V2's two packages as well
as V1:

```sh
npm run typecheck
npm test
npm run build
npm run format:check
```
