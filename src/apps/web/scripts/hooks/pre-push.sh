#!/bin/sh
# Typesjekker før push. Se CONTRIBUTING.md, og pre-commit.sh for hvorfor
# hooken sjekker at verktøyet finnes før den bruker det.
#
# Ikke vitest: suiten er målt til 47,9 sekunder mot `tsc` sine 3, og en hook
# som legger et minutt på hver push er en hook folk slår av — og da mister vi
# `tsc` også.

# I workspace-et i src/ løfter npm verktøyene til src/node_modules.
BIN=node_modules/.bin
[ -x "$BIN/tsc" ] || BIN=../../node_modules/.bin

if [ ! -x "$BIN/tsc" ]; then
  if grep -q '"typecheck"' package.json 2>/dev/null; then
    echo "[ka] tsc mangler i node_modules. Kjør «npm install»." >&2
    exit 1
  fi
  exit 0
fi

exec "$BIN/tsc" -b
