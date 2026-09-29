/* Tiny deterministic counterexample for design note 46. It is not a product engine. */
(function(root){
  'use strict';
  const order=['H','G','Z','T','N'];
  const names={H:'ヒバナ',G:'ゴウ',Z:'ゲンゾウ',T:'ツグミ',N:'ナギ'};
  const deck=[
    ['煤鼠',16,2],['灰射手',11,3],['煤兵',23,2],['長槍',13,4],
    ['黒鎧',25,1],['煙狼',18,3],['門番',28,1],['火喰い',14,4],
    ['灰群',22,2],['瘴気兵',20,3],['巨兵',30,1],['追撃者',24,4]
  ];
  function create(plan=['G:A','H:A','T:A']){
    return {plan:[...plan],active:[],hp:12,carry:0,defeated:0,round:0,
      next:1,current:enemy(0),second:null,done:false,events:[]};
  }
  function enemy(i){const [name,hp,attack]=deck[i];return {i,name,hp,max:hp,attack};}
  function pairsOf(suits){
    const pairs=[];for(let i=0;i<4;i++)if(suits[i]===suits[i+1]){pairs.push(i);i++;}
    return pairs;
  }
  function hand(s){
    const has=x=>s.active.includes(x);
    let z='鉄';
    if(has('Z:A'))z='水';
    if(has('Z:B')){
      // Both neighbors offer exactly one pair. The declared tie rule picks left.
      const left=pairsOf(['火','鉄','鉄','水','盾']).length;
      const right=pairsOf(['火','鉄','水','水','盾']).length;
      z=right>left?'水':'鉄';
    }
    const suits=['火','鉄',z,'水','盾'];
    const pairs=pairsOf(suits);
    let flows=0;for(let i=0;i<3;i++)if(new Set(suits.slice(i,i+3)).size===3)flows++;
    const base=10+(has('G:B')&&!pairs.some(i=>i===1||i===0)?6:0);
    const pairPoints=pairs.reduce((total,i)=>total+4+(has('G:A')&&(i===0||i===1)?4:0),0);
    const flowPoints=flows*(4+(has('H:B')?2:0));
    const tuning=has('T:B')&&flows>=2?6:0;
    return {suits,pairs,flows,base,pairPoints,flowPoints,tuning,carry:s.carry,
      score:base+pairPoints+flowPoints+tuning+s.carry,
      defense:has('N:B')&&s.second?4:has('N:A')&&pairs.length?3:1};
  }
  function turn(s,pull=false){
    if(s.done) return null;
    if(pull && !s.second && s.next<deck.length) s.second=enemy(s.next++);
    s.round++;
    const score=hand(s), e=[], prior=s.defeated;
    let damage=score.score;
    s.carry=0;
    const first=s.current;
    const firstBefore=first.hp;
    first.hp=Math.max(0,first.hp-damage);
    damage=Math.max(0,damage-firstBefore);
    if(first.hp===0){s.defeated++;e.push(`${names.H}たちが${first.name}を撃破`);}
    if(first.hp===0&&s.second){
      if(s.active.includes('H:A')){damage+=8;e.push('ヒバナの余火 +8');}
      const secondBefore=s.second.hp;
      s.second.hp=Math.max(0,s.second.hp-damage);
      damage=Math.max(0,damage-secondBefore);
      if(s.second.hp===0){s.defeated++;e.push(`${s.second.name}も撃破`);}
    }
    if(s.active.includes('H:B')&&first.hp===0)s.carry=Math.min(4,damage);
    const enemyAttack=(first.hp>0?first.attack:0)+(s.second&&s.second.hp>0?s.second.attack:0);
    const blocked=Math.min(score.defense,enemyAttack);
    const suffered=enemyAttack-blocked;
    s.hp=Math.max(0,s.hp-suffered);
    if(enemyAttack)e.push(`反撃${enemyAttack}、ナギが${blocked}防御、灰火−${suffered}`);
    if(s.active.includes('T:A')&&score.flows>0&&s.hp>0){
      const heal=Math.min(2,score.flows,12-s.hp);s.hp+=heal;
      if(heal)e.push(`ツグミが灰火+${heal}`);
    }
    if(first.hp===0){
      if(s.second){s.current=s.second;s.second=null;}
      else if(s.next<deck.length)s.current=enemy(s.next++);
      else s.current=null;
    }
    if(s.current?.hp===0){
      if(s.next<deck.length)s.current=enemy(s.next++);
      else s.current=null;
    }
    for(const threshold of [3,6,9])if(prior<threshold&&s.defeated>=threshold){
      const skill=s.plan[[3,6,9].indexOf(threshold)];
      if(skill&&!s.active.includes(skill)){s.active.push(skill);e.push(`${threshold}体撃破：${names[skill[0]]} ${skill.slice(2)}が起動`);}
    }
    if(s.hp<=0){s.done='lose';e.push('灰火が尽きた');}
    else if(s.defeated>=deck.length){s.done='win';e.push('十二枚を突破');}
    const record={round:s.round,pull,score,events:e,defeated:s.defeated,hp:s.hp,
      first:first.name,firstLeft:first.hp,secondLeft:s.second?.hp??null};
    s.events.push(record);
    return record;
  }
  function run(plan,decide=()=>false){
    const s=create(plan);
    while(!s.done&&s.round<80)turn(s,decide(s,hand(s)));
    return s;
  }
  root.AshFiveHand={create,hand,turn,run,deck,order,names};
  if(typeof module!=='undefined')module.exports=root.AshFiveHand;
})(globalThis);
