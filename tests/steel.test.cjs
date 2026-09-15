const assert=require('node:assert/strict'),fs=require('fs');const src=fs.readFileSync(require('node:path').join(__dirname,'../slurry/index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0];const {Engine,makeParams}=new Function(src+';return {Engine,makeParams}')();
for(const type of [22,6]){const e=new Engine(40,40,500,makeParams({jitter:0})),rest=new Map();for(let y=10;y<13;y+=.5)for(let x=15;x<21;x+=.5){e.add(x,y,type);rest.set(e.pid[e.n-1]&1048575,[x,y]);}for(let k=0;k<700;k++)e.step();let err=0,num=0,bonds=0;for(let i=0;i<e.n;i++){for(let j=i+1;j<e.n;j++){const a=rest.get(e.pid[i]&1048575),b=rest.get(e.pid[j]&1048575);err+=(Math.hypot(e.qx[i]-e.qx[j],e.qy[i]-e.qy[j])-Math.hypot(a[0]-b[0],a[1]-b[1]))**2;num++;}for(let k=0;k<8;k++)if(e.bonds[i*8+k]!==4294967295)bonds++;}if(type===22){assert(e.n===72&&bonds>400);assert(Math.sqrt(err/num)<.001,'steel keeps its shape after floor impact');}console.log(type,'shape RMS',Math.sqrt(err/num),'bonds',bonds,'n',e.n,'miny',Math.min(...e.qy.slice(0,e.n)));}

const e=new Engine(40,40,10,makeParams({gy:0,jitter:0}));e.add(20,20,22);e.add(20.5,20,22);e.sort();e.wakePass();e.density();e.bondPass();const original=e.bonds.slice();e.px[1]+=.4;for(let i=0;i<100;i++)e.bondPass();assert.deepEqual(e.bonds,original,'steel does not plastically creep');
e.attr[1]=0;e.sort();e.wakePass();e.density();e.bondPass();assert(e.bonds.slice(0,8).every(b=>b===4294967295),'erasing steel clears dangling bonds');
const world=require('./project-fixture.cjs')();world.attributes=globalThis.SlurryProject.encode(new Uint32Array([22,22]));assert.equal(globalThis.SlurryProject.validate(world).arrays.attributes[0]&31,22);
console.log('PASS steel rigidity, fixed rest lengths, erasure and project format');

// Pixel-art surface has a filled interior and four discrete metal shades.
const html=fs.readFileSync(require('node:path').join(__dirname,'../slurry/index.html'),'utf8');
const render=new Function('const TM=31,T_STEEL=22;return function '+html.slice(html.indexOf('renderSteelPixels(){'),html.indexOf('  blit(smooth) {')) )();
const block=new Engine(40,40,200,makeParams({gy:0}));for(let y=12.25;y<18;y+=.5)for(let x=10.25;x<16;x+=.5)block.add(x,y,22);
const view={FW:80,FH:80,S:2,e:block,img:{data:new Uint8ClampedArray(80*80*4)}};render.call(view);
const colors=new Set();for(let y=25;y<35;y++)for(let x=21;x<31;x++)assert.equal(view.img.data[(y*80+x)*4+3],255,'steel interior has no particle gaps');
for(let k=0;k<6400;k++)if(view.img.data[k*4+3])colors.add(Array.from(view.img.data.slice(k*4,k*4+3)).join(','));assert(colors.size<=4&&colors.size>=3);
if(process.env.STEEL_PREVIEW)fs.writeFileSync(process.env.STEEL_PREVIEW,view.img.data);
console.log('PASS continuous steel pixel surface and stepped metal palette');
