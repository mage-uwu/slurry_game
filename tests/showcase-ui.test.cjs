// DOM integration test. Actual browser layout/WebGPU still need a browser smoke check.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),{Miniflare}=require('miniflare'),world=require('./project-fixture.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),mf=new Miniflare({modules:true,scriptPath:path.join(root,'worker.js'),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2025-09-01',durableObjects:{SHOWCASE:{className:'Showcase',useSQLite:true}},serviceBindings:{ASSETS:()=>new Response('asset')}});
 const dom=new JSDOM('<div id="rig"><div id="status"></div></div>',{url:'https://monomage.test/slurry/',runScripts:'outside-only'}),w=dom.window;
 let cookie='',profileName='Player',current=world(),running=true,restores=0,dropResponse=true,saveIds=[],saveBodies=[];
 const wait=async check=>{for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out: '+w.document.body.textContent);};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(){},fillRect(){}});
 w.AbortController=AbortController;
 w.fetch=async(route,init)=>{
   const response=await mf.dispatchFetch('https://monomage.test'+route,{method:init.method,headers:{...init.headers,Origin:'https://monomage.test','CF-Connecting-IP':'192.0.2.77',Cookie:cookie},body:init.body});
   if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
   if(route==='/api/showcase/projects'&&init.method==='POST'){saveIds.push(JSON.parse(init.body).requestId);saveBodies.push(JSON.parse(init.body));if(dropResponse){dropResponse=false;await response.text();throw new Error('Test: response lost');}}
   return response;
 };
 w.__slurry={projects:{get name(){return profileName;},setName(value){profileName=w.SlurryProject.name(value,24,'Player');current.player.name=profileName;return profileName;},capture:async()=>structuredClone(current),restore:async snapshot=>{current=structuredClone(snapshot);profileName=current.player.name;restores++;running=false;w.dispatchEvent(new w.Event('slurry-clear'));},pause(){const old=running;running=false;return old;},resume(value){running=value;}}};
 try{
   for(const file of ['showcase-shared.js','showcase.js'])w.eval(fs.readFileSync(path.join(root,'assets',file),'utf8'));
   const d=w.document,click=text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'Button '+text);b.click();};
   assert.equal(d.querySelector('#project-bar input'),null);assert.equal(d.getElementById('character-name'),null);
   click('Save project');await wait(()=>d.querySelector('form'));assert.equal(running,false);
   const name=d.getElementById('character-name');assert(d.querySelector('form').contains(name));name.value='TRANNY';name.dispatchEvent(new w.Event('change'));assert.equal(name.value,'♥♥♥');
   d.querySelector('form input').value='Garden';d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>d.querySelector('.showcase-status').textContent.includes('response lost'));
   d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>d.querySelector('.showcase-status').textContent.startsWith('Saved.'));
   assert.equal(saveIds.length,2);assert.equal(saveIds[0],saveIds[1]);assert(d.querySelector('.showcase-status').textContent.includes('3 of 4'));
   click('Close');assert.equal(running,true);click('Showcase');await wait(()=>d.querySelector('.project-card'));
   assert.equal(d.querySelector('.project-card h3').textContent,'Garden');assert(d.querySelector('.project-card p').textContent.startsWith('♥♥♥'));assert(d.querySelector('[aria-label="Thumbs up Garden"]').disabled);
   w.confirm=()=>false;click('Load');assert.equal(restores,0);
   w.confirm=()=>true;click('Load');await wait(()=>restores===1&&!d.querySelector('dialog').open);assert.equal(running,false);assert.equal(profileName,'♥♥♥');
   assert.equal([...d.querySelectorAll('button')].some(b=>b.textContent==='Fork'),false);
   click('Save project');await wait(()=>d.querySelector('form'));assert(d.querySelector('form').textContent.includes('original project'));assert.equal(d.querySelector('form input').value,'Garden');
   name.value='Mage';name.dispatchEvent(new w.Event('change'));d.querySelector('form input').value='My garden';
   d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>d.querySelector('.showcase-status').textContent.startsWith('Saved.'));assert.equal(profileName,'Mage');
   const latest=saveBodies.at(-1);assert(latest.parent);assert.equal(latest.snapshot.player.name,'Mage');
   const original=await(await mf.dispatchFetch('https://monomage.test/api/showcase/projects/'+latest.parent)).json();assert.equal(original.project.title,'Garden');assert.equal(original.snapshot.player.name,'♥♥♥');
   click('Browse showcase');await wait(()=>d.querySelectorAll('.project-card').length===2);assert([...d.querySelectorAll('button')].some(b=>b.textContent==='↳ Original'));click('Close');
   w.dispatchEvent(new w.Event('slurry-clear'));assert.equal(d.getElementById('project-context').textContent,'');
   console.log('PASS showcase DOM flow, save-dialog naming, unified load, modal pause/resume, retry after lost response, previews, own-vote control, load confirmation and fork attribution');
 }finally{dom.window.close();await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
