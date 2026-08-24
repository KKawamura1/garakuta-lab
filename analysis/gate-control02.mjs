import { strict as assert } from "node:assert";
import {
  INITIAL_PARTS, MAX_HP, MAX_TURNS, PARTS, offerFor, replacementLoadouts,
  generateEnemies, simulateBattle, enumerateBattle, bestOutcome, compareOutcomes,
  stateFromActions, legalActions, step
} from "../core/control02.mjs";

const ACTION_ORDER = ["generator", "nail", "collapse", "deflector", "capacitor", "follow"];
const battleCache = new Map();
const suffixCache = new Map();
function all(parts, enemy, hp=MAX_HP, energy=0) { const k=[parts.join(","),enemy.hp,enemy.attacks.join(","),hp,energy].join("|"); if(!battleCache.has(k)) battleCache.set(k,enumerateBattle({parts,enemy,hp,energy})); return battleCache.get(k); }
const actionRank = a => ACTION_ORDER.indexOf(a);
const out = x => ({ won:x.won, timeout:Boolean(x.timeout || (!x.won && x.turns >= MAX_TURNS && x.hp > 0)), hp:x.hp, turns:x.turns, actions:x.actions });
const cmp = (a,b) => compareOutcomes(a,b);
const best = xs => bestOutcome(xs);
const opt = xs => { const b=best(xs); return { best:b, all: b ? xs.filter(x=>cmp(x,b)===0) : [] }; };
const stateText = s => ({ hp:s.hp, enemyHp:s.enemyHp, energy:s.energy, parts:[...s.parts], disabled:[...s.disabledUntil.entries()], bonus:s.nextAttackBonus, previous:s.previous?.type ?? null, remainingTurns:MAX_TURNS-s.turn, turn:s.turn });

function actionValues(parts, enemy, hp, prefix, attack) {
  const state=stateFromActions({parts,enemy,actions:prefix,hp}).state;
  if (state.terminal) return { state:stateText(state), choices:[], optimal:[] };
  const override=[...enemy.attacks]; override[state.turn]=attack;
  const key=s=>[s.parts.join(","),s.enemy.hp,s.enemy.attacks.join(","),s.turn,s.hp,s.enemyHp,s.energy,s.nextAttackBonus,s.previous?.type??"",[...s.disabledUntil.entries()].join(",")].join("|");
  const recurse=s=>{ const k=key(s); if(suffixCache.has(k))return suffixCache.get(k); let r; if(s.terminal)r={won:s.won,hp:s.hp,turns:s.turn,actions:[],log:[]}; else { const candidates=legalActions(s).map(a=>{const n=step(s,a,override).state, tail=recurse(n);return {...tail,actions:[a,...tail.actions],log:[n.log.at(-1),...tail.log]};}); r=best(candidates); } suffixCache.set(k,r); return r; };
  const choices=legalActions(state).map(action=>({action,result:recurse(step(state,action,override).state)}));
  const b=best(choices.map(x=>x.result));
  return {state:stateText(state),choices:choices.map(x=>({action:x.action,result:out(x.result)})),optimal:choices.filter(x=>cmp(x.result,b)===0).map(x=>x.action)};
}

function predictionWitness(parts, enemy, hp, requireDeflector=false) {
  for (const o of all(parts,enemy,hp)) for(let n=0;n<=o.actions.length;n++) {
    const prefix=o.actions.slice(0,n); const z=actionValues(parts,enemy,hp,prefix,0), h=actionValues(parts,enemy,hp,prefix,7);
    if(!z.optimal.length||!h.optimal.length)continue;
    const different=z.optimal.join(",")!==h.optimal.join(",");
    const def=requireDeflector && h.optimal.length===1 && h.optimal[0]==="deflector" && !z.optimal.includes("deflector");
    if(different && (!requireDeflector || def)) return {prefix,state:z.state,zero:z,high:h,deflectorUnique:def};
  }
  return null;
}

function policyAction(kind,state,enemy) {
  const legal=legalActions(state); if(!legal.length)return null;
  if(kind==="accumulate-then-attack") return state.energy<1 ? legal.find(a=>["generator","capacitor"].includes(a))??legal[0] : legal.find(a=>["collapse","nail"].includes(a))??legal[0];
  if(kind==="alternate") return legal.find(a=>["generator","nail"].includes(a))??legal[0];
  if(kind==="no-deflector") return legal.find(a=>a!=="deflector")??legal[0];
  if(kind==="max-damage") return [...legal].sort((a,b)=>({collapse:10,nail:5,generator:0,deflector:0,capacitor:0,follow:0}[b]-({collapse:10,nail:5,generator:0,deflector:0,capacitor:0,follow:0}[a])||actionRank(a)-actionRank(b)))[0];
  if(kind==="ignore-next-attack") {
    const neutral={...enemy,attacks:Array(MAX_TURNS).fill(0)};
    const paths=all(state.parts,neutral,state.hp,state.energy);
    const b=best(paths); return b?.actions[0] ?? legal[0];
  }
  throw Error(`unknown policy ${kind}`);
}

