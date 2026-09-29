from itertools import permutations, product

NAMES=('N','H','T','G','Z')
MAXHP={'G':12,'H':7,'T':8,'N':14,'Z':8}
WAVES=[
 [('m',3,2),('m',3,2)], [('m',5,3)], [('m',4,2),('m',4,2)],
 [('boss',20,6)], [('m',3,2),('m',3,2),('m',3,2)],
 [('m',8,3),('heal',4,2)], [('m',9,3),('m',6,2)],
 [('boss',26,7)], [('m',4,2),('m',4,2),('m',4,2)],
 [('m',10,3),('heal',4,2)], [('m',10,3),('m',9,3)],
 [('boss',35,9),('heal',5,2)],
]

def run(order,branch,trace=False):
 hp=MAXHP.copy();shield={x:0 for x in NAMES};enemies=[];wi=0;clock=0
 last_power=None;last_z_wave=0;enemy_phases=0;heals=0;reflections=0
 def enter():
  nonlocal wi,clock
  if wi>=12:return
  enemies.extend({'id':(wi,j),'kind':k,'hp':v,'maxhp':v,'atk':a} for j,(k,v,a) in enumerate(WAVES[wi]))
  wi+=1;clock=0
  if wi in (5,9):
   for x in NAMES:hp[x]=2 if not hp[x] else hp[x]+(MAXHP[x]-hp[x]+1)//2
 def damage(v,target=0,spill=0):
  if not enemies:return
  target=min(target,len(enemies)-1);used_spill=False
  while v>0 and target<len(enemies):
   e=enemies[target];d=min(e['hp'],v);e['hp']-=d;v-=d
   if e['hp']>0:break
   enemies.pop(target)
   if not enemies:enter()
   if not spill or used_spill:break
   v+=spill;used_spill=True
 def heal(v):
  nonlocal heals
  alive=[x for x in ('N','G','H','Z','T') if hp[x]>0]
  if not alive:return
  x=max(alive,key=lambda x:MAXHP[x]-hp[x]);d=min(v,MAXHP[x]-hp[x]);hp[x]+=d;heals+=d
 def enemy_phase():
  nonlocal enemy_phases,reflections,last_power
  enemy_phases+=1;prevent_reflect=False;last_power=None
  for e in list(enemies):
   if e not in enemies:continue
   if e['kind']=='heal':
    if enemies:enemies[0]['hp']=min(enemies[0]['maxhp'],enemies[0]['hp']+2)
    continue
   target=next((x for x in ('N','G','H','Z','T') if hp[x]>0),None)
   if target is None:break
   blocked=min(e['atk'],shield[target]);shield[target]-=blocked
   hp[target]=max(0,hp[target]-(e['atk']-blocked))
   if target=='N' and branch['N']=='B' and blocked and not prevent_reflect:
    e['hp']-=blocked;reflections+=1;prevent_reflect=True
    if e['hp']<=0:
     enemies.remove(e)
     if not enemies:enter()
 enter()
 for slot in range(750):
  if wi==12 and not enemies:break
  who=order[slot%5];start_wave=wi;cost=1
  if hp[who]>0 and enemies:
   if who=='N':
    cost=0 if branch['N']=='A' else 1
    shield['N']=min(3,shield['N']+(1 if branch['N']=='A' else 2))
   elif who=='H':
    if branch['H']=='A':cost=0;damage(1);last_power=1
    else:cost=2;damage(5,len(enemies)-1 if len(enemies)>1 else 0);last_power=5
   elif who=='T':
    power=2 if branch['T']=='A' else 1
    damage(power);heal(1 if branch['T']=='A' else 3);last_power=power
   elif who=='G':
    power=7 if branch['G']=='A' else 3;cost=2 if branch['G']=='A' else 1
    damage(power,spill=0 if branch['G']=='A' else 3);last_power=power
   elif who=='Z':
    if branch['Z']=='A':cost=2;power=last_power or 1
    else:cost=1;power=3 if last_z_wave!=wi else 1
    damage(power);last_power=power;last_z_wave=start_wave
  else:last_power=None
  if trace:print(slot,who,wi,clock,cost,[(e['kind'],e['hp']) for e in enemies],hp,shield)
  if wi==12 and not enemies:break
  if start_wave!=wi:continue
  clock+=cost
  if clock>=5:
   clock-=5
   enemy_phase()
   if not any(hp.values()):break
 return wi==12 and not enemies and any(hp.values()),wi,slot+1,enemy_phases,heals,reflections,sum(hp.values())

if __name__=='__main__':
 rows=[]
 for order in permutations(NAMES):
  for choices in product('AB',repeat=5):
   branch=dict(zip(NAMES,choices));rows.append((run(order,branch),order,''.join(choices)))
 wins=[x for x in rows if x[0][0]]
 print('runs',len(rows),'wins',len(wins))
 for x in NAMES:
  for b in 'AB':
   subset=[r for r in rows if dict(zip(NAMES,r[2]))[x]==b]
   print(x,b,'win',sum(r[0][0] for r in subset),'of',len(subset))
 for r in sorted(wins,key=lambda v:(v[0][2],-v[0][-1]))[:8]:print('fast',r)
 for r in sorted(wins,key=lambda v:(-v[0][-1],v[0][2]))[:8]:print('healthy',r)
