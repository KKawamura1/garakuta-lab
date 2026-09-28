"""Compare sidegrade choices in identical routes and surrounding builds.

Use with 36's disposable counterfire toy. Route permutations keep boss slots
4/8/12 fixed. This measures paired outcomes, not perceived enjoyment.
"""
from collections import defaultdict
from itertools import permutations, product
from pathlib import Path
import importlib.util

source = Path(__file__).with_name("skill-reboot-counterfire-toy.py")
if not source.exists():
    source = Path(__file__).with_name("conveyor_fire_toy.py")
spec = importlib.util.spec_from_file_location("counterfire", source)
toy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(toy)


def route_sets(base):
    for first in permutations(range(3)):
        for middle in permutations(range(4, 7)):
            for last in permutations(range(8, 11)):
                indices = list(first) + [3] + list(middle) + [7] + list(last) + [11]
                yield indices, [base[i] for i in indices]


def audit(hard):
    base = [[(kind, round(hp * 1.2), attack) for kind, hp, attack in group]
            for group in toy.PACKS]
    if hard:
        for i in (3, 7, 11):
            _, hp, attack = base[i][0]
            base[i][0] = ("boss_splash", hp, attack)
        for i, j in ((1, 0), (6, 1), (9, 0), (10, 1)):
            _, hp, attack = base[i][j]
            base[i][j] = ("ranged", hp, attack)
    results = defaultdict(lambda: [0, 0, 0, 0])
    for unlock in (toy.NAMES, ("G", "Z", "N", "T", "H")):
        for _, packs in route_sets(base):
            values = {
                "".join(bits): toy.run(
                    "".join(bits), packs=packs, unlock_order=unlock,
                    return_fire=True, gou_pierce=6, genzo_repeat=3)
                for bits in product("AB", repeat=5)
            }
            for pos, name in enumerate(toy.NAMES):
                for other in product("AB", repeat=4):
                    bits = list(other)
                    bits.insert(pos, "A")
                    a = values["".join(bits)]
                    bits[pos] = "B"
                    b = values["".join(bits)]
                    row = results[name]
                    row[0] += bool(a[0] and not b[0])
                    row[1] += bool(b[0] and not a[0])
                    row[2] += bool(a[0] and b[0] and a[1] < b[1])
                    row[3] += bool(a[0] and b[0] and b[1] < a[1])
    print("hard", hard, "paired contexts per character", 2 * 216 * 16)
    for name in toy.NAMES:
        print(name, "A-only/B-only/A-faster/B-faster", results[name])


if __name__ == "__main__":
    audit(False)
    audit(True)
