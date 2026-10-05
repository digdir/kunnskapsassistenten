#!/bin/sh
# Kjører de raske sjekkene på det som er staget. Se CONTRIBUTING.md.
#
# Hookene ligger i det DELTE `.git/hooks`: arbeidstrærne våre har hver sin
# `.git`-fil, men de peker alle på den samme `commondir`, og det er den git
# leter i. En hook som er installert fra ett arbeidstre gjelder derfor alle —
# også de som står på en gren fra før verktøyet fantes.
#
# Det er hele grunnen til at denne fila finnes i stedet for en kommando i
# `package.json`. Den første utgaven kjørte `npx --no-install lint-staged`
# rett fra hooken, og da kunne ingen av de andre committe: verktøyet står
# ikke i deres `package.json`, så `npx` feilet og commiten ble avvist av noe
# grenen deres aldri hadde bedt om (målt 23.09, #2 måtte bruke
# SKIP_SIMPLE_GIT_HOOKS=1).
#
# Regelen under er derfor: si fra når verktøyet mangler et sted det SKAL
# være, og hold kjeft der det ikke hører hjemme.

if [ ! -x node_modules/.bin/lint-staged ]; then
  if grep -q '"lint-staged"' package.json 2>/dev/null; then
    echo "[ka] lint-staged mangler i node_modules. Kjør «npm install»." >&2
    exit 1
  fi
  # Grenen kjenner ikke verktøyet. Da er det ikke noe å kjøre, og ikke noe
  # galt heller.
  exit 0
fi

exec node_modules/.bin/lint-staged
