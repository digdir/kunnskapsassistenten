#!/usr/bin/env bash
#
# Headless WCAG-sjekk av en branch i kunnskapsassistenten-frontend.
#
#   docs/review/tools/a11y.sh <navn> [rute ...]
#
# «navn» blir prefiks på filnavnene, typisk branchnavnet med bindestrek:
#
#   docs/review/tools/a11y.sh feat-chat / /threads/demo-1
#
# For hver rute kjøres BÅDE lys og mørk modus, og for hver av dem:
#
#   * axe-core 4.x med WCAG 2.0/2.1/2.2 A og AA pluss best-practice
#   * landemerker, overskriftsrekkefølge og aria-live-regioner
#   * fokusrekkefølge: Tab gjennom hele viewet, med navn, :focus-visible,
#     outline og box-shadow per steg
#   * rot-attributtene og at 1rem faktisk er 16 px (data-size-fella)
#   * skjermbilde
#
# Mørk modus tvinges ved å sette data-color-scheme på <html>, ikke ved å
# emulere operativsystemet. Grunnen: står attributtet hardkodet i index.html,
# gjør prefers-color-scheme ingenting, og da hadde mørk modus aldri blitt
# sett. Hva appen FAKTISK sender ut rapporteres som «shipped» i JSON-en, så
# begge spørsmålene besvares: er paletten god, og er den i det hele tatt
# tilgjengelig for brukeren.
#
# Alt skrives til:
#   ~/.cache/ka-review/runs/<navn>/  rådata som JSON, utenfor repoet
#   design/skjermbilder-frontend/    skjermbilder, som byggereglene sier
#
# Rådataene ligger utenfor repoet med vilje. Prettier leser .prettierignore,
# ikke .gitignore, så artefakter inne i treet hadde brutt format:check, og
# .prettierignore er grunnmurens fil. Funnene hører i rapportene uansett.
#
# Krever playwright-cli (globalt installert) og laster ned axe-core til
# ~/.cache/ka-review/ ved første kjøring. Ingenting legges i package.json;
# bare grunnmuren legger til avhengigheter.
#
# Miljøvariabler: KA_PORT (5177), KA_SESSION (ka-review), KA_KEEP=1 for å la
# nettleseren stå åpen mellom kjøringer, KA_VIEWPORT (1440x900).

set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" || "$NAME" == "-h" || "$NAME" == "--help" ]]; then
  sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
fi
shift

