const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0],m={exports:{}};
new Function('module',text+';module.exports={Engine,makeParams,genome,originGenome,bioHash,MELTDOWN_LIFE_CHANCE};')(m);
const{Engine,makeParams,genome,originGenome,bioHash,MELTDOWN_LIFE_CHANCE:chance}=m.exports;
assert(chance>0&&chance<=.00002);
let lucky=100;while(bioHash(lucky+5987,1)>=chance)lucky++;
let unlucky=lucky+1;while(bioHash(unlucky+5987,1)<chance)unlucky++;
function scene(id,other=18,distance=.4,count=1){const e=new Engine(40,40,256,makeParams({gy:0,jitter:0,lifeConvP:0,lifeMutP:0,meltP:1e6}));e.add(20,20,6);e.pid[0]=id;for(let k=0;k<count;k++)e.add(20+distance*Math.cos(k*6.28/count),20+distance*Math.sin(k*6.28/count),other);e.step();return e;}
for(const distance of[0,.4,.99]){const e=scene(lucky,18,distance);const born=Array.from(e.attr.subarray(0,e.n)).filter(a=>(a&31)===16);assert.equal(born.length,1);assert.equal(genome(born[0]),originGenome(lucky,1));assert.equal(e.n,2,'reuse jelly particle; no spawn queue');assert(Array.from(e.attr.subarray(0,e.n)).some(a=>(a&31)===18),'Meltdown remains');}
console.log('PASS life can arise from jelly/Meltdown contact without parents, including overlap; birth precedes melting');
for(const [id,t,d,count]of[[unlucky,18,.4,1],[unlucky,18,.4,8],[lucky,18,1.01,1],[lucky,1,.4,1],[lucky,7,.4,1],[lucky,4,.4,1]]){const e=scene(id,t,d,count);assert(!Array.from(e.attr.subarray(0,e.n)).some(a=>(a&31)===16),[id,t,d,count]);}
const alone=new Engine(40,40,8,makeParams());alone.add(20,20,6);alone.pid[0]=lucky;alone.step();assert.equal(alone.attr[0]&31,6);
console.log('PASS no birth without Meltdown contact; extra neighbors do not multiply the roll');
// Exercise the actual birth branch over independent attempts, not a forced probability.
const e=new Engine(40,40,1,makeParams());e.add(20,20,6);e.lifeRad[0]=63;e.tick=1;let births=0;
for(let id=1;id<=1000000;id++){e.pid[0]=id;e.attr[0]=6;e.biology();if((e.attr[0]&31)===16)births++;}
assert(births>=3&&births<=22,births);console.log('PASS very rare spontaneous births', {attempts:1000000,births,probability:chance});
module.exports={lucky,unlucky,gene:originGenome(lucky,1)};
