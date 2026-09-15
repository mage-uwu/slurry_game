const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../slurry/index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];
const {Engine,makeParams,steelStore,steelTemp,isFluid,mercuryHeat}=new Function(src+';return {Engine,makeParams,steelStore,steelTemp,isFluid,mercuryHeat}')();
let seed=11;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
assert.equal(steelStore(22,1499,.5)&31,22);assert.equal(steelStore(22,1500,.5)&31,23);assert.equal(steelStore(23,1475,.5)&31,23);assert.equal(steelStore(23,1450,.5)&31,22);assert(isFluid(23));
for(const material of [4,7,18]){const e=new Engine(40,40,10,makeParams({gy:0,jitter:0}));e.add(20,20,22);e.add(20.3,20,material);e.sort();for(let k=0;k<8000;k++)e.mercuryThermal();assert.equal(e.attr[0]&31,material===18?23:22);assert(steelTemp(e.attr[0])>500);}
const e=new Engine(40,40,10,makeParams({gy:0,jitter:0}));e.add(20,20,22);e.add(20.5,20,22);e.sort();e.wakePass();e.density();e.bondPass();assert(e.bonds[0]!==4294967295);
e.attr[0]=steelStore(22,1499,.5);e.attr[1]=steelStore(23,2000,.5);e.mercuryThermal();assert.equal(e.attr[0]&31,23);assert(e.bonds.slice(0,8).every(b=>b===4294967295));
e.attr[1]=1;for(let k=0;k<3000;k++)e.mercuryThermal();assert.equal(e.attr[0]&31,22);assert.equal(e.n,2);assert(mercuryHeat(steelStore(23,1600,.5),1)>0);
// Hot liquid deforms and spreads, whereas solid steel retains shape in its existing test.
const liquid=new Engine(40,40,200,makeParams({jitter:0}));for(let y=25;y<28;y+=.5)for(let x=18;x<21;x+=.5){liquid.add(x,y,23);liquid.attr[liquid.n-1]=steelStore(23,2200,.5);}
for(let k=0;k<250;k++)liquid.step();assert(liquid.attr.slice(0,liquid.n).some(a=>(a&31)===23));assert(Math.max(...liquid.qx.slice(0,liquid.n))-Math.min(...liquid.qx.slice(0,liquid.n))>3);assert(liquid.bonds.slice(0,liquid.n*8).every(b=>b===4294967295));
const world=require('./project-fixture.cjs')();const hot=steelStore(23,1650,.5);world.attributes=globalThis.SlurryProject.encode(new Uint32Array([hot,22]));assert.equal(globalThis.SlurryProject.validate(world).arrays.attributes[0],hot);
console.log('PASS steel heat uptake, melting, bond release, flowing liquid, cooling/solidification, heat transfer and saved phase');
