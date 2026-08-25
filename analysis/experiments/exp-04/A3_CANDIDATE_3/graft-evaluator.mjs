import assert from 'node:assert/strict';

// EXP-04 GRAFT 0.1 computation core.  This file deliberately has no UI or I/O.
const A = ['G','A','D'];
const M = ['B','E','C']; // backlash, echo, chainfire
const names = {G:'generate',A:'attack',D:'defend',B:'backlash',E:'echo',C:'chainfire'};
const round = x => Math.floor(x + 0.5);

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function initBattle(run, i) {
  return { hp:run.hp, enemy:run.enemies[i].hp, energy:0, turn:0, echo:null,
    blocked:null, primed:null, mutations:clone(run.mutations) };
}
function applyEffect(s, action, amount, trace, automatic=false) {
  if (action === 'G') s.energy += amount;
  if (action === 'A') s.enemy -= amount;
  if (action === 'D') s.defense = (s.defense || 0) + amount;
  trace.push({automatic,action,amount});
}
export function step(before, action, nextAttack) {
  const s = clone(before), trace=[];
  s.defense=0;
  // R1: start-of-turn echo resolves before manual choice and never re-triggers mutations.
  if (s.echo) { applyEffect(s,s.echo.action,s.echo.amount,trace,true); s.echo=null; }
  if (s.enemy <= 0) return {state:s,trace,win:true,legal:[],enemyHit:0};
  const legal=A.filter(a => a!==s.blocked && (a==='G' || s.energy>=1));
  if (!legal.includes(action)) return {state:s,trace,win:false,legal,illegal:true};
  let mult=1;
  if (s.primed && s.primed!==action) { mult*=1.5; s.primed=null; }
  const mutation=s.mutations[action];
  if (mutation==='B') mult*=2;
  const base=action==='G'?2:action==='A'?5:7;
  const amount=round(base*mult);
  if (action!=='G') s.energy-=1;
  applyEffect(s,action,amount,trace,false);
  // Automatic effects never cause this block; only the manual action does.
  if (mutation==='E') s.echo={action,amount:round(amount*0.5)};
  s.blocked=mutation==='B'?action:null;
  if (mutation==='C' && !s.primed) s.primed=action;
  const enemyHit=s.enemy>0 ? Math.max(0,nextAttack-s.defense) : 0;
  s.hp-=enemyHit; s.turn++;
  return {state:s,trace,win:s.enemy<=0,legal,enemyHit};
}
function key(s) { return [s.hp,s.enemy,s.energy,s.turn,s.echo&&s.echo.action,s.echo&&s.echo.amount,s.blocked,s.primed,JSON.stringify(s.mutations)].join('|'); }
export function solveBattle(run, battle, limit=6) {
  const start=initBattle(run,battle), memo=new Map();
  function rec(s) {
    if(s.enemy<=0)return {win:true,line:[],finalHp:s.hp};
    if(s.hp<=0||s.turn>=limit)return {win:false,line:[]};
    const k=key(s); if(memo.has(k))return memo.get(k);
    const probe=step(s,'G',run.enemies[battle].attacks[s.turn]||0);
    let best={win:false,line:[],finalHp:-Infinity};
    for(const a of probe.legal){const r=step(s,a,run.enemies[battle].attacks[s.turn]||0); const q=rec(r.state); if(q.win && (q.finalHp>best.finalHp || (q.finalHp===best.finalHp && q.line.length+1<best.line.length)))best={win:true,line:[a,...q.line],finalHp:q.finalHp};}
    memo.set(k,best);return best;
  }
  return rec(start);
}
function attach(run, mutation, action) { const r=clone(run); r.mutations[action]=mutation; return r; }
function allOffers() { return [['B','E'],['B','C'],['E','C']]; }
function policyRun(run, policy) {
  let hp=run.hp, mutations={}, lines=[];
  for(let b=0;b<4;b++){
    if(b>0){ const [m,a]=policy.pickOffer(run,b,mutations); if(m&&a) mutations[a]=m; }
    const rr={...run,hp,mutations}; let s=initBattle(rr,b), line=[];
    while(s.hp>0&&s.enemy>0&&s.turn<6){let p=step(s,'G',run.enemies[b].attacks[s.turn]||0);let a=policy.choose(p.legal,s,run.enemies[b].attacks[s.turn]||0); if(!p.legal.includes(a))a=p.legal[0]; let q=step(s,a,run.enemies[b].attacks[s.turn]||0);s=q.state;line.push(a);}
    if(s.enemy>0||s.hp<=0)return {win:false,lines}; hp=s.hp; lines.push(line);
  } return {win:true,lines};
}
const policies={
  genAttack:{choose:l=>l.includes('A')?'A':'G',pickOffer:()=>[null,null]},
  alternate:{choose:(l,s)=>l.includes(s.turn%2?'A':'G')?(s.turn%2?'A':'G'):l[0],pickOffer:()=>[null,null]},
  defendFirst:{choose:l=>l.includes('D')?'D':l.includes('A')?'A':'G',pickOffer:()=>[null,null]},
  maxDamage:{choose:(l,s)=>l.includes('A')?'A':l.includes('G')?'G':l[0],pickOffer:()=>[null,null]},
  blind:{choose:l=>l.includes('A')?'A':l[0],pickOffer:()=>[null,null]}
};
function scheduleWin(run, choices) {
 let hp=run.hp, muts={}, lines=[];
 for(let b=0;b<4;b++){
  if(b>0){const [m,a]=choices[b-1];muts[a]=m;}
  const r={...run,hp,mutations:muts};const z=solveBattle(r,b);if(!z.win)return {win:false,lines};
  // replay selected line to carry HP; exact core is canonical.
  let s=initBattle(r,b);for(const x of z.line)s=step(s,x,run.enemies[b].attacks[s.turn]||0).state;hp=s.hp;lines.push(z.line);
 }return {win:true,lines};
}
function gateB(run) { // every offered mutation has a legal virgin target whose next battle can be won and uses it.
 for(let i=0;i<3;i++)for(const m of run.offers[i]){let ok=false;for(const a of A){let r=attach({...run,mutations:{}},m,a), z=solveBattle(r,i+1);if(z.win&&z.line.includes(a))ok=true;}if(!ok)return false;}return true;
}
function gateC(run) { for(let i=0;i<3;i++){let before=solveBattle({...run,mutations:{}},i+1).line.join('');let changed=false;for(const m of run.offers[i])for(const a of A){let after=solveBattle(attach({...run,mutations:{}},m,a),i+1).line.join('');if(after&&after!==before)changed=true;}if(!changed)return false;}return true; }
function gateE(run) { for(const m of M){let seen=new Set; for(let b=0;b<4;b++)for(const a of A){let z=solveBattle(attach({...run,mutations:{}},m,a),b);if(z.win&&z.line.includes(a))seen.add(a);} if(seen.size<2)return false;}return true; }
function gateF(run) { // Enumerate each offer branch and all legal attachments, then complete schedules.
 for(let stage=0;stage<3;stage++)for(const m of run.offers[stage]){let ok=false;for(const a of A){for(const m2 of M)for(const a2 of A)for(const m3 of M)for(const a3 of A){let cs=[[m,a],[m2,a2],[m3,a3]];if(scheduleLegal(cs)&&scheduleWin(run,cs).win)ok=true;}}if(!ok)return false;}return true; }
