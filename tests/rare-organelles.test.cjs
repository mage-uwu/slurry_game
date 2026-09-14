const assert=require('node:assert/strict'),fs=require('fs'),s=fs.readFileSync(require('node:path').join(__dirname,'..','slurry','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0],m={exports:{}};new Function('module',s+'\nmodule.exports={Engine,makeParams,mkLife,organelles,randomGenome,membraneStrength,lifeGate};')(m);const{Engine,makeParams,mkLife,organelles,randomGenome,membraneStrength,lifeGate}=m.exports;
const bits=[0x400,0x4000,0x20,0x40,0x80,2,4,8,16];for(let mask=0;mask<512;mask++){const g=bits.reduce((g,b,k)=>g|(mask&(1<<k)?b:0),0);assert.equal(organelles(mkLife(g,100)),mask);}console.log('PASS 512 independent organelle combinations');
let rng=42,counts=Array(9).fill(0);for(let k=0;k<30000;k++){const g=randomGenome(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;});const o=organelles(mkLife(g,100));for(let b=0;b<9;b++)counts[b]+=!!(o&(1<<b));}for(let b=5;b<9;b++)assert(Math.abs(counts[b]/30000-[.06,.05,.04,.05][b-5])<.012);console.log('PASS rare spawn rates');
assert(membraneStrength(mkLife(2,200))>=12);assert.equal(lifeGate(mkLife(0x4000,240),mkLife(2,30)),0);
for(const g of[0,2,8,10,24]){const e=new Engine(40,40,200,makeParams({gy:0,jitter:0}));e.add(20,20,16,0,0,g);e.add(20.3,20,19);e.step();const types=Array.from(e.attr.subarray(0,e.n),a=>a&31);assert(types.includes(g&8?16:6),[g,types]);}console.log('PASS acid kills normal/armored cells; acid organelle grants immunity');
for(const victim of [1,2]){const e=new Engine(40,40,100,makeParams({gy:0,jitter:0}));e.add(20,20,16,.02,0,0x4100);e.add(20.2,20,16,0,0,victim);e.step();const dead=Array.from(e.attr.subarray(0,e.n)).filter(a=>(a&31)===6).length;assert.equal(dead,victim===2?0:1);}console.log('PASS rigid shells resist physical predator punctures');
const e=new Engine(40,40,200,makeParams({gy:0,jitter:0}));for(const [x,y]of[[18,18],[20,18],[18,20],[20,20]])e.add(x,y,16,0,0,2);e.sort();e.rareStep();const before=Array.from({length:4},(_,i)=>[e.qx[i],e.qy[i]]);e.qx[0]+=.3;e.py[1]+=.2;e.rareStep();for(let i=0;i<4;i++)for(let j=0;j<i;j++)assert(Math.abs(Math.hypot(e.qx[i]-e.qx[j],e.qy[i]-e.qy[j])-Math.hypot(before[i][0]-before[j][0],before[i][1]-before[j][1]))<.0001);console.log('PASS rigid body preserves pairwise shape');
const plant=new Engine(40,40,500,makeParams({gy:.0022,jitter:0}));plant.add(20,39.7,16,0,0,0x2190);for(let k=0;k<350;k++)plant.step();assert.equal(plant.attr[0]&31,16);assert(((plant.attr[0]>>>16)&255)>0);assert(Math.abs(plant.qy[0]-39.7)<.1);plant.senseFood();assert.equal(plant.lifeSlip[0],0);assert.equal(plant.lifeSlip[1],0);console.log('PASS plants root and suppress motility including roller');
const seed=new Engine(40,40,100,makeParams({gy:0,jitter:0}));seed.add(20,39.7,20);seed.attr[0]=(mkLife(16,0)&~31)|20;for(let k=0;k<100;k++){seed.sort();seed.rareStep();}assert(Array.from(seed.attr.subarray(0,seed.n)).filter(a=>(a&31)===16).length>=4);console.log('PASS seed germination creates inherited plant colony');

{
const e=new Engine(40,40,1000,makeParams({gy:0,jitter:0}));for(let x=6;x<35;x+=.8)e.add(x,39.7,16,0,0,16);
let seedBirths=0;for(let k=0;k<6000;k++){e.lifeClock++;e.sort();const n=e.n;e.rareStep();for(let i=n;i<e.n;i++)if((e.attr[i]&31)===20){seedBirths++;assert(e.py[i]-e.qy[i]<-.1);}}
const at=Array.from(e.attr.subarray(0,e.n)),jelly=at.filter(a=>(a&31)===6).length,seeds=at.filter(a=>(a&31)===20).length;
assert(jelly>5&&seedBirths>0,{jelly,seeds,seedBirths});assert(e.n<=e.maxP);console.log('PASS free jelly and ballistic seed emissions', {jelly,seedBirths,total:e.n});
const soil=new Engine(40,40,1000,makeParams({gy:0,jitter:0}));for(let x=18;x<22;x+=.6)soil.add(x,29.6,16,0,0,16);for(let y=30;y<35;y+=.6)for(let x=18;x<22;x+=.6)soil.add(x,y,11);
for(let k=0;k<6000;k++){soil.lifeClock++;soil.sort();soil.rareStep();}
const roots=Array.from({length:soil.n},(_,i)=>i).filter(i=>(soil.attr[i]&31)===16&&(soil.attr[i]&64));const deepest=Math.max(...roots.map(i=>soil.qy[i]));assert(deepest>33,deepest);console.log('PASS roots propagate into terrain',deepest-29.6);

}

for(const g of [2,4,6,0x65fe]){
 const e=new Engine(40,40,3000,makeParams({jitter:0}));for(let y=10;y<13;y+=.43)for(let x=15;x<18;x+=.43)e.add(x,y,16,0,0,g);
 const start=performance.now();for(let k=0;k<600;k++)e.step();let sum=0,n=0,peak=0;for(let i=0;i<e.n;i++)if((e.attr[i]&31)===16){assert(Number.isFinite(e.qx[i]+e.qy[i]));sum+=e.qy[i];n++;peak=Math.max(peak,Math.hypot(e.px[i]-e.qx[i],e.py[i]-e.qy[i]));}assert(n>10&&sum/n>33&&peak<=.421,{g,n,y:sum/n,peak});console.log('PASS rare-cell gravity and stable motion',g.toString(16),{n,y:sum/n,peak,ms:performance.now()-start});
}
