"""Stress the counterfire toy against tiny HP and rest-rule changes."""
from itertools import permutations, product
from pathlib import Path
import importlib.util

source = Path(__file__).with_name("skill-reboot-counterfire-toy.py")
if not source.exists():
    source = Path(__file__).with_name("conveyor_fire_toy.py")
spec = importlib.util.spec_from_file_location("counterfire", source)
toy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(toy)


def groups(shift):
    packs = [[(kind, max(1, round(hp*1.2)+shift), atk)
              for kind,hp,atk in pack] for pack in toy.PACKS]
    for i in (3,7,11):
        _,hp,atk=packs[i][0]
        packs[i][0]=("boss_splash",hp,atk)
    for i,j in ((1,0),(6,1),(9,0),(10,1)):
        _,hp,atk=packs[i][j]
        packs[i][j]=("ranged",hp,atk)
    return packs


def play(branch,packs,unlock=toy.NAMES,rests=True):
    return toy.run(branch,packs=packs,unlock_order=unlock,
                   return_fire=True,gou_pierce=6,genzo_repeat=3,
                   rests=rests)


if __name__=="__main__":
    for shift in (-1,0,1):
        packs=groups(shift)
        print("HP shift",shift)
        for bits in ("BAAAA","BBAAA","AABBB","ABBBB"):
            result=play(bits,packs)
            print(bits,"win",result[0],"actions",result[1])
        safe=0
        for unlock in (toy.NAMES,("G","Z","N","T","H")):
            for first in permutations(range(3)):
                for middle in permutations(range(4,7)):
                    for last in permutations(range(8,11)):
                        indices=list(first)+[3]+list(middle)+[7]+list(last)+[11]
                        safe+=play("AAABA",[packs[i] for i in indices],unlock)[0]
        print("safe AAABA",safe,"/432")
    packs=groups(0)
    for rests in (True,False):
        results=[("".join(bits),play("".join(bits),packs,unlock,rests))
                 for unlock in permutations(toy.NAMES)
                 for bits in product("AB",repeat=5)]
        print("rests",rests,"wins",sum(r[0] for _,r in results),
              "/3840","safe",sum(r[0] for bits,r in results if bits=="AAABA"),
              "/120")
