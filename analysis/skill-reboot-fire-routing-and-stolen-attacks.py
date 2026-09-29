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
        gou_pierce=5, genzo_repeat=2, fire_mode="next_hit",
        stolen_attack=False, foresight_shot=False, future_power=4,
        foresight_front=0, visible_slots=3, action_order=NAMES,
        unlock_by_kills=False, kill_thresholds=(3,6,11,14)):
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
    portal_kills = 0
    stolen_kills = 0
    future_kills = 0
    total_kills = 0
    enemy_actions = 0
    max_seen_pack = 0
    rest_awarded = set()
    unlocked = set(NAMES if unlock_order is None else unlock_order[:1])
    logs = []
    main_actions = 0

    def refill_slot(pos, born):
        nonlocal fire, fire_spent, portal_kills
        if queue:
            next_enemy = queue.pop(0)
            next_enemy["born"] = born
            board.insert(pos, next_enemy)
            if return_fire and fire_mode=="entry" and fire:
                power=fire
                fire_spent += power
                fire=0
                next_enemy["hp"] -= power
                if next_enemy["hp"] <= 0:
                    portal_kills += 1
                    board.pop(-1)
                    refill_slot(len(board),born)

    for _ in range(min(visible_slots,len(queue))):
        refill_slot(len(board), -1)

    def rest_if_due():
        nonlocal max_seen_pack
        remaining = [e["pack"] for e in board+queue]
        first = min(remaining) if remaining else len(packs)
        max_seen_pack = max(max_seen_pack, first)
        if unlock_order and not unlock_by_kills:
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
        nonlocal last_hit, fire, fire_spent, stolen_kills, total_kills
        if return_fire and fire_mode=="next_hit" and board and power > 0:
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
            total_kills += 1
            unlock_if_kills()
            if refill:
                refill_slot(len(board), volley)
            rest_if_due()
            if stolen_attack and board:
                # Slain foe's printed attack turns into a hit against the next front.
                # The same rule applies to an enemy killed by that hit.
                copied = enemy["atk"]
                while copied and board:
                    nxt = board[0]
                    nxt["hp"] -= copied
                    if trace:
                        logs.append(("stolen",volley+1,enemy["kind"],copied,
                                     nxt["pack"]+1,nxt["hp"]))
                    if nxt["hp"] > 0:
                        break
                    stolen_kills += 1
                    total_kills += 1
                    unlock_if_kills()
                    enemy = board.pop(0)
                    if refill:
                        refill_slot(len(board),volley)
                    rest_if_due()
                    copied = enemy["atk"]
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

    def unlock_if_kills():
        if not unlock_by_kills or not unlock_order:return
        for index,threshold in enumerate(kill_thresholds,start=1):
            if total_kills>=threshold and unlock_order[index] not in unlocked:
                unlocked.add(unlock_order[index])
                if trace:logs.append(("unlock",volley+1,total_kills,unlock_order[index]))

    def future_shot(power):
        nonlocal last_hit, fire, fire_spent, future_kills, total_kills
        if not queue:
            strike(power, len(board)-1)
            return
        if return_fire and fire_mode == "next_hit":
            power += fire
            fire_spent += fire
            fire=0
        last_hit=power
        future=queue[0]
        future["hp"] -= power
        if trace:
            logs.append(("future_shot",volley+1,power,future["pack"]+1,
                         future["hp"]))
        if future["hp"] <= 0:
            queue.pop(0)
            future_kills += 1
            total_kills += 1
            unlock_if_kills()
            rest_if_due()

    for slot in range(750):
        if not board and queue:
            for _ in range(min(visible_slots,len(queue))):
                refill_slot(len(board),volley)
        if (slot%5==0 and return_fire and fire_mode=="opening"
                and fire and board):
            power=fire
            fire=0
            fire_spent+=power
            newest=board[-1]
            old_hp=newest["hp"]
            target_pack=newest["pack"]+1
            newest["hp"]-=power
            if newest["hp"]<=0:
                portal_kills+=1
                board.pop(-1)
                refill_slot(len(board),volley)
                rest_if_due()
            if trace:
                logs.append(("opening_fire",volley+1,power,target_pack,
                             old_hp,newest["hp"]))
        if not board:
            break
        who = action_order[slot % 5]
        main_actions += 1
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
                    if foresight_shot:
                        if foresight_front:strike(foresight_front)
                        future_shot(future_power)
                    else:strike(4, len(board)-1)
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
    result = (not board and not queue and any(hp.values()), main_actions,
              counter, enemy_actions, healed, sum(hp.values()),
              max_seen_pack, len(queue)+len(board), fire_gained,fire_spent,
              portal_kills,stolen_kills,future_kills)
    return (result,logs) if trace else result