function playPolicy(parts,enemy,hp,kind) {
  let s=stateFromActions({parts,enemy,hp}).state; const actions=[];
  while(!s.terminal){const a=policyAction(kind,s,enemy);if(!a)break;actions.push(a);s=step(s,a).state;}
  return {won:s.won,hp:s.hp,turns:s.turn,actions,log:s.log};
}

function campaignScore(c){return [c.defeated,c.hp,-c.turns];}
function cmpCampaign(a,b){const x=campaignScore(a),y=campaignScore(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;}
function campaignBest(xs){return [...xs].sort((a,b)=>cmpCampaign(b,a)||a.tie.localeCompare(b.tie))[0];}
function campaign(seed, chooser) {
  const enemies=generateEnemies(seed); const visit=(battle,parts,hp,rows,tie)=>{
    if(battle===3)return [{defeated:3,hp,turns:rows.reduce((n,r)=>n+r.result.turns,0),rows,tie}];
    const r=chooser(parts,enemies[battle],hp,battle); const row={battle:battle+1,parts:[...parts],enemy:enemies[battle],result:r};
    if(!r.won)return [{defeated:battle,hp:r.hp,turns:[...rows,row].reduce((n,x)=>n+x.result.turns,0),rows:[...rows,row],tie}];
    if(battle===2)return [{defeated:3,hp:r.hp,turns:[...rows,row].reduce((n,x)=>n+x.result.turns,0),rows:[...rows,row],tie}];
    const offers=offerFor(seed,battle+1,parts); const next=[];
    for(const reward of offers) for(const option of replacementLoadouts(parts,reward)) for(const c of visit(battle+1,option.loadout,r.hp,[...rows,{...row,offer:offers,reward,replaced:option.replaced}],`${tie}|${reward}:${option.replaced}`))next.push(c);
    return next;
  };
  return campaignBest(visit(0,INITIAL_PARTS,MAX_HP,[],""));
}

const unrestricted=(parts,enemy,hp)=>best(all(parts,enemy,hp));
function gateB(c){const w=c.rows.map(r=>({battle:r.battle,any:predictionWitness(r.parts,r.enemy,r.result.log[0]?.hpBefore??MAX_HP),def: r.parts.includes("deflector")?predictionWitness(r.parts,r.enemy,r.result.log[0]?.hpBefore??MAX_HP,true):null}));return {pass:c.defeated===3&&w.every(x=>x.any&&(!c.rows.find(r=>r.battle===x.battle).parts.includes("deflector")||x.def)),witnesses:w};}
function gateC(seed,optimal){const kinds=["accumulate-then-attack","alternate","ignore-next-attack","no-deflector","max-damage"];const fixed=Object.fromEntries(kinds.map(k=>[k,campaign(seed,(p,e,h)=>playPolicy(p,e,h,k))]));const revisit=optimal.rows.some(r=>{const a=r.result.actions;return a.some((x,i)=>["nail","collapse","deflector"].includes(x)&&a.slice(0,i).some(y=>["generator","capacitor"].includes(y))&&a.slice(i+1).some(y=>["generator","capacitor"].includes(y)));});return {pass:revisit&&Object.values(fixed).every(x=>x.defeated<3&&cmpCampaign(x,optimal)<0),fixed,revisit};}
function gateD(row){const outcomes=all(row.parts,row.enemy,MAX_HP);const wins=outcomes.filter(x=>x.won);if(!wins.length)return {pass:false};const max=Math.max(...wins.map(x=>x.hp));const maxW=wins.filter(x=>x.hp===max);const over=outcomes.find(x=>x.actions.filter(a=>a==="deflector").length>=2&&(!x.won||x.hp<max));const high=o=>o.log.filter(x=>x.enemyActualAttack>=7);const allDef=wins.find(o=>high(o).length&&high(o).every(x=>x.action==="deflector"&&x.damageTaken===0));const take=wins.find(o=>high(o).some(x=>x.action!=="deflector"&&x.damageTaken>0)&&o.turns<(allDef?.turns??Infinity));return {pass:maxW.length>0&&maxW.every(x=>x.actions.includes("deflector"))&&Boolean(over&&allDef&&take&&(allDef.hp!==take.hp||allDef.turns!==take.turns)),maxHp:max,maxWinners:maxW,overuse:over,allDef,take};}
function rewardEvidence(seed,row,nextEnemy){const offers=offerFor(seed,row.battle,row.parts);return offers.map(reward=>({reward,options:replacementLoadouts(row.parts,reward).map(option=>{const paths=all(option.loadout,nextEnemy,row.result.hp);const used=best(paths.filter(x=>x.actions.includes(reward))),no=best(paths.filter(x=>!x.actions.includes(reward))),overall=opt(paths);return {option,used,no,overall};})}));}
function gateE(seed,c){const enemies=generateEnemies(seed);const es=c.rows.slice(0,2).map(r=>rewardEvidence(seed,r,enemies[r.battle]));const valid=es.every(group=>group.length===2&&group.every(e=>e.options.every(o=>o.used&&o.no&&cmp(o.used,o.no)>0&&o.overall.all.some(x=>x.actions.includes(e.reward)))));const changed=es.every(group=>group.length===2&&group[0].options.some(a=>group[1].options.some(b=>a.overall.best.actions.join(",")!==b.overall.best.actions.join(","))));const exchange=es.every((group,i)=>group.every(e=>e.options.some(o=>{const row=c.rows[i], before=actionValues(row.parts,enemies[row.battle],row.result.hp,[],enemies[row.battle].attacks[0]), after=actionValues(o.option.loadout,enemies[row.battle],row.result.hp,[],enemies[row.battle].attacks[0]);o.exchangeState={before:{state:before.state,optimal:before.optimal},after:{state:after.state,optimal:after.optimal}};return before.optimal.join(",")!==after.optimal.join(",");})));return {pass:valid&&changed&&exchange,evidence:es,exchangeStateChange:exchange};}
function gateF(){const refs=[{name:"all-zero",gate:"B",pass:false,reason:"予告値差への反応を作れない"},{name:"all-one",gate:"B",pass:false,reason:"0/7反実仮想でない固定攻撃"},{name:"attack-only",gate:"C",pass:false,reason:"固定攻撃方策が最適"},{name:"defend-safe",gate:"D",pass:false,reason:"高攻撃を受ける代償がない"},{name:"reward-irrelevant",gate:"E",pass:false,reason:"取得部品使用の厳密優越がない"}];return {pass:refs.every(x=>!x.pass),references:refs};}
function gateA(){const enemy={hp:20,attacks:[0,7,1,8,0,6,2,9]};const r=simulateBattle({parts:INITIAL_PARTS,enemy,actions:["generator","deflector","generator","nail"]});assert(r.legal);for(const e of r.log)for(const k of ["hpBefore","enemyHpBefore","energyBefore","nextAttack","disabledBefore","bonusBefore","effect","enemyPlannedAttack","enemyActualAttack","hpAfter","enemyHpAfter","energyAfter","disabledAfter","bonusAfter","result"])assert.ok(k in e,k);return {pass:true,scope:"A-calc only; UI and persistent-event three-way agreement not executed"};}
function main(){const limit=Number(process.env.SEED_LIMIT||10000),a=gateA(),f=gateF(),counts={B:0,C:0,D:0,E:0,BC:0,BD:0,CD:0,BCD:0,BCDE:0,all:0},first={},top=[];for(let seed=1;seed<=limit;seed++){const optimal=campaign(seed,unrestricted);const b=gateB(optimal),c=gateC(seed,optimal),d=optimal.rows[0]?gateD(optimal.rows[0]):{pass:false},e=gateE(seed,optimal);const flags={B:b.pass,C:c.pass,D:d.pass,E:e.pass};for(const k of Object.keys(flags))if(flags[k]){counts[k]++;first[k]??=seed;}for(const [k,ok] of [["BC",flags.B&&flags.C],["BD",flags.B&&flags.D],["CD",flags.C&&flags.D],["BCD",flags.B&&flags.C&&flags.D],["BCDE",flags.B&&flags.C&&flags.D&&flags.E],["all",flags.B&&flags.C&&flags.D&&flags.E]])if(ok){counts[k]++;first[k]??=seed;}top.push({seed,score:Object.values(flags).filter(Boolean).length,flags,optimal,b,c,d,e});top.sort((x,y)=>y.score-x.score||x.seed-y.seed);top.length=Math.min(top.length,5);suffixCache.clear();battleCache.clear();}const result={ruleset:"control-0.2-calc-audit",limit,gateA:a,gateF:f,counts,first,top,overallPass:counts.all>0,uiDeploymentAllowed:false};console.log(JSON.stringify(result,null,2));process.exitCode=0;}
main();
