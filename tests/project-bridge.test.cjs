const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),world=require('./project-fixture.cjs');
const source=fs.readFileSync(path.join(__dirname,'..','slurry/index.html'),'utf8').split('<script>')[1].split('</script>')[0];
const cpu=source.slice(0,source.indexOf('// ---------- WGSL ----------'));
const config=source.slice(source.indexOf('const W = 160'),source.indexOf('// ---------- GPU backend ----------'));
const bridge=fs.readFileSync(path.join(__dirname,'..','assets/project-bridge.js'),'utf8');
const harness=new Function(cpu+config+`
const ui={grav:0,speed:1,view:0,running:true},ptr={down:false};let acc=0;
let sim={kind:'CPU',maxP:MAXP_CPU,e:new Engine(W,H,MAXP_CPU,PRM),frame(){this.e.sort();},clear(){this.e.n=0;}};
function clearAll(){player.reset();machines.clear();epoch++;sim.clear();occReset();walls.fill(0);wallsDirty=true;}
function refreshUI(){sim.e.wakeAll=4;}function drawCursor(){}
${bridge}
return {api:createSlurryProjectBridge(),get engine(){return sim.e},machines,player,walls,ui,ptr,get busy(){return projectBusy},mkLife};`)();
(async()=>{
 const h=harness,e=h.engine;
 for(let i=0;i<20;i++)e.add(20+i*.2,20,i%2?6:1,.07,-.04);
 e.add(25,22,16,0,0,123);e.bonds[20*8]=e.pid[1];
 h.walls[320*80+90]=1;h.machines.place('turbine',50,50);h.machines.place('light',70,50);h.machines.place('gate',90,50);h.machines.wireLine(55,50,67,50);
 Object.assign(h.machines.rotors[0],{angle:1.2,omega:.04,power:1,energy:20});h.machines.logicStep();h.machines.clock=3;
 h.player.place(110,40,()=>false);h.api.setName('Mage');h.player.vx=.12;
 const saved=await h.api.capture(),before=globalThis.SlurryProject.validate(saved).arrays;
 assert.equal(saved.count,21);assert(saved.machines.lights[0].on);assert.equal(saved.player.name,'Mage');
 h.walls.fill(0);h.machines.clear();h.engine.n=0;h.player.reset();await h.api.restore(saved);
 assert.equal(h.engine.n,21);assert.equal(h.walls[320*80+90],1);assert.equal(h.player.vx,.12);assert.equal(h.player.name,'Mage');assert.equal(h.ui.running,false);
 assert.equal(h.machines.rotors[0].omega,.04);assert(h.machines.lights[0].on);assert.equal(h.machines.clock,3);assert.deepEqual(Array.from(h.machines.signals),saved.machines.signals);
 for(let i=0;i<saved.count;i++){assert.equal(h.engine.px[i],before.state[i*4]);assert.equal(h.engine.qx[i],before.state[i*4+2]);assert.equal(h.engine.attr[i],before.attributes[i]);assert.equal(h.engine.pid[i],before.ids[i]);}
 assert.equal(h.engine.bonds[20*8],before.bonds[20*8]);
 const previous=h.engine;await assert.rejects(h.api.restore({...saved,walls:'broken'}));assert.equal(h.engine,previous);assert.equal(h.player.name,'Mage');
 await assert.rejects(h.api.restore(world(12001)),/device supports/);assert.equal(h.engine,previous);assert.equal(h.busy,false);
 h.api.setName('sh1t');assert.equal(h.player.name,'♥♥♥');
 h.engine.step();assert(h.engine.px.slice(0,h.engine.n).every(Number.isFinite));
 console.log('PASS CPU world restoration, momentum, bonds, walls, powered circuits, named character, safe rejection and resumed physics');
})().catch(error=>{console.error(error);process.exitCode=1;});
