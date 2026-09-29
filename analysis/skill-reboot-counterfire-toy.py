"""Adversarial toy: refill slain enemy slots from a 12-pack queue.

Fixed friendly order H,G,Z,T,N and a reaction after each five actions.
Ten A/B cards, all unlocked at start. No claim about fun or balance.
"""
from itertools import permutations, product

NAMES = ("H", "G", "Z", "T", "N")
MAXHP = {"G":12, "Z":8, "H":7, "T":8, "N":14}
PACKS = [
    [("m",3,2),("m",3,2)], [("m",5,3)],
    [("m",4,2),("m",4,2)], [("boss",20,6)],
    [("m",3,2),("m",3,2),("m",3,2)],
    [("m",8,3),("heal",4,2)], [("m",9,3),("m",6,2)],
    [("boss",26,7)], [("m",4,2),("m",4,2),("m",4,2)],
    [("m",10,3),("heal",4,2)], [("m",10,3),("m",9,3)],
    [("boss",35,9),("heal",5,2)],
]


def run(branch="AAAAA", packs=PACKS, refill=True, trace=False,
        unlock_order=None, rests=True, return_fire=False, fire_cap=4,
        gou_pierce=5, genzo_repeat=2):
    choice = dict(zip(NAMES, branch))
    queue = [{"pack":i, "kind":k, "hp":v, "maxhp":v, "atk":a, "born":-1}
             for i,p in enumerate(packs) for k,v,a in p]
    board = []
    hp = MAXHP.copy()
    shield = dict.fromkeys(NAMES, 0)
    volley = 0
    last_hit = 0
    counter = 0
    healed = 0
    fire = 0
    fire_gained = 0
    fire_spent = 0
    enemy_actions = 0
    max_seen_pack = 0
    rest_awarded = set()
    unlocked = set(NAMES if unlock_order is None else unlock_order[:1])
    logs = []

    def refill_slot(pos, born):
        if queue:
            next_enemy = queue.pop(0)
            next_enemy["born"] = born
            board.insert(pos, next_enemy)

    for _ in range(min(3,len(queue))):
        refill_slot(len(board), -1)

    def rest_if_due():
        nonlocal max_seen_pack
        remaining = [e["pack"] for e in board+queue]
        first = min(remaining) if remaining else len(packs)
        max_seen_pack = max(max_seen_pack, first)
        if unlock_order:
            for index,boundary in enumerate((2,4,6,8),start=1):
                if first >= boundary:
                    unlocked.add(unlock_order[index])
        for boundary in (4, 8):
            if rests and first >= boundary and boundary not in rest_awarded:
                rest_awarded.add(boundary)
                for who in NAMES:
                    hp[who] = (2 if not hp[who] else
                               hp[who]+(MAXHP[who]-hp[who]+1)//2)

    def strike(power, target=0, overflow=False):
        nonlocal last_hit, fire, fire_spent
        if return_fire and board and power > 0:
            power += fire
            fire_spent += fire
            fire = 0
        last_hit = power
        if not board or power <= 0:
            return
        pos = min(target, len(board)-1)
        while board and power > 0:
            enemy = board[pos]
            old = enemy["hp"]
            enemy["hp"] -= power
            if enemy["hp"] > 0:
                return
            leftover = max(0, power-old)
            board.pop(pos)
            if refill:
                refill_slot(len(board), volley)
            rest_if_due()
            if not overflow or leftover <= 0:
                return
            power = leftover
            if pos >= len(board):
                pos = len(board)-1
            if pos < 0:
                return

    def heal(power):
        nonlocal healed, fire, fire_gained
        who = max((x for x in NAMES if hp[x]),
                  key=lambda x: MAXHP[x]-hp[x], default=None)
        if who:
            actual = min(power, MAXHP[who]-hp[who])
            hp[who] += actual
            healed += actual
            if return_fire:
                old = fire
                fire = min(fire_cap, fire+(actual+1)//2)
                fire_gained += fire-old

    for slot in range(750):
        if not board and queue:
            for _ in range(min(3,len(queue))):
                refill_slot(len(board),volley)
        if not board:
            break
        who = NAMES[slot % 5]
        if hp[who]:
            if who not in unlocked:
                if who=="H":strike(2)
                elif who=="G":strike(5)
                elif who=="Z":strike(2)
                elif who=="T":strike(1);heal(1)
                else:shield[who]=min(3,shield[who]+2)
            elif who == "H":
                if choice[who] == "A":
                    for _ in range(3):
                        strike(1)
                else:
                    strike(4, len(board)-1)
            elif who == "G":
                strike(8 if choice[who] == "A" else gou_pierce,
                       overflow=choice[who]=="B")
            elif who == "Z":
                if choice[who] == "A":
                    strike(last_hit or 1)
                else:
                    for _ in range(genzo_repeat):
                        strike(2)
            elif who == "T":
                if choice[who] == "A":
                    strike(2); heal(1)
                else:
                    heal(3)
            else:
                shield[who] = min(3, shield[who]+(3 if choice[who]=="A" else 1))
                if choice[who]=="B":
                    strike(2)
        if trace:
            logs.append(("ally",volley+1,who,
                         [(e["pack"]+1,e["kind"],e["hp"],e["born"]==volley)
                          for e in board],dict(hp),dict(shield)))
        if not board and not queue:
            break
        if slot % 5 != 4:
            continue
        counter += 1
        last_hit = 0
        for enemy in list(board):
            if enemy not in board or enemy["born"] == volley:
                continue
            if enemy["kind"] == "heal":
                if board:
                    board[0]["hp"] = min(board[0]["maxhp"], board[0]["hp"]+2)
                continue
            attacks = []
            if enemy["kind"]=="ranged":
                target = min((x for x in NAMES if hp[x]),
                             key=lambda x:(hp[x],NAMES.index(x)),default=None)
            else:
                target = next((x for x in ("N","G","H","Z","T") if hp[x]), None)
            if target:
                attacks.append((target,enemy["atk"]))
            if enemy["kind"]=="boss_splash":
                rear = next((x for x in ("H","Z","T","G") if hp[x]),None)
                if rear:
                    attacks.append((rear,(enemy["atk"]+1)//2))
            for target,amount in attacks:
                if hp[target]==0:
                    continue
                blocked = min(amount, shield[target])
                shield[target] -= blocked
                hp[target] = max(0, hp[target] - amount+blocked)
                if return_fire:
                    old = fire
                    fire = min(fire_cap, fire+(blocked+1)//2)
                    fire_gained += fire-old
                enemy_actions += 1
        if trace:
            logs.append(("foes",volley+1,"-",
                         [(e["pack"]+1,e["kind"],e["hp"],e["born"]==volley)
                          for e in board],dict(hp),dict(shield)))
        volley += 1
        if not any(hp.values()):
            break
    result = (not board and not queue and any(hp.values()), slot+1,
              counter, enemy_actions, healed, sum(hp.values()),
              max_seen_pack, len(queue)+len(board), fire_gained,fire_spent)
    return (result,logs) if trace else result


if __name__=="__main__":
    for scale in (1.0,1.2,1.3):
        base = [[(k,round(h*scale),a) for k,h,a in p] for p in PACKS]
        for mode in ("base","ranged_and_splash"):
            packs = [p[:] for p in base]
            if mode=="ranged_and_splash":
                for i in (3,7,11):
                    _,h,a=packs[i][0]
                    packs[i][0]=("boss_splash",h,a)
                for i,j in ((1,0),(6,1),(9,0),(10,1)):
                    _,h,a=packs[i][j]
                    packs[i][j]=("ranged",h,a)
            for extra in (False,True):
                rows = [("".join(s),run("".join(s),packs=packs,
                        unlock_order=order,return_fire=extra))
                        for order in permutations(NAMES)
                        for s in product("AB",repeat=5)]
                print(scale,mode,"return_fire",extra,
                      "wins",sum(v[0] for _,v in rows),
                      "builds",len(set(s for s,v in rows if v[0])))
        if scale==1.2:
            for g,z in ((5,2),(6,3),(7,3)):
                rows = [("".join(s),run("".join(s),packs=packs,
                        unlock_order=order,return_fire=True,
                        gou_pierce=g,genzo_repeat=z))
                        for order in permutations(NAMES)
                        for s in product("AB",repeat=5)]
                print("alternate",g,z,"hard wins",
                      sum(v[0] for _,v in rows),
                      "G", [sum(v[0] for s,v in rows if s[1]==x)
                            for x in "AB"],
                      "Z", [sum(v[0] for s,v in rows if s[2]==x)
                            for x in "AB"])
