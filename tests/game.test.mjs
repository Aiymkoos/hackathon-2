import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../js/input.js';
import { POSE } from '../js/gestures.js';
import { RUNES } from '../js/runes.js';
globalThis.addEventListener = () => {};
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { BattleScene } = await import('../js/scenes/battle.js');
const { AcademyScene } = await import('../js/scenes/academy.js');
const { ResultsScene } = await import('../js/scenes/results.js');
function obs(t, pose = POSE.POINT, x = 300, y = 350) {
  return { present: true, pose, tip: { x, y }, palm: { x, y }, scale: 0.12, landmarks: null, sampleId: t };
}
function app() {
  const noop = new Proxy({}, { get: () => () => {} });
  const h = new Input();
  const a = { W: 1280, H: 800, minDim: 800, time: 0, input: h, hands: { Right: h },
    sfx: noop, fx: noop, feedback: { ...noop, clear(){}, success(){}, fail(){}, items: [] },
    toast: { clear(){}, show(text){a.message=text;} }, go(name, data){a.destination={name,data};} };
  return a;
}
test('same camera sample cannot confirm a gesture, arm a stroke or add points', () => {
  const h = new Input();
  for (let i=0;i<100;i++) h.update(obs(1), i*16, 800);
  assert.equal(h.pose, POSE.NONE); assert.equal(h.stroke, null);
  h.update(obs(2000),2000,800); assert.equal(h.pose, POSE.POINT);
});
test('arming works at 10, 15, 30 and 60 camera fps', () => {
  for (const fps of [10,15,30,60]) {
    const h = new Input();
    for(let i=0;i<fps;i++) h.update(obs(i*1000/fps),i*1000/fps,800);
    assert.ok(h.stroke, `no stroke at ${fps} fps`);
    assert.equal(h.drawState,'drawing');
  }
});
test('camera disappearance cancels a stroke without sending an incorrect rune', () => {
  const h = new Input(); let events=[];
  for(let t=0;t<1000;t+=33) h.update(obs(t,POSE.POINT,300+t*.2,350),t,800);
  // arm first, then move
  for(let t=1000;t<1300;t+=33) h.update(obs(t),t,800);
  for(let t=1300;t<1700;t+=33) h.update(obs(t,POSE.POINT,300+(t-1300)*.3),t,800);
  assert.ok(h.stroke);
  events.push(...h.update({present:false},1700,800),...h.update({present:false},2300,800));
  assert.equal(h.stroke,null); assert.ok(events.some(e=>e.type==='trackingLost'));
  assert.ok(!events.some(e=>e.type==='stroke'));
});
test('brief tracking gap cannot draw a connecting line across the screen', () => {
  const h = new Input();
  for(let t=0;t<400;t+=33) h.update(obs(t),t,800);
  h.update({present:false},410,800);
  const events=h.update(obs(460,POSE.POINT,1100,500),460,800);
  assert.ok(!h.stroke || h.stroke.pts.length===0);
  assert.ok(events.some(e=>e.type==='trackingLost'));
});
test('lost camera freezes enemies, attacks, health and power; resume has a countdown', () => {
  const a=app(), b=new BattleScene(a); b.enter(); b.phase='fight'; b.spawnMonster(1,.08,['circle']);
  b.shots=[{x0:0,y0:0,t:.99}];b.mana=100;b.charge=.9;a.input.pose=POSE.PALM;
  const {x,y}=b.monsters[0];
  for(let i=0;i<100;i++) b.update(.05,i*50,[]);
  assert.equal(b.hearts,5);assert.equal(b.monsters[0].x,x);assert.equal(b.monsters[0].y,y);
  assert.equal(b.shots[0].t,.99);assert.equal(b.charge,.9);assert.equal(b.stats.ults,0);
  a.input.present=true;b.update(.05,5100,[]);assert.equal(b.paused,true);
});
test('palm power fires once after a deliberate hold; no depth movement needed', () => {
  const a=app(),b=new BattleScene(a);b.enter();b.phase='intro';b.phaseT=100;b.mana=100;
  a.input.present=true;a.input.pose=POSE.PALM;a.input.poseSince=0;
  for(let i=0;i<30;i++) b.update(.05,i*50,[]);
  assert.equal(b.stats.ults,1);assert.equal(b.mana,0);
  for(let i=0;i<30;i++) b.update(.05,1500+i*50,[]);
  assert.equal(b.stats.ults,1);
});
test('academy cannot accept an absent fist or an absent palm', () => {
  const a=app(),s=new AcademyScene(a);s.enter();s.step=5;a.input.pose=POSE.FIST;
  for(let i=0;i<30;i++)s.update(.05,i*50,[]);
  assert.equal(s.successT,0);s.step=6;a.input.pose=POSE.PALM;
  for(let i=0;i<30;i++)s.update(.05,i*50,[]);
  assert.equal(s.successT,0);
});
test('no-target practice strokes do not damage accuracy or combo', () => {
  const a=app(),b=new BattleScene(a);b.enter();b.combo=3;b.handleStroke([{x:1,y:1}]);
  assert.equal(b.stats.attempts,0);assert.equal(b.combo,3);
});
function stroke(id) {
  const path=RUNES[id].path,out=[];
  for(let i=1;i<path.length;i++)for(let j=0;j<14;j++){
    const k=j/14;out.push({x:500+(path[i-1][0]*(1-k)+path[i][0]*k)*300,y:400+(path[i-1][1]*(1-k)+path[i][1]*k)*300,t:out.length*33});
  }
  const p=path.at(-1);out.push({x:500+p[0]*300,y:400+p[1]*300,t:out.length*33});return out;
}
test('open shapes wait for completion and cannot prematurely trigger an attack', () => {
  const a=app(),b=new BattleScene(a);b.enter();b.spawnMonster(1,.08,['vee']);
  assert.equal(b.earlyCheck(stroke('vee')),false);
});
test('full simulated battle reaches victory and results through all waves', () => {
  const a=app(),b=new BattleScene(a);b.enter();a.input.present=true;a.input.pose=POSE.FIST;
  for(let i=0;i<12000 && !a.destination;i++){
    b.update(.05,i*50,[]);
    const wanted=b.currentRunes()[0];
    if(wanted && !b.over)b.handleStroke(stroke(wanted));
  }
  assert.equal(a.destination?.name,'results'); assert.equal(a.destination.data.win,true);
  assert.ok(a.destination.data.score>0);assert.equal(b.waveIdx,3);
  assert.ok(b.stats.attempts>20);assert.equal(b.stats.attempts,b.stats.hits);
  const results=new ResultsScene(a);results.enter(a.destination.data);assert.equal(results.accuracy,100);
});
test('unprotected battle reaches defeat and result instead of getting stuck', () => {
  const a=app(),b=new BattleScene(a);b.enter();a.input.present=true;a.input.pose=POSE.OTHER;
  for(let i=0;i<5000 && !a.destination;i++) b.update(.05,i*50,[]);
  assert.equal(a.destination?.name,'results');assert.equal(a.destination.data.win,false);
});

