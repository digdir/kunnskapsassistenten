#!/bin/sh
# Typesjekker før push. Se CONTRIBUTING.md, og pre-commit.sh for hvorfor
# hooken sjekker at verktøyet finnes før den bruker det.
#
# Ikke vitest: suiten er målt til 47,9 sekunder mot `tsc` sine 3, og en hook
# som legger et minutt på hver push er en hook folk slår av — og da mister vi
# `tsc` også.

if [ ! -x node_modules/.bin/tsc ]; then
  if grep -q '"typecheck"' package.json 2>/dev/null; then
    echo "[ka] tsc mangler i node_modules. Kjør «npm install»." >&2
    exit 1
  fi
  exit 0
fi

exec node_modules/.bin/tsc -b
