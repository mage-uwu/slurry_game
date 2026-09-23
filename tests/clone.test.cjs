const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../slurry/index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];
const {Engine,makeParams,T_CLONE,CLONE_PERIOD,CLONE_FRAME_MAX,CLONE_FILL,cloneProg,steelTemp}=new Function(src+';return {Engine,makeParams,T_CLONE,CLONE_PERIOD,CLONE_FRAME_MAX,CLONE_FILL,cloneProg,steelTemp}')();
let seed=7;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const count=(e,t)=>{let n=0;for(let i=0;i<e.n;i++)if((e.attr[i]&31)===t)n++;return n;};
// Contact programs a blank clone; the clone stays anchored like ice under gravity.
const e=new Engine(40,40,4000,makeParams({jitter:0}));e.add(20,20,T_CLONE);e.add(20.6,20,1);
for(let k=0;k<3;k++)e.step();
const ci=Array.from(e.attr.slice(0,e.n)).findIndex(a=>(a&31)===T_CLONE);assert.equal(cloneProg(e.attr[ci]),1,'water programs clone');
for(let k=0;k<CLONE_PERIOD*20;k++)e.step();
const c2=Array.from(e.attr.slice(0,e.n)).findIndex(a=>(a&31)===T_CLONE);assert(Math.abs(e.qx[c2]-20)<1e-9&&Math.abs(e.qy[c2]-20)<1e-9,'clone never moves');
const made=count(e,1)-1;assert(made>=10&&made<=21,'steady bounded rate: '+made);
// Programs spread through a clone body, but a buried clone cannot emit: only its surface does.
const block=new Engine(40,40,4000,makeParams({jitter:0,gy:0}));for(let y=10;y<=16;y+=.5)for(let x=10;x<=16;x+=.5)block.add(x,y,T_CLONE);
block.attr[block.n>>1]|=8<<16;for(let k=0;k<CLONE_PERIOD*4;k++)block.step();
assert(Array.from(block.attr.slice(0,block.n)).every(a=>(a&31)!==T_CLONE||cloneProg(a)===8),'program spreads through the body');
for(let i=0;i<block.n;i++)if((block.attr[i]&31)===8)assert(block.qx[i]<10.2||block.qx[i]>15.8||block.qy[i]<10.2||block.qy[i]>15.8,'emits only outside the body');
assert(count(block,8)>0);
// Programs spread through a clone body, but only exposed clones emit, and the world budget is capped per step.
const wide=new Engine(160,100,12000,makeParams({jitter:0,gy:0}));for(let x=2;x<158;x+=1.2)for(const y of [20,40,60,80])wide.add(x,y,T_CLONE);
for(let i=0;i<wide.n;i++)wide.attr[i]|=8<<16;let last=wide.n;
for(let k=0;k<CLONE_PERIOD*3;k++){wide.step();assert(wide.n-last<=CLONE_FRAME_MAX>>2,'per-step clone budget');last=wide.n;}
assert(count(wide,8)>0);
// Cloning pauses once the world reaches its fill ceiling.
const full=new Engine(40,40,200,makeParams({jitter:0,gy:0}));full.add(20,20,T_CLONE);full.attr[0]|=8<<16;
for(let k=0;k<CLONE_PERIOD*400;k++)full.step();assert(full.n<=Math.ceil(200*CLONE_FILL),'fill ceiling '+full.n);assert(full.n>=Math.floor(200*CLONE_FILL)-1);
// Molten steel clones stay molten; blank clones never learn from life.
const hot=new Engine(40,40,400,makeParams({jitter:0,gy:0}));hot.add(20,20,T_CLONE);hot.attr[0]|=23<<16;for(let k=0;k<CLONE_PERIOD*2;k++)hot.step();
const steel=Array.from(hot.attr.slice(0,hot.n)).filter(a=>(a&31)===23||(a&31)===22);assert(steel.length>0&&steel.every(a=>steelTemp(a)>1400));
const life=new Engine(40,40,400,makeParams({jitter:0,gy:0}));life.add(20,20,T_CLONE);life.add(20.5,20,16,0,0,0x1234);for(let k=0;k<10;k++)life.step();
const lc=Array.from(life.attr.slice(0,life.n)).find(a=>(a&31)===T_CLONE);assert.equal(cloneProg(lc),0);
const world=require('./project-fixture.cjs')();world.attributes=globalThis.SlurryProject.encode(new Uint32Array([T_CLONE|(1<<16),T_CLONE]));assert.equal(globalThis.SlurryProject.validate(world).arrays.attributes[0],T_CLONE|(1<<16));
console.log('PASS clone programming by contact, anchoring, steady capped emission, buried silence, fill ceiling, hot phases and saves');
