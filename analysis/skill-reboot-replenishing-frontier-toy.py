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


def run(branch="AAAAA", packs=PACKS, refill=True, trace=False, unlock_order=None):
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
            if first >= boundary and boundary not in rest_awarded:
                rest_awarded.add(boundary)
                for who in NAMES:
                    hp[who] = (2 if not hp[who] else
                               hp[who]+(MAXHP[who]-hp[who]+1)//2)

    def strike(power, target=0, overflow=False):
        nonlocal last_hit
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
        nonlocal healed
        who = max((x for x in NAMES if hp[x]),
                  key=lambda x: MAXHP[x]-hp[x], default=None)
        if who:
            actual = min(power, MAXHP[who]-hp[who])
            hp[who] += actual
            healed += actual

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
                strike(8 if choice[who] == "A" else 5,
                       overflow=choice[who]=="B")
            elif who == "Z":
                if choice[who] == "A":
                    strike(last_hit or 1)
                else:
                    strike(2)
                    strike(2)
            elif who == "T":
                if choice[who] == "A":
                    strike(2); heal(1)
                else:
                    strike(1); heal(3)
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
            target = next((x for x in ("N","G","H","Z","T") if hp[x]), None)
            if target is None:
                break
            blocked = min(enemy["atk"], shield[target])
            shield[target] -= blocked
            hp[target] = max(0, hp[target] - enemy["atk"]+blocked)
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
              max_seen_pack, len(queue)+len(board))
    return (result,logs) if trace else result


if __name__=="__main__":
    for scale in (1,1.2,1.3):
        packs = [[(k,round(h*scale),a) for k,h,a in p] for p in PACKS]
        for refill in (False,True):
            rows = [("".join(s),run("".join(s),packs=packs,refill=refill))
                    for s in product("AB",repeat=5)]
            wins = [r for r in rows if r[1][0]]
            print(scale,"refill",refill,"wins",len(wins),
                  "fast",min((r[1][1] for r in wins),default=None),
                  "enemy",min((r[1][3] for r in wins),default=None))
            if refill:
                for i,n in enumerate(NAMES):
                    print(n,[(b,sum(v[0] for s,v in rows if s[i]==b)) for b in "AB"])
    for scale in (1,1.1,1.2,1.3):
        packs = [[(k,round(h*scale),a) for k,h,a in p] for p in PACKS]
        rows = [run("".join(s), packs=packs, unlock_order=order)
                for order in permutations(NAMES)
                for s in product("AB",repeat=5)]
        print("progressive",scale,"wins",sum(v[0] for v in rows),"/3840")
    packs = [[(k,round(h*1.2),a) for k,h,a in p] for p in PACKS]
    examples = [
        ("BAAAB",("H","Z","G","N","T")),
        ("AAABA",("G","Z","N","T","H")),
        ("BBBBB",("H","G","Z","T","N")),
    ]
    for skill,order in examples:
        wins = 0
        for a in permutations(range(3)):
            for middle in permutations(range(4,7)):
                for end in permutations(range(8,11)):
                    indices = list(a)+[3]+list(middle)+[7]+list(end)+[11]
                    wins += run(skill,packs=[packs[i] for i in indices],
                                unlock_order=order)[0]
        print("route",skill,"".join(order),wins,"/216")
