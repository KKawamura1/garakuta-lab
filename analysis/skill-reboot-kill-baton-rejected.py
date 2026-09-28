"""Disposable adversarial toy for the kill-baton hypothesis.

Five main actions per enemy phase. Killing an enemy can grant the next
portrait one bonus action, once per portrait per wave. No skill progression.
This is deliberately a falsifier, not a proposed implementation contract.
"""
from itertools import product

NAMES = ("G", "Z", "H", "T", "N")
MAXHP = {"G": 12, "Z": 8, "H": 7, "T": 8, "N": 14}
WAVES = [
    [("m", 3, 2), ("m", 3, 2)], [("m", 5, 3)],
    [("m", 4, 2), ("m", 4, 2)], [("boss", 20, 6)],
    [("m", 3, 2), ("m", 3, 2), ("m", 3, 2)],
    [("m", 8, 3), ("heal", 4, 2)], [("m", 9, 3), ("m", 6, 2)],
    [("boss", 26, 7)], [("m", 4, 2), ("m", 4, 2), ("m", 4, 2)],
    [("m", 10, 3), ("heal", 4, 2)], [("m", 10, 3), ("m", 9, 3)],
    [("boss", 35, 9), ("heal", 5, 2)],
]


def run(branch="AAAAA", order=NAMES, waves=WAVES, bonus=True, trace=False):
    choice = dict(zip(NAMES, branch))
    hp = MAXHP.copy()
    shields = dict.fromkeys(NAMES, 0)
    enemies = []
    wave = -1
    used = set()
    last_hit = 0
    bonus_count = 0
    max_chain = chain = 0
    enemy_phases = 0
    main_actions = 0
    logs = []

    def enter():
        nonlocal wave, enemies, used
        wave += 1
        used = set()
        if wave == len(waves):
            enemies = []
            return
        enemies = [
            {"kind": k, "hp": v, "maxhp": v, "atk": a}
            for k, v, a in waves[wave]
        ]
        if wave in (4, 8):
            for name in NAMES:
                hp[name] = (2 if hp[name] == 0 else
                            hp[name] + (MAXHP[name] - hp[name] + 1) // 2)

    def hit(power, target=0):
        nonlocal last_hit
        if not enemies or power <= 0:
            return False
        last_hit = power
        enemy = enemies[min(target, len(enemies) - 1)]
        enemy["hp"] -= power
        killed = enemy["hp"] <= 0
        if killed:
            enemies.remove(enemy)
            if not enemies:
                enter()
        return killed

    def heal(amount):
        name = max((n for n in NAMES if hp[n]), key=lambda n: MAXHP[n]-hp[n], default=None)
        if name is None:
            return 0
        actual = min(amount, MAXHP[name]-hp[name])
        hp[name] += actual
        return actual

    def action(name, extra=False):
        nonlocal bonus_count, max_chain, chain, last_hit
        if hp[name] == 0:
            return False
        if extra:
            bonus_count += 1
            chain += 1
            max_chain = max(chain, max_chain)
            if name == "G":
                if choice[name] == "A":
                    killed = hit(6)
                else:
                    killed = hit(3)
                    if enemies and len(enemies) > 1:
                        killed = hit(3, 1) or killed
            elif name == "Z":
                killed = hit(last_hit if choice[name] == "A" else 3)
            elif name == "H":
                if choice[name] == "A":
                    killed = hit(3, len(enemies)-1)
                else:
                    killed = False
                    for e in list(enemies):
                        if e in enemies:
                            killed = hit(2, enemies.index(e)) or killed
            elif name == "T":
                if choice[name] == "A":
                    killed = hit(2)
                    heal(2)
                else:
                    actual = heal(3)
                    killed = hit(1+actual)
            else:
                if choice[name] == "A":
                    shields[name] = min(3, shields[name]+3)
                    killed = hit(1)
                else:
                    shields[name] = min(3, shields[name]+1)
                    killed = hit(3)
        elif name == "G":
            killed = hit(6)
        elif name == "Z":
            killed = hit(2)
        elif name == "H":
            killed = hit(3)
        elif name == "T":
            killed = hit(2)
            heal(1)
        else:
            shields[name] = min(3, shields[name]+2)
            killed = False
        if trace:
            logs.append((f"{name}{'+' if extra else ''}", wave+1,
                         [(e["kind"],e["hp"]) for e in enemies],
                         dict(hp), dict(shields)))
        return killed

    enter()
    for turn in range(750):
        if wave == len(waves):
            break
        name = order[turn % 5]
        main_actions += 1
        chain = 0
        killed = action(name)
        current = name
        while bonus and killed and wave < len(waves):
            next_name = order[(order.index(current)+1) % 5]
            if next_name in used or hp[next_name] == 0:
                break
            used.add(next_name)
            killed = action(next_name, extra=True)
            current = next_name
        if main_actions % 5:
            continue
        enemy_phases += 1
        last_hit = 0
        for enemy in list(enemies):
            if enemy["kind"] == "heal":
                if enemies:
                    enemies[0]["hp"] = min(enemies[0]["maxhp"], enemies[0]["hp"]+2)
                continue
            target = next((n for n in ("N", "G", "H", "Z", "T") if hp[n]), None)
            if target is None:
                break
            blocked = min(enemy["atk"], shields[target])
            shields[target] -= blocked
            hp[target] = max(0, hp[target] - (enemy["atk"]-blocked))
        if not any(hp.values()):
            break
    result = (wave == len(waves), main_actions, bonus_count, max_chain,
              enemy_phases, sum(hp.values()), wave+1)
    return (result, logs) if trace else result


if __name__ == "__main__":
    for hp_scale in (1, 1.1, 1.2, 1.3, 1.4, 1.5):
        scripted = [[(k, round(v*hp_scale), a) for k,v,a in w] for w in WAVES]
        for enabled in (False, True):
            rows = [(s, run(s, waves=scripted, bonus=enabled))
                    for s in map("".join, product("AB", repeat=5))]
            wins = [row for row in rows if row[1][0]]
            print("hp", hp_scale, "bonus", enabled, "wins", len(wins),
                  "best actions", min((v[1] for _,v in wins),default=None),
                  "best bonus", max((v[2] for _,v in rows),default=0))
            if enabled:
                for i,n in enumerate(NAMES):
                    print(n, [(b,sum(v[0] for s,v in rows if s[i]==b)) for b in "AB"])
