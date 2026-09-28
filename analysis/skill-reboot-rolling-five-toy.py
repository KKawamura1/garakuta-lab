from itertools import product, permutations

NAMES = ('N','H','T','G','Z')
WAVES = [
    [('m',3,2),('m',3,2)], [('m',5,3)], [('m',4,2),('m',4,2)],
    [('boss',20,6)], [('m',3,2),('m',3,2),('m',3,2)],
    [('m',8,3),('heal',4,2)], [('m',9,3),('m',6,2)],
    [('boss',26,7)], [('m',4,2),('m',4,2),('m',4,2)],
    [('m',10,3),('heal',4,2)], [('m',10,3),('m',9,3)],
    [('boss',35,9),('heal',5,2)],
]
MAXHP={'G':12,'H':7,'T':8,'N':14,'Z':8}

def run(order, branch, trace=False):
    hp=MAXHP.copy(); shield={x:0 for x in NAMES}
    wi=0; enemies=[]; actions=0; reflected=0; heals=0; clock=5; hit_this_window=set(); last=None; last_z_wave=0; enemy_phases=0
    def enter():
        nonlocal wi,clock,hit_this_window
        if wi>=12: return
        enemies.extend({'id':(wi,j),'kind':kind,'hp':v,'maxhp':v,'atk':atk} for j,(kind,v,atk) in enumerate(WAVES[wi]))
        wi+=1
        clock=5;hit_this_window=set()
        if wi in (5,9):
            for x in NAMES:
                hp[x]=2 if hp[x]==0 else hp[x]+(MAXHP[x]-hp[x]+1)//2
    def damage(val, target=0, spill=False):
        if not enemies: return 0
        i=min(target,len(enemies)-1); total=0; first=True
        while val>0 and i<len(enemies):
            e=enemies[i]; dealt=min(val,e['hp']); e['hp']-=dealt; val-=dealt;total+=dealt
            if dealt:hit_this_window.add(e['id'])
            if e['hp']==0:
                enemies.pop(i)
                if not enemies:enter()
                if not spill:break
                if first:val+=4;first=False
                else:break
            else:break
        return total
    enter()
    for slot in range(750):
        if wi==12 and not enemies: break
        who=order[slot%5]; before_wi=wi
        if hp[who]>0 and enemies:
            target=enemies[0]['id']; actions+=1
            if who=='N':
                shield['N']=min(3,shield['N']+(2 if branch['N']=='A' else 1))
                damage(1);last=1
            elif who=='H':
                if branch['H']=='B' and len(enemies)>1:
                    damage(2,len(enemies)-1);last=2;hp['H']=max(0,hp['H']-1)
                else:
                    old=enemies[0]['id']; damage(1);last=1
                    if branch['H']=='A' and all(e['id']!=old for e in enemies) and enemies:damage(3)
            elif who=='T':
                old=enemies[0]['id']; damage(2);last=2
                wound=max((MAXHP[x]-hp[x],x) for x in NAMES if hp[x]>0)
                actual=min(1,wound[0]);hp[wound[1]]+=actual;heals+=actual
                if branch['T']=='A' and all(e['id']!=old for e in enemies):
                    wound=max((MAXHP[x]-hp[x],x) for x in NAMES if hp[x]>0)
                    actual=min(2,wound[0]);hp[wound[1]]+=actual;heals+=actual
                if branch['T']=='B' and actual and enemies:damage(actual,len(enemies)-1)
            elif who=='G':
                power=6 if branch['G']=='B' and target in hit_this_window else 3
                damage(power,spill=branch['G']=='A');last=power
                if power==6:
                    spent=min(2,shield['G']);shield['G']-=spent
                    hp['G']=max(0,hp['G']-(2-spent))
            elif who=='Z':
                power=((last or 1) if branch['Z']=='A' else (3 if last_z_wave!=wi else 1))
                damage(power,len(enemies)-1 if branch['Z']=='B' and power==3 else 0)
                last=power;last_z_wave=wi
            if trace:print(slot,who,'wave',wi,'clock',clock,'enemies',[(e['kind'],e['hp']) for e in enemies],'hp',hp,'sh',shield)
        else:last=None
        if wi==12 and not enemies:break
        if before_wi!=wi:continue
        clock-=1
        if clock>0:continue
        enemy_phases+=1;clock=5;hit_this_window=set();reflected_this_phase=False;last=None
        for e in list(enemies):
            if e['kind']=='heal':
                if enemies:enemies[0]['hp']=min(enemies[0]['maxhp'],enemies[0]['hp']+2)
            else:
                tgt=next((x for x in ('N','G','H','Z','T') if hp[x]>0),None)
                if tgt is None:break
                prevented=min(e['atk'],shield[tgt]);shield[tgt]-=prevented
                hurt=min(e['atk']-prevented,hp[tgt]);hp[tgt]-=hurt
                if branch['N']=='B' and tgt=='N' and prevented and not reflected_this_phase:
                    e['hp']-=prevented;reflected+=1;reflected_this_phase=True
                    if e['hp']<=0:
                        enemies.remove(e)
                        if not enemies:enter()
        if not any(hp.values()):break
    return wi==12 and not enemies and any(hp.values()),wi,slot+1,actions,reflected,heals,sum(hp.values()),enemy_phases

if __name__=='__main__':
    rows=[]
    for order in permutations(NAMES):
        for choices in product('AB',repeat=5):
            branch=dict(zip(NAMES,choices))
            result=run(order,branch)
            rows.append((result,order,''.join(choices)))
    wins=[r for r in rows if r[0][0]]
    print('runs',len(rows),'wins',len(wins))
    for x in NAMES:
        for b in 'AB':
            subset=[r for r in rows if dict(zip(NAMES,r[2]))[x]==b]
            print(x,b,'win',sum(r[0][0] for r in subset),'of',len(subset))
    for r in sorted(wins,key=lambda r:(r[0][2],-r[0][-1]))[:8]:print('fast',r)
    for r in sorted(wins,key=lambda r:(-r[0][2],-r[0][-1]))[:8]:print('slow',r)
