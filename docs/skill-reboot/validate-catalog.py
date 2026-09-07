"""Validate design data, not engine behavior or game balance.

Usage: python validate-catalog.py core-catalog-v3.json
Assumption: every acquired level costs 1 SP; declared free seeds cost 0.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

path = Path(sys.argv[1])
raw = path.read_bytes()
catalog = json.loads(raw)
skills = catalog["skills"]
nodes = {node["id"]: node for node in skills}
errors = []
if len(nodes) != len(skills):
    errors.append("Duplicate skill ID")
visiting, visited = set(), set()


def visit(key):
    if key in visiting:
        errors.append(f"Cycle at {key}")
        return
    if key in visited:
        return
    visiting.add(key)
    node = nodes[key]
    for req in node["prerequisites"]:
        parent = nodes.get(req["id"])
        if parent is None:
            errors.append(f"{key}: missing prerequisite {req['id']}")
            continue
        if not 1 <= req["minLv"] <= parent["maxLv"]:
            errors.append(f"{key}: invalid required level {req}")
        if parent["releaseStage"] > node["releaseStage"]:
            errors.append(f"{key}: prerequisite released later than child")
        visit(req["id"])
    expected = {str(i) for i in range(2, node["maxLv"] + 1)}
    if set(node["rankUp"]) != expected:
        errors.append(f"{key}: missing or extraneous rank descriptions")
    if node["kind"] not in {"A", "R", "P"}:
        errors.append(f"{key}: unknown kind")
    visiting.remove(key)
    visited.add(key)


for key in nodes:
    visit(key)


def parse_rank(entry):
    match = re.fullmatch(r"(\w+) Lv(\d+)", entry)
    if not match:
        raise ValueError(f"Invalid rank expression: {entry}")
    return match[1], int(match[2])


build_results = []
for build in catalog["stage0Builds"]:
    for phase in ("coreByBattle6", "fullAt13"):
        for actor, entries in build[phase].items():
            tag = f"{build['id']}/{phase}/{actor}"
            ranks = {}
            for entry in entries:
                key, level = parse_rank(entry)
                if key in ranks:
                    errors.append(f"{tag}: duplicate target rank {key}")
                ranks[key] = level
            free_key, free_level = parse_rank(build["freeSeeds"][actor])
            if free_key not in nodes:
                errors.append(f"{tag}: unknown free seed")
                continue
            if nodes[free_key]["prerequisites"] or free_level != 1:
                errors.append(f"{tag}: free seed must be a root at Lv1")
            ranks[free_key] = max(ranks.get(free_key, 0), free_level)
            for key, level in ranks.items():
                if key not in nodes:
                    errors.append(f"{tag}: unknown skill {key}")
                    continue
                node = nodes[key]
                if node["releaseStage"] > 0 or not 1 <= level <= node["maxLv"]:
                    errors.append(f"{tag}: invalid stage/rank for {key}")
                for req in node["prerequisites"]:
                    if ranks.get(req["id"], 0) < req["minLv"]:
                        errors.append(f"{tag}: unmet prerequisite for {key}: {req}")
            cost = sum(ranks.values()) - free_level
            limit = 13 if phase == "fullAt13" else build["coreSpPerActor"]
            if cost > limit:
                errors.append(f"{tag}: cost {cost} exceeds declared budget {limit}")
            # Normal 1 / boss 2, zero starting SP; costs are spent after a win.
            total, first_use = 0, 1 if cost == 0 else None
            for battle in range(1, 12):
                total += 2 if battle in (4, 8) else 1
                if first_use is None and total >= cost:
                    first_use = battle + 1
            build_results.append({"build": build["id"], "phase": phase,
                                  "actor": actor, "cost": cost,
                                  "first_battle_usable": first_use})

result = {"scope": "Structure and SP only; no combat simulation",
          "source_sha256": hashlib.sha256(raw).hexdigest(),
          "skills": len(nodes),
          "released_per_stage": dict(sorted(Counter(n["releaseStage"] for n in skills).items())),
          "builds": build_results, "errors": errors}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(bool(errors))