if __name__=="__main__":
    for variant in ("base","hard"):
        packs=[[(k,round(h*1.2),a) for k,h,a in wave] for wave in PACKS]
        if variant=="hard":
            for i in (3,7,11):
                _,h,a=packs[i][0]
                packs[i][0]=("boss_splash",h,a)
            for i,j in ((1,0),(6,1),(9,0),(10,1)):
                _,h,a=packs[i][j]
                packs[i][j]=("ranged",h,a)
        for mode in ("next_hit","entry","opening"):
            rows=[run("".join(bits),packs=packs,unlock_order=order,
                      return_fire=True,fire_mode=mode,
                      gou_pierce=6,genzo_repeat=3)
                  for order in permutations(NAMES)
                  for bits in product("AB",repeat=5)]
            wins=[v for v in rows if v[0]]
            print(variant,mode,"wins",len(wins),
                  "free kills per win",
                  round(sum(v[-3] for v in wins)/len(wins),2) if wins else 0,
                  "fastest",min((v[1] for v in wins),default=None))
        for stolen in (False,True):
            rows=[run("".join(bits),packs=packs,unlock_order=order,
                      return_fire=True,fire_mode="next_hit",
                      gou_pierce=6,genzo_repeat=3,stolen_attack=stolen)
                  for order in permutations(NAMES)
                  for bits in product("AB",repeat=5)]
            wins=[v for v in rows if v[0]]
            print(variant,"stolen",stolen,"wins",len(wins),
                  "mean_actions",round(sum(v[1] for v in wins)/len(wins),2),
                  "mean_stolen_kills",round(sum(v[-2] for v in wins)/len(wins),2))

        counts=dict.fromkeys(("next_only","opening_only","next_faster",
                              "opening_faster","tied","both_lost"),0)
        chunks=[list(permutations(range(start,start+3)))
                for start in (0,4,8)]
        for p,q,r in product(*chunks):
            route=list(p)+[3]+list(q)+[7]+list(r)+[11]
            shuffled=[packs[i] for i in route]
            for bits in product("AB",repeat=5):
                kw=dict(packs=shuffled,unlock_order=("G","Z","T","N","H"),
                        return_fire=True,gou_pierce=6,genzo_repeat=3)
                a=run("".join(bits),fire_mode="next_hit",**kw)
                b=run("".join(bits),fire_mode="opening",**kw)
                if a[0] and not b[0]:key="next_only"
                elif b[0] and not a[0]:key="opening_only"
                elif a[0] and b[0]:
                    key=("next_faster" if a[1]<b[1] else
                         "opening_faster" if b[1]<a[1] else "tied")
                else:key="both_lost"
                counts[key]+=1
        print(variant,"paired",counts)
        for visible,front,power in ((3,0,4),(3,1,2),(3,1,4),(1,0,4)):
            by_hero={}
            for h in "AB":
                rows=[run(h+"".join(bits),packs=packs,
                          unlock_order=order,return_fire=True,
                          gou_pierce=6,genzo_repeat=3,foresight_shot=True,
                          future_power=power,foresight_front=front,
                          visible_slots=visible)
                      for order in permutations(NAMES)
                      for bits in product("AB",repeat=4)]
                wins=[v for v in rows if v[0]]
                by_hero[h]=(len(wins),round(sum(v[-1] for v in wins)/len(wins),2))
            print(variant,"visible",visible,"front",front,"future",power,
                  "H A/B (wins,mean future kills)",by_hero)
