const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','slurry','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0],m={exports:{}};
new Function('module',source+'\nmodule.exports={Engine,makeParams,mkLife,genome,vitOf,isUnknown,organelles,randomGenome,lifeGate,UNKNOWN_GENOME,UNKNOWN_DIGEST,UNKNOWN_CHANCE,O_UNKNOWN,A_FROZEN};')(m);
const {Engine,makeParams,mkLife,genome,vitOf,isUnknown,organelles,randomGenome,lifeGate,UNKNOWN_GENOME:G,UNKNOWN_DIGEST:D,UNKNOWN_CHANCE,O_UNKNOWN,A_FROZEN}=m.exports;
const engine=()=>new Engine(40,40,4096,makeParams({gy:0,jitter:0,lifeCost:0}));
const unknown=mkLife(G,250);
assert.equal(organelles(unknown),O_UNKNOWN);
for(let t=1;t<=20;t++)assert.equal(lifeGate(unknown,t===16?mkLife(0x7ffe,250):t),1,`admit type ${t}`);
assert.equal(lifeGate(unknown,14|A_FROZEN),1);
assert.equal(lifeGate(unknown,unknown),0);assert.equal(lifeGate(mkLife(0x4100,250),unknown),0);
let seed=42,rare=0;for(let k=0;k<100000;k++){if(randomGenome(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296))===G)rare++;}
assert(rare>65&&rare<140,rare);assert.equal(UNKNOWN_CHANCE,.001);console.log('PASS reserved genome, all-material admission, kin exclusion and ultra-rare spawn rate',rare/100000);
// Force every biological death path simultaneously, including mutation and cryostasis.
{const e=engine();e.add(20,20,16,0,0,G);for(let k=0;k<1000;k++){e.tick++;e.attr[0]=mkLife(G,0)|A_FROZEN;e.lifeMsg[0]=0x200000;e.lifeEnv[0]=k%2?1e6:-1e6;e.lifeBite[0]=1e6;e.lifeRad[0]=63;e.biology();assert(isUnknown(e.attr[0]));assert.equal(vitOf(e.attr[0]),250);assert.equal(e.attr[0]&A_FROZEN,0);}assert.equal(e.n,1);}console.log('PASS starvation, puncture, thermal, acid and mutation death paths cannot alter ???');
// Original matter remains during entry. Its existing PID joins the body, with no new particle allocation.
for(let t=1;t<=20;t++){
 const e=engine();e.add(20,20,16,0,0,G);e.add(20.5,20,t,0,0,2);if(t===16)e.attr[1]=mkLife(2,250)|A_FROZEN;
 const preyID=e.pid[1]&0xfffff;for(let k=0;k<(t===4||t===15?24:D);k++){e.lifeClock++;e.sort();e.rareStep();if(k===0){const i=Array.from(e.pid.subarray(0,e.n)).findIndex(id=>(id&0xfffff)===preyID);assert.equal(e.attr[i]&31,t);}}
 assert.equal(e.n,2,`no birth for type ${t}`);assert(Array.from(e.attr.subarray(0,e.n)).every(isUnknown),`digestion type ${t}`);
 for(let k=0;k<500;k++){e.lifeClock++;e.sort();e.rareStep();}assert.equal(e.n,2);assert(Array.from(e.attr.subarray(0,e.n)).every(isUnknown));
}console.log('PASS all 20 particle materials are slowly incorporated; no daughters, seeds, acid or spontaneous growth');
// Actual coupled physics: eat solids/fluids and retain the same population while growing.
for(const t of[1,3,6,10,14,18,19,16,48]){
 const e=engine();e.add(20,20,16,0,0,G);e.add(20.45,20,t&31,0,0,2);if(t===48)e.attr[1]|=A_FROZEN;
 for(let k=0;k<380;k++)e.step();
 assert.equal(e.n,2,`population ${t}`);assert(Array.from(e.attr.subarray(0,e.n)).every(isUnknown),`physical intake ${t}: ${Array.from(e.attr.subarray(0,e.n),a=>a&31)}`);
 assert(Math.hypot(e.qx[0]-e.qx[1],e.qy[0]-e.qy[1])<1.6);
}console.log('PASS full physics consumes water, stone, jelly, mercury, ice, Meltdown, acid and rigid life');
// Repeated map-wide Meltdown shocks: keep all body particles; gravity still moves them.
{const e=new Engine(40,40,1000,makeParams({jitter:0}));for(let y=10;y<12;y+=.43)for(let x=18;x<20;x+=.43)e.add(x,y,16,0,0,G);const n=e.n;
 for(let k=0;k<600;k++){if(k<30)e.blastOut=[-6,10];e.step();assert.equal(e.n,n);assert(Array.from(e.attr.subarray(0,e.n)).every(isUnknown));}
 const y=Array.from(e.qy.subarray(0,e.n)).reduce((a,b)=>a+b)/n;assert(y>30,y);for(let i=0;i<n;i++)assert(Number.isFinite(e.px[i]+e.py[i]));
 e.step({kind:1,x:e.qx[0],y:e.qy[0],r:100,vx:0,vy:0,len:0});e.sort();assert.equal(e.n,0);
}console.log('PASS repeated Meltdown blasts, gravity and finite motion; editor erase still works');

{const e=engine();e.add(20,20,16,0,0,G);e.add(20.45,20,5);for(let k=0;k<80;k++)e.step();const i=Array.from(e.attr.subarray(0,e.n)).findIndex(a=>(a&31)===5);assert(i>=0,'nitro survives gradual entry');e.add(e.qx[i]+.25,e.qy[i],4);e.step();assert(Array.from(e.attr.subarray(0,e.n)).some(a=>(a&31)===4&&(a&(1<<28))),'undigested nitro still explodes');assert(Array.from(e.attr.subarray(0,e.n)).some(isUnknown));}console.log('PASS nitro stays explosive during absorption; ??? survives it');

// Sorting reindexes the host; cached admission must still refer to its stable particle ID.
{const e=engine();e.add(20,20,16,0,0,G);e.add(20.5,20,1);e.add(4,4,1);e.sort();e.rareStep();const prey=Array.from(e.attr.subarray(0,e.n)).findIndex((a,i)=>(a&31)===1&&e.qx[i]>19),id=e.pid[prey]&0xfffff,host=e.rareMeta.get(id).host;assert(host!==undefined);e.attr[0]=0;e.sort();for(let k=0;k<100;k++){e.lifeClock++;e.sort();e.rareStep();}const i=e.idx[id];assert.equal(e.rareMeta.get(id).host,host);assert.equal(e.attr[i]&31,1);assert(e.rareMeta.get(id).meal>90);e.attr[e.idx[host]]=0;e.sort();for(let k=0;k<400;k++){e.lifeClock++;e.sort();e.rareStep();}assert.equal(e.attr[e.idx[id]]&31,1);assert(!Array.from(e.attr.subarray(0,e.n)).some(isUnknown));}console.log('PASS cached absorption survives sorting and stops after its host is erased');
