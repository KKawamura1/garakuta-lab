"""Alternative core: five heroes assemble one salvo, then fire it down a refill queue.
Toy numbers only. No hidden random input. `python forge_toy.py` enumerates build choices.
"""
from itertools import permutations, product
NAMES=("H","G","Z","T","N")
MAXHP={"G":12,"Z":8,"H":7,"T":8,"N":14}
PACKS=[
    [("m",3,2),("m",3,2)],[("m",5,3)],
    [("m",4,2),("m",4,2)],[("boss",20,6)],
    [("m",3,2),("m",3,2),("m",3,2)],
    [("m",8,3),("heal",4,2)],[("m",9,3),("m",6,2)],
    [("boss",26,7)],[("m",4,2),("m",4,2),("m",4,2)],
    [("m",10,3),("heal",4,2)],[("m",10,3),("m",9,3)],
    [("boss",35,9),("heal",5,2)],
]


def run(branch="AAAAA", packs=PACKS, order=NAMES, fire_mode=True,
        trace=False, gou_first=6, gou_all=2):
    choice=dict(zip(NAMES,branch))
    queue=[dict(pack=i,kind=k,hp=h,max=h,atk=a,born=-1)
           for i,wave in enumerate(packs) for k,h,a in wave]
    board=[]
    hp=MAXHP.copy()
    shield=dict.fromkeys(NAMES,0)
    unlocked={order[0]}
    rest_awarded=set()
    fire=0
    reports=[]
    kills=0;rounds=0;enemy_actions=0;actual_heal=0

    def refill(born=None):
        if queue:
            e=queue.pop(0);e["born"]=rounds if born is None else born;board.append(e)

    for _ in range(3):refill(-1)

    def milestone():
        remaining=[e["pack"] for e in board+queue]
        first=min(remaining) if remaining else len(packs)
        for i,b in enumerate((2,4,6,8),start=1):
            if first>=b:unlocked.add(order[i])
        for b in (4,8):
            if first>=b and b not in rest_awarded:
                rest_awarded.add(b)
                for who in NAMES:
                    hp[who]=2 if not hp[who] else hp[who]+(MAXHP[who]-hp[who]+1)//2

    def heal(power):
        nonlocal fire,actual_heal
        who=max((x for x in NAMES if hp[x]),
                key=lambda x:MAXHP[x]-hp[x],default=None)
        if who is None:return 0
        actual=min(power,MAXHP[who]-hp[who])
        hp[who]+=actual;actual_heal+=actual
        if fire_mode:fire=min(4,fire+(actual+1)//2)
        return actual

    for _ in range(150):
        if not board:break
        # One shared salvo: form -> weight -> echo -> care -> guard -> release.
        h="base" if "H" not in unlocked else choice["H"]
        g="base" if "G" not in unlocked else choice["G"]
        z="base" if "Z" not in unlocked else choice["Z"]
        t="base" if "T" not in unlocked else choice["T"]
        n="base" if "N" not in unlocked else choice["N"]
        pellets=([4] if h=="base" else [2,2,2] if h=="A" else [6]) if hp["H"] else []
        if hp["G"]:
            if not pellets:pellets=[0]
            if g=="B":pellets=[p+gou_all for p in pellets]
            else:pellets[0]+=gou_first if g=="A" else 4
        if hp["Z"]:
            if z=="A":pellets.append(max(pellets,default=1))
            elif z=="B":pellets.extend((2,2))
            else:pellets.append(2)
        if hp["T"]:
            actual=heal(3 if t=="B" else 1)
            if t=="A" and actual:pellets.append(2)
        if hp["N"]:
            shield["N"]=min(3,shield["N"]+(3 if n=="A" else 1 if n=="B" else 2))
            if n=="B":pellets.append(3)
        before=[e["hp"] for e in board]
        first_fire=fire
        if pellets and fire_mode:
            pellets[0]+=fire;fire=0
        for shot in pellets:
            if not board:break
            power=shot
            while board and power>0:
                foe=board[0]
                old=foe["hp"]
                foe["hp"]-=power
                if foe["hp"]>0:break
                board.pop(0);kills+=1;refill();milestone()
                if g!="B" or not hp["G"] or power<=old:break
                power-=old
        if not board:
            reports.append((rounds+1,before,pellets,first_fire,kills,dict(hp),dict(shield),"win"))
            break
        for foe in list(board):
            if foe["born"]==rounds:continue
            if foe["kind"]=="heal":
                if board:board[0]["hp"]=min(board[0]["max"],board[0]["hp"]+2)
                continue
            if foe["kind"]=="ranged":
                target=min((x for x in NAMES if hp[x]),key=lambda x:(hp[x],NAMES.index(x)),default=None)
            else:target=next((x for x in ("N","G","H","Z","T") if hp[x]),None)
            attacks=[] if target is None else [(target,foe["atk"])]
            if foe["kind"]=="boss_splash":
                rear=next((x for x in ("H","Z","T","G") if hp[x]),None)
                if rear:attacks.append((rear,(foe["atk"]+1)//2))
            for who,amount in attacks:
                if not hp[who]:continue
                blocked=min(amount,shield[who]);shield[who]-=blocked
                hp[who]=max(0,hp[who]-amount+blocked)
                if fire_mode:fire=min(4,fire+(blocked+1)//2)
                enemy_actions+=1
        reports.append((rounds+1,before,pellets,first_fire,kills,dict(hp),dict(shield),"play"))
        rounds+=1
        if not any(hp.values()):break
    result=(not board and not queue and any(hp.values()),len(reports),kills,enemy_actions,
            actual_heal,sum(hp.values()))
    return (result,reports) if trace else result


if __name__=="__main__":
    for kind in ("base","hard"):
        packs=[[(k,round(h*1.2),a) for k,h,a in wave] for wave in PACKS]
        if kind=="hard":
            for i in (3,7,11):
                _,h,a=packs[i][0];packs[i][0]=("boss_splash",h,a)
            for i,j in ((1,0),(6,1),(9,0),(10,1)):
                _,h,a=packs[i][j];packs[i][j]=("ranged",h,a)
        rows=[(b,run(b,packs=packs,order=o))
              for o in permutations(NAMES)
              for b in map("".join,product("AB",repeat=5))]
        wins=[(b,v) for b,v in rows if v[0]]
        print(kind,"wins",len(wins),"fastest",min((v[1] for _,v in wins),default=None),
              "avg rounds",round(sum(v[1] for _,v in wins)/len(wins),2) if wins else 0)
        print("hero A/B",{x:{v:sum(r[0] for b,r in rows if b[i]==v) for v in "AB"}
                          for i,x in enumerate(NAMES)})
        for b in ("AAAAA","BAAAA","ABBBB","BBBBB"):
            print(b,run(b,packs=packs,order=NAMES))