ROUTES=("$@")
if [[ ${#ROUTES[@]} -eq 0 ]]; then
  ROUTES=("/" "/threads/demo-1")
fi

PORT="${KA_PORT:-5177}"
SESSION="${KA_SESSION:-ka-review}"
VIEWPORT="${KA_VIEWPORT:-1440x900}"
VW="${VIEWPORT%x*}"
VH="${VIEWPORT#*x}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
AXE_DIR="$HOME/.cache/ka-review"
AXE="$AXE_DIR/axe.min.js"
AXE_URL="https://cdn.jsdelivr.net/npm/axe-core@4/axe.min.js"

# Finn paraplymappa ved å gå oppover til design/INDEX.md dukker opp, slik at
# skriptet virker fra et arbeidstre og fra hovedsjekkouten.
UMBRELLA="$REPO"
while [[ "$UMBRELLA" != "/" && ! -f "$UMBRELLA/design/INDEX.md" ]]; do
  UMBRELLA="$(dirname "$UMBRELLA")"
done
if [[ -f "$UMBRELLA/design/INDEX.md" ]]; then
  SHOTS="$UMBRELLA/design/skjermbilder-frontend"
else
  SHOTS="$AXE_DIR/runs/$NAME/skjermbilder"
  echo "advarsel: fant ikke design/INDEX.md oppover, skjermbilder havner i $SHOTS" >&2
fi

RUNS="${KA_RUNS:-$AXE_DIR/runs/$NAME}"
mkdir -p "$RUNS" "$SHOTS" "$AXE_DIR"

if [[ ! -s "$AXE" ]]; then
  echo "henter axe-core til $AXE"
  curl -fsSL -o "$AXE" "$AXE_URL"
fi

# Dev-serveren: start den bare hvis porten er ledig, og stopp da etter oss.
DEV_PID=""
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "bruker dev-serveren som alt kjører på $PORT"
else
  echo "starter dev-server på $PORT"
  ( cd "$REPO" && npm run dev -- --port "$PORT" --strictPort >"$RUNS/dev.log" 2>&1 & echo $! >"$RUNS/dev.pid" )
  DEV_PID="$(cat "$RUNS/dev.pid")"
  for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "http://localhost:$PORT/"; then break; fi
    perl -e 'select undef, undef, undef, 0.5'
  done
fi

cleanup() {
  if [[ -n "$DEV_PID" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
    echo "stoppet dev-serveren på $PORT"
  fi
  if [[ -z "${KA_KEEP:-}" ]]; then
    playwright-cli -s="$SESSION" close >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! curl -fsS -o /dev/null "http://localhost:$PORT/"; then
  echo "feil: fikk ikke svar fra http://localhost:$PORT/" >&2
  exit 1
fi

# playwright-cli legger snapshot-filer i arbeidsmappa, så vi står i runs/.
cd "$RUNS"
playwright-cli -s="$SESSION" open "http://localhost:$PORT/" >/dev/null

# Klipp «### Result»-blokka ut av playwright-cli-utskriften og pakk ut den
# dobbeltkodede JSON-en.
unwrap() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", () => {
      const i = s.indexOf("### Result");
      if (i < 0) {
        console.error(s.slice(0, 3000));
        process.exit(2);
      }
      const rest = s.slice(i + "### Result".length);
      const j = rest.indexOf("### Ran Playwright code");
      const body = (j < 0 ? rest : rest.slice(0, j)).trim();
      let v;
      try {
        v = JSON.parse(body);
        if (typeof v === "string") v = JSON.parse(v);
      } catch (e) {
        console.error("kunne ikke tolke resultatet:\n" + body.slice(0, 3000));
        process.exit(2);
      }
      process.stdout.write(JSON.stringify(v, null, 2));
    });
  '
}

read -r -d '' PROBE <<'JS' || true
async page => {
  const MODE = '__MODE__';
  const TARGET = '__URL__';
  const SHOT = '__SHOT__';

  await page.setViewportSize({ width: __VW__, height: __VH__ });
  await page.emulateMedia({ colorScheme: MODE, reducedMotion: 'no-preference' });
  await page.goto(TARGET, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // Hva appen faktisk sender ut, målt før vi tvinger noe.
  const shipped = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    return {
      title: document.title,
      htmlLang: document.documentElement.getAttribute('lang'),
      htmlColorScheme: document.documentElement.getAttribute('data-color-scheme'),
      htmlDataSize: document.documentElement.getAttribute('data-size'),
      htmlDataColor: document.documentElement.getAttribute('data-color'),
      bodyDataSize: document.body.getAttribute('data-size'),
      bodyDataColor: document.body.getAttribute('data-color'),
      rootFontSize: cs(document.documentElement).fontSize,
      bodyFontSize: cs(document.body).fontSize,
      sizeToken8: (() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--ds-size-8)';
        document.body.appendChild(probe);
        const px = probe.getBoundingClientRect().width;
        probe.remove();
        return px + 'px';
      })(),
      bodyBackground: cs(document.body).backgroundColor,
      bodyColor: cs(document.body).color,
      followsSystem: document.documentElement.getAttribute('data-color-scheme') === 'auto',
    };
  });

  // Tving modusen, slik at paletten kan vurderes uansett hva index.html sier.
  await page.evaluate((m) => document.documentElement.setAttribute('data-color-scheme', m), MODE);
  await page.waitForTimeout(150);

  const painted = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    const shell = document.querySelector('.shell');
    return {
      bodyBackground: cs(document.body).backgroundColor,
      bodyColor: cs(document.body).color,
      shellBackground: shell ? cs(shell).backgroundColor : null,
    };
  });

  // Sprøytes inn på nytt etter hver navigering; page.goto tømmer sida.
  await page.addScriptTag({ path: '__AXE__' });

  const axeResult = await page.evaluate(async () => {
    const res = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22aa',
          'best-practice',
        ],
      },
      resultTypes: ['violations', 'incomplete'],
    });
    const shape = (arr) =>
      arr.map((r) => ({
        id: r.id,
        impact: r.impact,
        help: r.help,
        wcag: r.tags.filter((t) => t.indexOf('wcag') === 0),
        nodes: r.nodes.slice(0, 8).map((n) => ({
          target: n.target.join(' '),
          html: String(n.html).slice(0, 220),
          why: String(n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 320),
        })),
      }));
    return {
      violations: shape(res.violations),
      incomplete: shape(res.incomplete),
      passes: res.passes.length,
    };
  });

  const focusableInDom = await page.evaluate(() => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type=hidden])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    // checkVisibility(), ikke getClientRects(): et element i en lukket
    // <details> ligger bak content-visibility: hidden, og da returnerer
    // getClientRects() den siste kjente størrelsen i stedet for ingen. Målt
    // på kildepanelet: 25 mot 21, der 21 er tallet Tab faktisk gir.
    return [...document.querySelectorAll(selector)].filter((el) =>
      el.checkVisibility({
        contentVisibilityAuto: true,
        opacityProperty: true,
        visibilityProperty: true,
      }),
    ).length;
  });

  const structure = await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const ariaName = (el) => {
      const label = el.getAttribute('aria-label');
      if (label) return clean(label);
      const by = el.getAttribute('aria-labelledby');
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => {
            const ref = document.getElementById(id);
            return ref ? ref.textContent : '';
          })
          .join(' ');
        if (clean(t)) return clean(t);
      }
      return '';
    };
    const landmarkSelector = [
      'main',
      'nav',
      'aside',
      'header',
      'footer',
      'section[aria-label]',
      'section[aria-labelledby]',
      'form[aria-label]',
      '[role=main]',
      '[role=navigation]',
      '[role=complementary]',
      '[role=banner]',
      '[role=contentinfo]',
      '[role=search]',
      '[role=region]',
    ].join(', ');
    return {
      landmarks: Array.from(document.querySelectorAll(landmarkSelector)).map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        name: ariaName(el),
        className: clean(el.className).slice(0, 60),
      })),
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading]')).map(
        (el) => ({
          level: Number(el.getAttribute('aria-level') || el.tagName.slice(1)),
          text: clean(el.textContent).slice(0, 80),
        }),
      ),
      liveRegions: Array.from(
        document.querySelectorAll('[aria-live], [role=status], [role=alert], [role=log]'),
      ).map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        live: el.getAttribute('aria-live'),
        atomic: el.getAttribute('aria-atomic'),
        relevant: el.getAttribute('aria-relevant'),
        busy: el.getAttribute('aria-busy'),
      })),
      // Feilmeldinger som skjules med CSS i stedet for hidden lar ds-field
      // stå igjen med aria-invalid. Se designsystemet/funn-tverrgaaende.md.
      hiddenByCss: Array.from(document.querySelectorAll('[class*=validation], [class*=error]'))
        .filter((el) => {
          const cs = getComputedStyle(el);
          return (
            (cs.display === 'none' || cs.visibility === 'hidden') && !el.hasAttribute('hidden')
          );
        })
        .map((el) => ({ tag: el.tagName.toLowerCase(), className: clean(el.className) })),
    };
  });

  // Skjermbildet tas før Tab-vandringen. Vandringen parkerer fokus, og en
  // synlig hopp-lenke ligger over innholdet og dekker til det som skal ses.
  await page.screenshot({ path: SHOT, fullPage: true });

  // Fokusrekkefølge: Tab gjennom hele viewet.
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  });
  const focusOrder = [];
  let wrapped = false;
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press('Tab');
    const step = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
      const seenBefore = el.hasAttribute('data-ka-focus-seen');
      el.setAttribute('data-ka-focus-seen', '');

      const labelFor = () => {
        if (el.id === '') return '';
        const label = document.querySelector('label[for="' + el.id + '"]');
        return label === null ? '' : clean(label.textContent);
      };
      const labelledBy = () => {
        const by = el.getAttribute('aria-labelledby');
        if (by === null) return '';
        return clean(
          by
            .split(/\s+/)
            .map((id) => {
              const ref = document.getElementById(id);
              return ref === null ? '' : ref.textContent;
            })
            .join(' '),
        );
      };
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        role: el.getAttribute('role'),
        name:
          clean(el.getAttribute('aria-label')) ||
          labelledBy() ||
          labelFor() ||
          clean(el.textContent).slice(0, 60) ||
          clean(el.getAttribute('title')) ||
          '',
        focusVisible: el.matches(':focus-visible'),
        outline:
          cs.outlineStyle === 'none'
            ? 'none'
            : cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
        boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 90),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden',
        seenBefore,
      };
    });
    if (!step) break;
    if (step.seenBefore) {
      wrapped = true;
      break;
    }
    focusOrder.push(step);
  }

  await page.evaluate(() => {
    document.querySelectorAll('[data-ka-focus-seen]').forEach((el) => {
      el.removeAttribute('data-ka-focus-seen');
      el.removeAttribute('data-ka-focus-step');
    });
  });

  return JSON.stringify({
    mode: MODE,
    url: TARGET,
    viewport: { width: __VW__, height: __VH__ },
    screenshot: SHOT,
    shipped,
    painted,
    axe: axeResult,
    structure,
    focus: { steps: focusOrder, wrappedBackToStart: wrapped, focusableInDom },
  });
}
JS

