// node tests/jelly-navigation.test.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];
const m={exports:{}};new Function('module',source+'\nmodule.exports={Engine,makeParams,mkLife,organelles,strainHeading,deadJelly};')(m);
const {Engine,makeParams,mkLife,organelles,strainHeading,deadJelly}=m.exports;
const bits=[0x400,0x4000,0x20,0x40,0x80,2,4,8,16];
function scene(g,food=[[14,20,6]],frozen=false){const e=new Engine(40,40,100,makeParams({gy:0,jitter:0}));e.add(20,20,16,0,0,g);if(frozen)e.attr[0]|=32;for(const [x,y,t]of food)e.add(x,y,t);e.sort();e.wakePass();e.density();e.senseFood();const i=Array.from(e.attr.subarray(0,e.n)).findIndex(a=>(a&31)===16);return {e,i,h:[e.lifeNav[2*i],e.lifeNav[2*i+1]]};}
for(let mask=0;mask<512;mask++){const g=bits.reduce((g,b,k)=>g|(mask&(1<<k)?b:0),0),{e,i,h}=scene(g);if(organelles(mkLife(g,100))&256){const f=strainHeading(g);assert(Math.abs(h[0]-f[0])<1e-6&&Math.abs(h[1]-f[1])<1e-6);assert.equal(e.lifeSlip[2*i],0);assert.equal(e.lifeSlip[2*i+1],0);}else assert(h[0]<-.99,'all mobile combinations must seek jelly: '+g.toString(16));}
console.log('PASS all 256 mobile combinations seek jelly; all 256 plantlike combinations remain passive');
for(const g of [0,2,4,0x400,0x4000,0x65ee]){const {e,i,h}=scene(g,[[14,20,6]],true),f=strainHeading(g);assert(Math.abs(h[0]-f[0])<1e-6);assert(Math.abs(h[1]-f[1])<1e-6);assert.equal(e.lifeSlip[2*i],0);assert.equal(e.lifeSlip[2*i+1],0);}
assert(scene(0,[[14,20,6],[31,20,6]]).h[0]<-.99);
assert(scene(0,[[20,20,6]]).h.every(v=>v===0));
assert.deepEqual(scene(0,[[2,20,6]]).h,[1,0]);
for(const [g,t]of [[0x400,2],[0x20,7],[0x40,18]]){const {e,i,h}=scene(g,[[14,20,6],[23,20,t]]);assert(h[0]<-.99);const j=Array.from(e.attr.subarray(0,e.n)).findIndex(a=>(a&31)===6);e.attr[j]=0;e.lifeClock+=6;e.senseFood();assert(e.lifeNav[i*2]>.99,'specialist must resume its resource');}
console.log('PASS frozen cells, nearest cached jelly, arrival, sensing radius and specialist fallback');
// A death-generated jelly parcel enters the same cache on the next scheduled refresh.
{const {e,i}=scene(0,[[14,20,3]]);const j=i===0?1:0;e.attr[j]=deadJelly(mkLife(0x400,100));e.lifeClock+=6;e.senseFood();assert(e.lifeNav[i*2]<-.99);e.attr[j]=0;e.lifeClock+=6;e.senseFood();assert.equal(e.lifeNav[i*2],1);assert.equal(e.lifeNav[i*2+1],0);}
console.log('PASS dead-cell jelly is discovered and eaten/removed jelly expires from the cache');

for(const direction of [-1,1]){
 const e=new Engine(28,28,3500,makeParams({gx:0,gy:0,lifeCost:0,lifeMutP:0,jitter:0,lifeSwim:0}));
 for(let y=12;y<15;y+=.45)for(let x=12;x<16;x+=.45)e.add(x,y,16,0,0,0);
 for(let y=1;y<27;y+=.55)for(let x=1;x<27;x+=.55){if(x>11.4&&x<16.6&&y>11.4&&y<15.6)continue;e.add(x,y,1);}
 const cx=()=>{let x=0,n=0;for(let i=0;i<e.n;i++)if((e.attr[i]&31)===16){x+=e.qx[i];n++;}return x/n;};
 for(let k=0;k<80;k++)e.step();const start=cx();e.add(direction<0?5:23,13.5,6);e.P.lifeSwim=.72;
 for(let k=0;k<350;k++)e.step();const dx=cx()-start;console.log('PASS organelle-free colony swims toward jelly in water',{direction,dx});assert(dx*direction>.25,'organelle-free life should traverse fluid toward jelly');
}
