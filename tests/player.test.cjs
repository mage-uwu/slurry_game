// Run with Node.js: node tests/player.test.cjs
{
const fs=require('fs'),assert=require('node:assert/strict'),src=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0],m={exports:{}};new Function('module',src+'\nmodule.exports={Engine,makeParams,Stickman};')(m);const {Engine,makeParams,Stickman}=m.exports;
const e=new Engine(40,28,2000,makeParams({jitter:0})),p=new Stickman(40,28);const step=n=>{for(let k=0;k<n;k++){e.step();p.step(e);assert(Number.isFinite(p.x+p.y));assert(!p.blocked(p.x,p.y,(x,y)=>e.isWall(x,y)));}};
assert.equal(p.active,false);p.keys.add('KeyD');const initial=p.packed();step(10);assert.equal(p.x,initial[0]);assert.equal(p.y,initial[1]);assert.equal(p.packed()[12],0);assert.equal(p.place(20,2,()=>false),false);assert.equal(p.place(20,8,()=>true),false);assert(p.place(20,8,()=>false));assert.equal(p.place(30,8,()=>false),false);assert.equal(p.x,20);console.log('PASS absent by default, valid placement and single-player limit');
step(350);assert(p.ground&&p.y>27.9);const x=p.x;p.keys.add('KeyD');step(80);assert(p.x>x+5);p.keys.clear();step(30);
p.keys.add('KeyW');step(15);assert(p.y<26);step(350);assert(p.ground);const y=p.y;step(100);assert(Math.abs(p.y-y)<.01);p.keys.clear();step(1);p.keys.add('KeyW');step(15);assert(p.y<26);console.log('PASS gravity, walking, jump press/hold/release');
p.reset();p.place(20,8,()=>false);for(let yy=0;yy<56;yy++)e.wall[yy*80+50]=1;step(350);p.keys.add('KeyD');step(300);assert(p.x<=24.16);console.log('PASS solid-wall collision and no tunneling');
const e2=new Engine(40,28,2000,makeParams({jitter:0})),p2=new Stickman(40,28);p2.place(20,8,()=>false);for(let xx=1;xx<39;xx+=.55)for(let yy=24;yy<27;yy+=.55)e2.add(xx,yy,3);for(let k=0;k<400;k++){e2.step();p2.step(e2);}assert(p2.y<27&&p2.y>20);console.log('PASS stands on granular terrain',p2.y);
// Synthetic stationary fluid bed isolates swimming controls from a draining pool.
const e3=new Engine(40,28,2000,makeParams({gy:0,jitter:0})),p3=new Stickman(40,28);p3.place(20,18,()=>false);for(let yy=8;yy<23;yy+=.5)for(let xx=16;xx<25;xx+=.5)e3.add(xx,yy,1);e3.sort();p3.keys.add('KeyW');for(let k=0;k<20;k++)p3.step(e3);assert(p3.wet&&p3.y<17.7);p3.keys.clear();p3.keys.add('KeyS');for(let k=0;k<50;k++)p3.step(e3);assert(p3.y>18);console.log('PASS swim up and dive down');
for(const type of [4,7,18]){
 const e=new Engine(40,28,100,makeParams({gy:0,jitter:0})),p=new Stickman(40,28);p.place(20,18,()=>false);e.add(20,16,type);e.sort();p.step(e);assert.equal(p.active,false);assert(p.death);assert.equal(p.packed()[12],0);const y=p.y;p.step(e);assert.equal(p.y,y);assert(p.place(30,8,()=>false));p.step(e);assert(p.active);
}
for(const type of [1,2,5,6,9,15]){const e=new Engine(40,28,100,makeParams({gy:0,jitter:0})),p=new Stickman(40,28);p.place(20,18,()=>false);e.add(20,16,type);e.sort();p.step(e);assert(p.active);}
for(const buffer of ['blastIn','blastOut'])for(const [event,dead] of [[[18,16],true],[[0,0],false],[[-1,0],true]]){const e=new Engine(40,28,100,makeParams({gy:0,jitter:0})),p=new Stickman(40,28);p.place(20,18,()=>false);e[buffer]=event;p.step(e);assert.equal(p.active,!dead);}
p.reset();assert.equal(p.active,false);assert.equal(p.death,false);assert.equal(p.keys.size,0);console.log('PASS hazardous contacts, safe fluids, both blast buffers/ranges, death without auto-respawn and replacement');


}
{
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),s=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8').split('<script>')[1].split('</script>')[0];const events={},docs={},p={keys:new Set()},ui={toolL:'water',pen:2,running:true,view:0,grav:0},c={player:p,ui,ptr:{down:true},window:{addEventListener:(n,f)=>events[n]=f},document:{addEventListener:(n,f)=>docs[n]=f},TOOLS:Array(24).fill('other'),KEYROW:['q','k','e','r','t','y','u','i','o','p'],PEN_R:[1,2,3],VIEWS:[0,1,2],GRAV:[0,1,2],refreshUI:()=>{}};vm.createContext(c);vm.runInContext(s.slice(s.indexOf("window.addEventListener('keydown'"),s.indexOf('// pointer\n')),c);
let prevented=0;const ev=(code,key)=>({code,key,target:{closest:()=>null},preventDefault:()=>prevented++});for(const code of['KeyW','KeyA','KeyS','KeyD'])events.keydown(ev(code,code.slice(-1).toLowerCase()));assert.equal(p.keys.size,4);assert.equal(ui.toolL,'water');assert.equal(prevented,4);events.keyup(ev('KeyW','w'));assert(!p.keys.has('KeyW'));events.blur();assert.equal(p.keys.size,0);assert.equal(c.ptr.down,false);events.keydown(ev('Space',' '));assert.equal(ui.running,false);events.keydown({...ev('KeyW','w'),ctrlKey:true});assert.equal(p.keys.size,0);events.keydown({...ev('KeyA','a'),target:{closest:()=>({})}});assert.equal(p.keys.size,0);console.log('PASS WASD captures controls without brush changes; key release, blur, editable fields, shortcuts and pause');

}
