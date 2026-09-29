"""One adjacent party-order swap, no changes to a skill or enemy.

Run this next to skill-reboot-fire-routing-and-stolen-attacks.py.
The engine is loaded by file path because its name contains hyphens.
"""
from itertools import permutations, product
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

try:
    import portal_fire_toy as m  # local scratch copy
except ModuleNotFoundError:
    p=Path(__file__).with_name("skill-reboot-fire-routing-and-stolen-attacks.py")
    spec=spec_from_file_location("fire_toy",p)
    m=module_from_spec(spec)
    spec.loader.exec_module(m)


def enemy_packs(kind="base",hp_shift=0):
    packs=[[(k,max(1,round(h*1.2)+hp_shift),a) for k,h,a in wave]
           for wave in m.PACKS]
    if kind=="hard":
        for i in (3,7,11):
            _,h,a=packs[i][0];packs[i][0]="boss_splash",h,a
        for i,j in ((1,0),(6,1),(9,0),(10,1)):
            _,h,a=packs[i][j];packs[i][j]="ranged",h,a
    return packs


def simulate(branch,packs,order):
    return m.run(branch,packs=packs,
                 unlock_order=("G","H","Z","T","N"),
                 return_fire=True,gou_pierce=6,genzo_repeat=3,
                 action_order=order)


def compare(a,b):
    if a[0] and not b[0]:return "lost"
    if b[0] and not a[0]:return "saved"
    if a[0] and b[0]:
        return "faster" if b[1]<a[1] else "slower" if a[1]<b[1] else "tie"
    return "both_lost"


if __name__=="__main__":
    normal=m.NAMES
    neighbors=[normal[:i]+(normal[i+1],normal[i])+normal[i+2:]
               for i in range(4)]
    for kind in ("base","hard"):
        packs=enemy_packs(kind)
        for target in neighbors:
            counts={x:0 for x in ("lost","saved","faster","slower",
                                   "tie","both_lost")}
            for bits in product("AB",repeat=5):
                branch="".join(bits)
                result=compare(simulate(branch,packs,normal),
                               simulate(branch,packs,target))
                counts[result]+=1
            print(kind,"swap",normal,"->",target,counts)

    for branch in ("BABAB","AAAAA"):
        for delta in (-1,0,1):
            packs=enemy_packs(hp_shift=delta)
            for order in (normal,neighbors[0]):
                victories=0
                for p,q,r in product(*[list(permutations(range(s,s+3)))
                                       for s in (0,4,8)]):
                    route=list(p)+[3]+list(q)+[7]+list(r)+[11]
                    victories+=simulate(branch,[packs[i] for i in route],order)[0]
                print(branch,"HP shift",delta,"order",order,"wins",victories,"/216")