summarise() {
  node -e '
    const fs = require("fs");
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const line = (s) => console.log(s);
    line("");
    line("  " + d.url + "   modus: " + d.mode + "   " + d.viewport.width + "x" + d.viewport.height);
    line("  levert data-color-scheme: " + d.shipped.htmlColorScheme +
      (d.shipped.followsSystem ? " (følger systemet)" : " (fast, følger IKKE systemet)"));
    line("  1rem på <html>: " + d.shipped.rootFontSize + "   --ds-size-8: " + d.shipped.sizeToken8 +
      (d.shipped.rootFontSize === "16px" ? "   ok" : "   FEIL, data-size står nok på <html>"));
    line("  body: " + d.painted.bodyColor + " på " + d.painted.bodyBackground);
    line("  axe: " + d.axe.violations.length + " brudd, " + d.axe.incomplete.length +
      " uavklart, " + d.axe.passes + " regler passert");
    for (const v of d.axe.violations) {
      line("    BRUDD  " + v.id + " [" + v.impact + "] " + v.wcag.join(",") + "  " + v.help);
      for (const n of v.nodes) line("           " + n.target);
    }
    for (const v of d.axe.incomplete) {
      line("    uavklart  " + v.id + "  " + v.help + "  (" + v.nodes.map((n) => n.target).join(", ") + ")");
    }
    line("  landemerker: " + (d.structure.landmarks.map((l) => l.tag + (l.role ? "[" + l.role + "]" : "") + (l.name ? " «" + l.name + "»" : " (uten navn)")).join("  ·  ") || "ingen"));
    line("  overskrifter: " + (d.structure.headings.map((h) => "h" + h.level + " «" + h.text + "»").join("  ·  ") || "ingen"));
    line("  aria-live: " + (d.structure.liveRegions.length
      ? d.structure.liveRegions.map((l) => l.tag + " live=" + l.live + " role=" + l.role).join("  ·  ")
      : "ingen"));
    if (d.structure.hiddenByCss.length) {
      line("  SKJULT MED CSS (skal være hidden): " + d.structure.hiddenByCss.map((e) => e.className).join(", "));
    }
    line("  fokusrekkefølge (" + d.focus.steps.length + " steg, " +
      (d.focus.wrappedBackToStart ? "gikk rundt" : "stoppet") + ", " +
      d.focus.focusableInDom + " synlig fokuserbare i DOM):");
    if (d.focus.focusableInDom > d.focus.steps.length) {
      line("  " + (d.focus.focusableInDom - d.focus.steps.length) +
        " synlig fokuserbare element(er) ble IKKE nådd med Tab");
    }
    d.focus.steps.forEach((s, i) => {
      const fv = s.focusVisible ? "" : "  IKKE :focus-visible";
      // Rådata, ikke en avledet dom. En ren outline-test melder
      // Designsystemets SkipLink feilaktig som uten fokusring (den setter
      // outline: 0 med vilje og bruker flate og understreking), og en
      // før/etter-sammenligning er upålitelig fordi blur() slår ut
      // :focus-visible. Skriv ut det som er målt og la anmelderen lese det.
      const ring = s.outline === "none" && s.boxShadow === "none" ? "  ingen outline/box-shadow" : "";
      line("    " + String(i + 1).padStart(2) + ". " + s.tag + (s.role ? "[" + s.role + "]" : "") +
        " «" + s.name + "»" + (s.visible ? "" : "  USYNLIG") + fv + ring);
      line("        fokus: outline " + s.outline + " · box-shadow " + s.boxShadow);
    });
    const heads = d.structure.headings.map((h) => h.level);
    for (let i = 1; i < heads.length; i += 1) {
      if (heads[i] - heads[i - 1] > 1) line("  HOPP I OVERSKRIFTSNIVÅ: h" + heads[i - 1] + " → h" + heads[i]);
    }
    if (heads.length && heads[0] !== 1) {
      line("  FØRSTE OVERSKRIFT ER h" + heads[0] + ", ikke h1 (i DOM-rekkefølge)");
    }
    if (heads.filter((l) => l === 1).length !== 1) {
      line("  " + heads.filter((l) => l === 1).length + " h1 på sida (skal være 1)");
    }
    line("  skjermbilde: " + d.screenshot);
  ' "$1"
}

FAILED=0
for route in "${ROUTES[@]}"; do
  slug="$(printf '%s' "$route" | sed 's#^/##; s#/#-#g')"
  [[ -z "$slug" ]] && slug="root"
  for mode in light dark; do
    shot="$SHOTS/$NAME--$slug--$mode.png"
    out="$RUNS/$slug--$mode.json"
    js="${PROBE//__MODE__/$mode}"
    js="${js//__URL__/http://localhost:$PORT$route}"
    js="${js//__SHOT__/$shot}"
    js="${js//__AXE__/$AXE}"
    js="${js//__VW__/$VW}"
    js="${js//__VH__/$VH}"
    if playwright-cli -s="$SESSION" run-code "$js" 2>&1 | unwrap >"$out"; then
      summarise "$out"
    else
      echo "feil under $route i $mode-modus, se $out" >&2
      FAILED=1
    fi
  done
done

echo ""
echo "rådata: $RUNS"
echo "skjermbilder: $SHOTS"
exit "$FAILED"