test('all game screens render with finite coordinates on desktop, phone and landscape', async () => {
  const { MenuScene } = await import('../js/scenes/menu.js');
  globalThis.Path2D = class {};
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ canvas:{width:1280,height:800}, measureText:s=>({width:String(s).length*8}),
    createLinearGradient:()=>gradient,createRadialGradient:()=>gradient }, {
    get(target,key){return key in target ? target[key] : (...args)=>{
      for(const n of args) if(typeof n==='number')assert.ok(Number.isFinite(n),`${String(key)} has invalid coordinate`);
    };},
    set(target,key,value){target[key]=value;return true;},
  });
  for(const [W,H] of [[1280,800],[390,844],[844,390]]){
    const a=app();Object.assign(a,{W,H,minDim:Math.min(W,H)});
    const menu=new MenuScene(a);menu.enter();menu.update(.016,0,[]);menu.render(ctx);
    const academy=new AcademyScene(a);academy.enter();
    for(let step=0;step<7;step++){academy.step=step;academy.render(ctx);}
    const battle=new BattleScene(a);battle.enter();battle.paused=true;battle.render(ctx);battle.renderOverlay(ctx);
    battle.paused=false;battle.phase='fight';battle.spawnBoss();battle.render(ctx);battle.renderOverlay(ctx);
    const results=new ResultsScene(a);results.enter({win:true,score:1500,stats:{attempts:4,hits:3,errors:{},maxCombo:2,blocks:1,activeSeconds:30}});
    results.update(.016,0,[]);results.render(ctx);
  }
});
