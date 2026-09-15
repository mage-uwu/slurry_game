const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','slurry/index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];
const {Engine,makeParams,mercuryStore:store,mercuryEnergy:energy,mercuryTemp:temp,lightHeat,HG_EBOIL,HG_LATENT}=new Function(source+';return {Engine,makeParams,mercuryStore,mercuryEnergy,mercuryTemp,lightHeat,HG_EBOIL,HG_LATENT};')();
let a=store(10,HG_EBOIL+100,.5);assert.equal(a&31,10);assert.equal(temp(a),356.7);
a=store(a,HG_EBOIL+HG_LATENT+10,.5);assert.equal(a&31,21);assert(temp(a)>356.7);
a=store(a,HG_EBOIL+100,.5);assert.equal(a&31,21);assert.equal(temp(a),356.7);
a=store(a,20,.5);assert.equal(a&31,10);assert(temp(a)<356.7);assert.equal(store(10,-100,.5)>>>16,0);
function setup(type=7){const e=new Engine(40,40,100,makeParams({gy:0,jitter:0,steamP:1,meltIce:1,igniteP:1}));e.add(20,20,10);e.add(20.3,20,type);e.sort();return e;}
for(const source of [4,7,18]){const e=setup(source);for(let k=0;k<20000;k++)e.mercuryThermal();const i=e.attr.findIndex(a=>(a&31)===21);assert(i>=0,'heat source should boil mercury '+source);assert(temp(e.attr[i])>=356.7);}
const cold=setup(10);for(let i=0;i<100;i++)cold.mercuryThermal();assert(cold.attr.slice(0,2).every(a=>energy(a)===0));
const pair=setup(10);pair.attr[0]=store(10,40,.5);const initial=energy(pair.attr[0])+energy(pair.attr[1]);for(let i=0;i<500;i++)pair.mercuryThermal();assert(energy(pair.attr[1])>0);assert(energy(pair.attr[0])<40);assert(Math.abs(energy(pair.attr[0])-energy(pair.attr[1]))<15);assert(energy(pair.attr[0])+energy(pair.attr[1])<initial+5);
for(const [target,after]of [[1,15],[14,1],[2,2],[5,4],[9,4]]){const e=setup(target);e.attr[0]=store(10,40,.5);e.wakeAll=4;e.wakePass();e.density();e.relax();const random=Math.random;Math.random=()=>0;try{e.finalize();}finally{Math.random=random;}assert.equal(e.attr[1]&31,after,'hot mercury reaction '+target);if(target===2)assert(e.attr[1]&(1<<30));}
const cooling=setup(1);cooling.attr[0]=store(21,100,.5);for(let k=0;k<15000;k++)cooling.mercuryThermal();assert.equal(cooling.attr[0]&31,10);assert(temp(cooling.attr[0])<100);assert.equal(cooling.n,2);
let lamp=10;for(let i=0;i<500;i++)lamp=lightHeat(lamp,makeParams(),.5).attr;assert.equal(lamp&31,21);
// Heat and the vapor material survive the existing public-project format.
const world=require('./project-fixture.cjs')();world.attributes=globalThis.SlurryProject.encode(new Uint32Array([lamp,store(10,40,.5)]));assert.equal(globalThis.SlurryProject.validate(world).arrays.attributes[0],lamp);
console.log('PASS mercury heat uptake, diffusion, latent boiling/condensation, superheated vapor, reactions, lamps and snapshot preservation');
