# SCRAP FRONTIER — reference core

This directory is the executable reference for EXP-18 R1. It intentionally contains no browser UI.

- content.mjs: the exact six ally units, three enemies, three doctrines, and three missions.
- engine.mjs: deterministic three-beat battle resolution and two-front assignment.
- core.test.mjs: the preregistered structural checks.

Run:

    node frontier/core.test.mjs

The engine proves only that the intended contrast exists: the first squad solves the swarm, two different second squads solve the fortress, and both strategies are needed across two simultaneous fronts. It does not prove that this is fun.
