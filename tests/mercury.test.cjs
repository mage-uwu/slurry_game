// Run with Node.js: node tests/mercury.test.cjs
const assert=require('node:assert/strict'),fs=require('fs'),src=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8').split('<script>')[1].split('// ---------- WGSL ----------')[0],m={exports:{}};new Function('module',src+'\nmodule.exports={Engine,makeParams};')(m);const {Engine,makeParams}=m.exports;
for(const mode of ['fall','settle','sink']){
 const e=new Engine(40,40,2500,makeParams({jitter:0}));
 for(let y=mode==='settle'?36:10;y<(mode==='settle'?39:13);y+=.42)for(let x=16;x<22;x+=.42)e.add(x,y,10);
 if(mode==='sink')for(let y=18;y<39;y+=.55)for(let x=3;x<37;x+=.55)e.add(x,y,1);
 let peak=0,sum=0,count=0,maxAir=0;
 for(let k=0;k<900;k++){e.step();if(k>500)for(let i=0;i<e.n;i++)if((e.attr[i]&31)===10){const v=Math.hypot(e.px[i]-e.qx[i],e.py[i]-e.qy[i]);peak=Math.max(peak,v);sum+=v;count++;maxAir=Math.max(maxAir,40-e.qy[i]);}}
 const ys=Array.from({length:e.n},(_,i)=>i).filter(i=>(e.attr[i]&31)===10).map(i=>e.qy[i]);assert(ys.length>0);assert(ys.every(Number.isFinite));assert(ys.reduce((a,b)=>a+b)/ys.length>35,'mercury should fall/sink to the bottom');assert(Math.min(...ys)>30,'resting mercury must not launch across the map');assert(sum/count<.03,'resting mercury must settle');console.log('PASS mercury '+mode,{meanY:ys.reduce((a,b)=>a+b)/ys.length,minY:Math.min(...ys),peak,meanSpeed:sum/count,maxAir});
}
