const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../slurry/index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];
const {Engine,makeParams,T_PLASTIC,T_MOLTEN_PLASTIC,T_FIRE,T_LAVA,A_LIT}=new Function(src+';return {Engine,makeParams,T_PLASTIC,T_MOLTEN_PLASTIC,T_FIRE,T_LAVA,A_LIT}')();
let seed=3;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const count=(e,t)=>{let n=0;for(let i=0;i<e.n;i++)if((e.attr[i]&31)===t)n++;return n;};

// Plastic is anchored like ice: gravity and contact forces cannot move it.
const anchor=new Engine(40,40,10,makeParams({jitter:0}));anchor.add(20,20,T_PLASTIC);
for(let k=0;k<200;k++)anchor.step();
assert(Math.abs(anchor.qx[0]-20)<1e-9&&Math.abs(anchor.qy[0]-20)<1e-9,'plastic never moves');

// Ordinary fire/lava heat barely touches plastic: it needs sustained, much stronger exposure than ice.
const P=makeParams({jitter:0,gy:0});
let survived=0;
for(let trial=0;trial<5;trial++){
  const mild=new Engine(40,40,10,P);mild.add(20,20,T_PLASTIC);mild.add(20.4,20,T_FIRE);
  for(let k=0;k<40;k++)mild.step();
  if(count(mild,T_PLASTIC)+count(mild,T_MOLTEN_PLASTIC)>0 && (mild.attr.slice(0,mild.n).some(a=>(a&31)===T_PLASTIC)))survived++;
}
assert(survived>=4,'plastic resists brief ordinary heat exposure: '+survived+'/5');

// Sustained lava contact eventually melts plastic. Lava is pinned in place each step (as if endlessly
// replenished) so the test isolates heat exposure from lava's own unrelated drift.
const hot=new Engine(40,40,4000,makeParams({jitter:0,gy:0}));
for(let y=20;y<23;y+=.4)for(let x=15;x<18;x+=.4)hot.add(x,y,T_PLASTIC);
const lavaIdx=[],lavaPos=[];
for(let y=20;y<23;y+=.4){lavaIdx.push(hot.n);lavaPos.push([18.3,y]);hot.add(18.3,y,T_LAVA);}
let meltedAt=-1,sawMolten=false;
for(let k=0;k<4000;k++){
  hot.step();
  lavaIdx.forEach((i,j)=>{const [x,y]=lavaPos[j];hot.px[i]=hot.qx[i]=x;hot.py[i]=hot.qy[i]=y;});
  if(count(hot,T_MOLTEN_PLASTIC)>0){sawMolten=true;if(meltedAt<0)meltedAt=k;}
}
assert(meltedAt>=0,'sustained lava heat eventually melts plastic');
assert(sawMolten,'molten plastic appears while heat is sustained');

// When solid plastic catches fire from strong, direct heat, it melts at the same moment
// (it is never seen as a burning solid); the resulting liquid is the one that burns.
const ignite=new Engine(40,40,4000,makeParams({jitter:0,gy:0}));
for(let y=20;y<23;y+=.4)for(let x=15;x<18;x+=.4)ignite.add(x,y,T_PLASTIC);
const igniteLavaIdx=[],igniteLavaPos=[];
for(let y=20;y<23;y+=.4){igniteLavaIdx.push(ignite.n);igniteLavaPos.push([18.3,y]);ignite.add(18.3,y,T_LAVA);}
let sawBurningSolid=false,sawBurningLiquid=false;
for(let k=0;k<4000;k++){
  ignite.step();
  igniteLavaIdx.forEach((i,j)=>{const [x,y]=igniteLavaPos[j];ignite.px[i]=ignite.qx[i]=x;ignite.py[i]=ignite.qy[i]=y;});
  for(let i=0;i<ignite.n;i++){
    const a=ignite.attr[i],t=a&31;
    if(t===T_PLASTIC&&(a&A_LIT))sawBurningSolid=true;
    if(t===T_MOLTEN_PLASTIC&&(a&A_LIT))sawBurningLiquid=true;
  }
}
assert(!sawBurningSolid,'solid plastic is never seen burning; ignition and melting are one step');
assert(sawBurningLiquid,'molten plastic catches fire');

// Molten plastic that is burning eventually turns to fire, exactly like burning oil.
const burnout=new Engine(40,40,10,makeParams({jitter:0,gy:0,burnT:8}));burnout.add(20,20,T_MOLTEN_PLASTIC);
burnout.attr[0]|=A_LIT;
let becameFire=false;
for(let k=0;k<400;k++){burnout.step();if((burnout.attr[0]&31)===T_FIRE){becameFire=true;break;}}
assert(becameFire,'burning molten plastic eventually becomes fire, like burning oil');

// Non-burning molten plastic can still catch fire from nearby heat, mirroring oil's ignition.
const catchFire=new Engine(40,40,10,makeParams({jitter:0,gy:0,igniteP:1}));
catchFire.add(20,20,T_MOLTEN_PLASTIC);catchFire.add(20.3,20,T_FIRE);
catchFire.sort();catchFire.density();
let lit=false;
for(let k=0;k<50;k++){catchFire.step();if((catchFire.attr[0]&31)===T_MOLTEN_PLASTIC&&(catchFire.attr[0]&A_LIT)){lit=true;break;}}
assert(lit,'unlit molten plastic ignites near fire');

// Save format accepts both plastic phases and preserves the burning flag.
const world=require('./project-fixture.cjs')();
const litMolten=(T_MOLTEN_PLASTIC|A_LIT)>>>0;
world.attributes=globalThis.SlurryProject.encode(new Uint32Array([T_PLASTIC,litMolten]));
const restored=globalThis.SlurryProject.validate(world).arrays.attributes;
assert.equal(restored[0],T_PLASTIC);assert.equal(restored[1],litMolten);

console.log('PASS plastic anchoring, high melting point, melt-on-burn, molten flammability/burnout and saved phase');