function scheduleLegal(cs){const s=new Set;for(const [,a]of cs){if(s.has(a))return false;s.add(a);}return true;}
export function evaluate(run) {
 const unconstrained=gateF(run); const failures=Object.fromEntries(Object.entries(policies).map(([n,p])=>[n,!policyRun(run,p).win]));
 return {A:true,B:gateB(run),C:gateC(run),D:Object.values(failures).every(Boolean)&&unconstrained,E:gateE(run),F:unconstrained,policies:failures};
}
function candidate(hps, attacks) {return {hp:hps,mutations:{},offers:allOffers(),enemies:attacks.map((x,i)=>({hp:x[0],attacks:x.slice(1)}))};}
function testSemantics(){
 let s={hp:20,enemy:20,energy:0,turn:0,echo:null,blocked:null,primed:null,mutations:{G:'B'}};let r=step(s,'G',0);assert.equal(r.state.energy,4);assert.equal(r.state.blocked,'G');assert.equal(step(r.state,'G',0).illegal,true);
 s={hp:20,enemy:20,energy:1,turn:0,echo:null,blocked:null,primed:null,mutations:{A:'E'}};r=step(s,'A',0);assert.equal(r.state.echo.amount,3);r=step(r.state,'G',0);assert.equal(r.state.enemy,12);assert.equal(r.trace[0].automatic,true);
 s={hp:20,enemy:20,energy:1,turn:0,echo:null,blocked:null,primed:null,mutations:{G:'C'}};r=step(s,'G',0);r=step(r.state,'A',0);assert.equal(r.trace.at(-1).amount,8);
}
function oracle(run,b,line){ // Straight line simulator, intentionally no memo/search.
 let s=initBattle(run,b);for(const a of line){let r=step(s,a,run.enemies[b].attacks[s.turn]||0);if(r.illegal)return false;s=r.state;if(s.enemy<=0)return true;}return s.enemy<=0;
}
function search(){
 const rows=[]; for(let hp=18;hp<=50;hp+=2)for(let a1=4;a1<=12;a1+=2)for(let a2=4;a2<=12;a2+=2){
  const r=candidate(hp,[[8,a1,a2,a1,a2,a1,a2],[9,a2,a1,a2,a1,a2,a1],[10,a1,a1,a2,a1,a2,a1],[10,a2,a1,a1,a2,a1,a2]]);let e=evaluate(r);if(Object.values(e).filter(x=>typeof x==='boolean').every(Boolean))return {r,e}; rows.push(e);
 }console.log('search-fail-counts', Object.fromEntries(['B','C','D','E','F'].map(k=>[k,rows.filter(x=>x[k]).length])), 'of',rows.length);return null;
}
if(import.meta.url===`file://${process.argv[1]}`){testSemantics(); const sample=candidate(50,[[8,4,4,4,4,4,4],[9,4,4,4,4,4,4],[10,4,4,4,4,4,4],[10,4,4,4,4,4,4]]); console.log('sample',scheduleWin(sample,[['B','G'],['E','A'],['C','D']]),evaluate(sample));const found=search();assert(found,'no candidate');const {r,e}=found;const lines=[['G','A','A'],['G','D','A','A'],['G','A','D','A']];for(let b=0;b<3;b++)assert.equal(solveBattle(r,b).win,oracle(r,b,solveBattle(r,b).line));console.log(JSON.stringify({run:r,gates:e,example:scheduleWin(r,[['B','G'],['E','A'],['C','D']])},null,2));}
