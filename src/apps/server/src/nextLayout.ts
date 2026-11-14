/**
 * `KA_NEXT_LAYOUT`: the layout the next client draws, made in genki's builder (decisions/0017).
 *
 * Unset, the next client draws genki's template `knowledge-assistant-next` with KA's own profile,
 * as before, and nothing here runs. Set, it is what the builder's «Kopier oppsettet» gives, an
 * `AssistantLayout` v1 with its `profile`: the JSON itself, or the path of a file holding it. The
 * server reads it once, at start, and checks it with genki's own checks, `isAssistantLayout` and
 * `layoutProblems` from the next client's vendored ui-blocks, so a layout the builder would refuse
 * is refused here too. `/api/next/me` hands it to the page.
 *
 * A message names each problem by genki's rule and where it is, never the value of the variable
 * or the file's text: an error from `JSON.parse` would quote it.
 */
import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

/** The layout as the builder gave it, checked. The page reads it with genki's own types. */
export type NextLayout = Readonly<Record<string, unknown>>;

type Problem = { rule: string } & Record<string, unknown>;

/** What the server needs of genki's checks. */
export interface LayoutChecks {
  isAssistantLayout: (value: unknown) => boolean;
  layoutProblems: (layout: never) => readonly Problem[];
}

/** The most the JSON may be. A layout's profile may be 32 kB (genki's `PROFILE_MAX_BYTES`). */
export const LAYOUT_MAX_BYTES = 64 * 1024;

const VENDOR = new URL('../../web-next/vendor/genki/', import.meta.url);
const CHECKS = new URL('ui-blocks/src/builder/layout.ts', VENDOR);

let hooked = false;

/**
 * genki's checks, run as the vendored source is. Its files import each other as `.js`, as tsc and
 * a bundler resolve them, while Node runs the `.ts` files as they are; so, for files under
 * vendor/genki only, a relative `.js` import is its `.ts` file when there is one. Registered on
 * first use, so an unset `KA_NEXT_LAYOUT` changes nothing in how modules load.
 */
export function layoutChecks(): LayoutChecks {
  if (!hooked) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (context.parentURL?.startsWith(VENDOR.href) && /^\.\.?\/.*\.js$/.test(specifier)) {
          try {
            return nextResolve(`${specifier.slice(0, -'.js'.length)}.ts`, context);
          } catch {
            // A file that is JavaScript.
          }
        }
        return nextResolve(specifier, context);
      },
    });
    hooked = true;
  }
  return createRequire(import.meta.url)(fileURLToPath(CHECKS)) as LayoutChecks;
}

/** The layout, or why it is refused, with genki's problems one by one when it broke its rules. */
export type ReadLayout =
  { layout: NextLayout } | { refused: string; problems?: readonly string[] };

/** The text: the JSON itself when it starts with `{` or `[`, else the file it names. */
function textOf(raw: string): string | ReadLayout {
  if (raw.startsWith('{') || raw.startsWith('[')) {
    if (Buffer.byteLength(raw) > LAYOUT_MAX_BYTES)
      return { refused: `it is larger than ${LAYOUT_MAX_BYTES} bytes.` };
    return raw;
  }
  // One open file, measured and read through the same descriptor, so what is read is what was
  // measured.
  let fd: number | undefined;
  try {
    fd = openSync(raw, 'r');
    if (fstatSync(fd).size > LAYOUT_MAX_BYTES)
      return { refused: `the file is larger than ${LAYOUT_MAX_BYTES} bytes.` };
    return readFileSync(fd, 'utf8');
  } catch {
    return {
      refused: 'it is neither JSON that starts with { nor the path of a file that can be read.',
    };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** One of genki's problems, by its rule and what it names: a path, a block, a zone, a limit. */
const described = ({ rule, ...where }: Problem) => `${rule} ${JSON.stringify(where)}`;

/** The layout in `raw`, the JSON or a file's path, or why it is refused. */
export function readLayout(raw: string, checks: () => LayoutChecks = layoutChecks): ReadLayout {
  const text = textOf(raw);
  if (typeof text !== 'string') return text;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { refused: 'it is not valid JSON.' };
  }
  let genki: LayoutChecks;
  try {
    genki = checks();
  } catch {
    return {
      refused: "genki's layout checks could not be loaded from apps/web-next/vendor/genki.",
    };
  }
  if (!genki.isAssistantLayout(value))
    return {
      refused:
        'it is not an AssistantLayout v1: version 1, the zones primary, main and secondary as lists of blocks, a look genki knows, and a profile of the right shape.',
    };
  const problems = genki.layoutProblems(value as never);
  if (problems.length > 0)
    return {
      refused: `it breaks ${problems.length === 1 ? 'one of genki’s layout rules' : `${problems.length} of genki’s layout rules`}:`,
      problems: problems.map(described),
    };
  return { layout: value as NextLayout };
}

/**
 * The layout from `KA_NEXT_LAYOUT`, or `undefined` when it is unset or empty. A layout with a
 * problem stops the server when the next client is on (`enabled`). While it is off the layout is
 * not used, so the problem is warned about and must not take apps/web down.
 */
export function nextLayout(
  raw: string | undefined,
  enabled: boolean,
  checks: () => LayoutChecks = layoutChecks,
): NextLayout | undefined {
  const given = (raw ?? '').trim();
  if (!given) return undefined;
  const read = readLayout(given, checks);
  if ('layout' in read) return read.layout;
  const message = [
    `KA_NEXT_LAYOUT is refused: ${read.refused}`,
    ...(read.problems ?? []).map((problem) => `  ${problem}`),
  ].join('\n');
  if (enabled) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message}\nIgnored while KA_NEXT is off.`);
  return undefined;
}
