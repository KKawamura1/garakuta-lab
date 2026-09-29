/* Four-wave falsification toy for notes 56–58, not the main game engine. */
(function(root){
  'use strict';
  const C={x:195,y:250},TAU=Math.PI*2;
  const names={G:'衝突槌',H:'余火',Z:'縫い弩',N:'返し盾',T:'回収薬'};
  const price={G:2,H:5,Z:2,N:2,T:2};
  const shelves=[['G','H','Z'],['H','N','T']];
  const waves=[
    [['small',-1.7,0],['small',3.1,.6],['small',.1,1.2]],
    [['small',-1.5,0],['small',-1.47,.25],['small',-1.53,.5],['small',1.5,.6],['small',1.7,1.0],['shooter',0,.1]],
    [['heavy',-1.5,0],['small',-1.47,.3],['small',-1.53,.7],['small',2.7,.3],['small',3.0,.8],['shooter',.25,.2]],
    [['heavy',-1.6,0],['heavy',2.6,.5],['small',-1.57,.4],['small',-1.63,.8],['small',2.63,.8],['small',2.57,1.1],['small',.15,.4],['small',.4,1.2],['shooter',.1,.1],['shooter',2.2,.9]]
  ];
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const alive=s=>s.enemies.filter(e=>!e.dead&&e.at<=s.time);
  const fx=(s,kind,a,b)=>{s.fx.push({kind,a:{x:a.x,y:a.y},b:b?{x:b.x,y:b.y}:null,until:s.time+.35});};
  const note=(s,v)=>{s.log.unshift(v);s.log=s.log.slice(0,6);};
  function make(opts={}){
    const s={time:0,wave:0,waveAt:0,between:null,hp:12,coin:2,kills:0,leaks:0,
      bought:[],shelf:0,shelfUsed:false,enemies:[],bullets:[],fx:[],log:[],
      ready:{G:0,H:0,Z:0,N:0,T:0,shield:0},id:0,done:null,
      proc:{collision:0,ember:0,pierce:0,reflect:0,healDart:0},
      autoPlan:opts.autoPlan?[...opts.autoPlan]:[]};
    spawn(s);return s;
  }
  function spawn(s){
    s.wave++;s.waveAt=s.time;s.between=null;
    if(s.wave===3){s.shelf=1;s.shelfUsed=false;note(s,'第3波：商品が入れ替わった');}
    for(const [type,angle,delay] of waves[s.wave-1]){
      const r=type==='shooter'?185:178;
      s.enemies.push({id:s.id++,wave:s.wave,type,x:C.x+Math.cos(angle)*r,y:C.y+Math.sin(angle)*r,
        at:s.time+delay,hp:type==='heavy'?5:2,max:type==='heavy'?5:2,
        speed:type==='heavy'?19:type==='shooter'?0:27,shoot:s.time+delay+2.5,
        burn:0,dead:false});
    }
    note(s,`第${s.wave}波が到着`);
  }
  function buy(s,key){
    if(s.done||s.shelfUsed||!shelves[s.shelf].includes(key)||s.bought.includes(key)||s.coin<price[key])return false;
    s.coin-=price[key];s.bought.push(key);s.shelfUsed=true;
    note(s,`${names[key]}を購入（${s.wave}波 ${s.time.toFixed(1)}秒）`);return true;
  }
  function tryAuto(s){
    if(s.autoPlan.length&&buy(s,s.autoPlan[0]))s.autoPlan.shift();
  }
  function hurt(s,e,n,owner,fire=false){
    if(e.dead||e.at>s.time)return;
    if(fire)e.burn=s.time+2;
    e.hp-=n;
    if(e.hp<=0){
      e.dead=true;s.kills++;
      const earned=s.enemies.filter(x=>x.wave===e.wave&&x.dead&&x.hp<=0).length;
      if(earned<=2)s.coin++;
      fx(s,'kill',e);
      note(s,`${owner}が${e.type==='heavy'?'重兵':e.type==='shooter'?'射手':'小兵'}を撃破${e.burn>s.time?' → 余火':''}`);
      if(e.burn>s.time && s.bought.includes('H')){
        const others=alive(s).filter(x=>d(x,e)<=70).sort((a,b)=>d(a,e)-d(b,e)||a.id-b.id);
        if(others[0]){s.proc.ember++;fx(s,'ember',e,others[0]);hurt(s,others[0],1,'余火',true);}
      }
    }else fx(s,fire?'fire':'hit',e);
  }
  function strike(s,key){
    let targets=alive(s).sort((a,b)=>d(a,C)-d(b,C)||a.id-b.id),e=targets[0];
    if(!e)return;
    const origin={G:{x:155,y:218},H:{x:236,y:214},Z:{x:235,y:290},N:{x:195,y:188},T:{x:155,y:289}}[key];
    if(key==='G'){
      if(d(e,C)>180)return;
      const before={x:e.x,y:e.y};
      hurt(s,e,2,'ゴウ');
      // A struck body completes its short knockback even if the impact was lethal.
      let dx=e.x-C.x,dy=e.y-C.y,len=Math.hypot(dx,dy)||1;
      e.x+=dx/len*30;e.y+=dy/len*30;
      if(s.bought.includes('G')){
        const collisions=alive(s).filter(o=>o!==e&&segmentDistance(o,before,e)<15)
          .sort((a,b)=>d(a,before)-d(b,before));
        if(collisions[0]){s.proc.collision++;fx(s,'collision',e,collisions[0]);hurt(s,e,1,'ゴウの衝突');hurt(s,collisions[0],1,'ゴウの衝突');}
      }
      fx(s,'G',origin,e);
    }else if(key==='H'){
      fx(s,'H',origin,e);hurt(s,e,1,'ヒバナ',s.bought.includes('H'));
    }else if(key==='Z'){
      const first={x:e.x,y:e.y};fx(s,'Z',origin,e);hurt(s,e,2,'ゲンゾウ');
      if(s.bought.includes('Z')){
        const dx=first.x-origin.x,dy=first.y-origin.y,len=Math.hypot(dx,dy)||1;
        const line=alive(s).filter(o=>o!==e).map(o=>({o,along:((o.x-origin.x)*dx+(o.y-origin.y)*dy)/len,
          across:Math.abs((o.x-origin.x)*dy-(o.y-origin.y)*dx)/len}))
          .filter(x=>x.along>len&&x.along<300&&x.across<15).sort((a,b)=>a.along-b.along).slice(0,2);
        for(const x of line){s.proc.pierce++;fx(s,'Z',first,x.o);hurt(s,x.o,1,'ゲンゾウの貫通');}
      }
    }else if(key==='N'&&d(e,C)<70){fx(s,'N',origin,e);hurt(s,e,1,'ナギ');}
  }
  function segmentDistance(p,a,b){let vx=b.x-a.x,vy=b.y-a.y,t=((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy||1);
    t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}
  function step(s,dt){
    if(s.done)return;
    dt=Math.min(dt,.06);s.time+=dt;
    if(s.autoPlan.length)tryAuto(s);
    for(const e of alive(s)){
      if(e.type==='shooter'){
        if(s.time>=e.shoot){e.shoot+=3;s.bullets.push({x:e.x,y:e.y,source:e,dead:false});fx(s,'enemy',e,C);}
      }else{
        const len=d(e,C)||1,move=Math.min(e.speed*dt,len);
        e.x+=(C.x-e.x)/len*move;e.y+=(C.y-e.y)/len*move;
        if(d(e,C)<13){e.dead=true;s.leaks++;s.hp-=e.type==='heavy'?2:1;note(s,`${e.type==='heavy'?'重兵':'小兵'}が灰火へ到達`);}
      }
    }
    for(const b of s.bullets){
      if(b.dead)continue;let len=d(b,C)||1,move=Math.min(145*dt,len);
      b.x+=(C.x-b.x)/len*move;b.y+=(C.y-b.y)/len*move;
      if(d(b,C)<65&&s.ready.shield<=s.time){
        b.dead=true;s.ready.shield=s.time+2.5;fx(s,'shield',b,C);
        if(s.bought.includes('N')&&!b.source.dead){s.proc.reflect++;fx(s,'reflect',b,b.source);hurt(s,b.source,2,'ナギの反射');}
      }else if(d(b,C)<12){b.dead=true;s.hp--;note(s,'敵弾が灰火に命中');}
    }
    s.bullets=s.bullets.filter(b=>!b.dead);
    for(const key of ['H','G','Z','N']){
      if(s.ready[key]<=s.time){
        strike(s,key);
        s.ready[key]=s.time+({H:1.2,G:2,Z:2.3,N:2.5}[key]);
      }
    }
    if(s.ready.T<=s.time){
      s.ready.T=s.time+5;
      if(s.hp<12){s.hp++;note(s,'ツグミが灰火を1回復');fx(s,'heal',C);
        if(s.bought.includes('T')){const e=alive(s).sort((a,b)=>d(a,C)-d(b,C)||a.id-b.id)[0];
          if(e){s.proc.healDart++;fx(s,'T',C,e);hurt(s,e,1,'ツグミの薬矢');}}
      }
    }
    s.fx=s.fx.filter(x=>x.until>s.time);
    if(s.hp<=0){s.hp=0;s.done='lose';note(s,'灰火が尽きた');return;}
    if(!s.enemies.some(e=>!e.dead)&&s.wave===4){s.done='win';note(s,'四波を突破');return;}
    if(s.wave<4){
      const waveHasFuture=s.enemies.some(e=>!e.dead&&e.wave===s.wave);
      if(!waveHasFuture&&s.between===null)s.between=s.time+1;
      if((s.between!==null&&s.time>=s.between)||s.time-s.waveAt>=12)spawn(s);
    }
  }
  function run(plan=[]){const s=make({autoPlan:plan});for(let i=0;i<6000&&!s.done;i++)step(s,1/30);return s;}
  root.AshShop={make,step,run,buy,shelves,price,names,C,alive,waves};
  if(typeof module!=='undefined')module.exports=root.AshShop;
})(globalThis);
