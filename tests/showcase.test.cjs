const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),{mkdtemp,rm}=require('node:fs/promises'),{Miniflare}=require('miniflare'),world=require('./project-fixture.cjs');
(async()=>{
  const state=await mkdtemp(path.join(os.tmpdir(),'slurry-showcase-'));
  const create=()=>new Miniflare({modules:true,scriptPath:path.join(__dirname,'..','worker.js'),modulesRules:[{type:'ESModule',include:['**/*.js']}],compatibilityDate:'2025-09-01',durableObjects:{SHOWCASE:{className:'Showcase',useSQLite:true},VISITORS:{className:'VisitorCounter',useSQLite:true}},durableObjectsPersist:state,serviceBindings:{ASSETS:()=>new Response('asset')}});
  let mf=create();const base='https://monomage.test';
  const req=(route,{method='GET',cookie='',ip='192.0.2.1',data,headers={}}={})=>mf.dispatchFetch(base+'/api/showcase'+route,{method,headers:{Origin:base,'Content-Type':'application/json','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
  const profile=async ip=>{const response=await req('/session',{method:'POST',ip,data:{name:'Mage'}});assert.equal(response.status,201);return response.headers.get('Set-Cookie').split(';')[0];};
  const save=(cookie,ip,data={})=>req('/projects',{method:'POST',cookie,ip,data:{title:'Garden',snapshot:world(),requestId:crypto.randomUUID(),...data}});
  try{
    assert.equal((await(await req('/session')).json()).profile,null);
    assert.equal((await req('/projects',{method:'POST',data:{}})).status,401);
    const cookie=await profile('192.0.2.1'),requests=Array.from({length:12},()=>({requestId:crypto.randomUUID(),title:'SH1T garden',snapshot:{...world(),player:{...world().player,name:'TRANNY'}}}));
    const responses=await Promise.all(requests.map(data=>save(cookie,'192.0.2.1',data)));
    assert.equal(responses.filter(r=>r.status===201).length,4);assert.equal(responses.filter(r=>r.status===429).length,8);
    const index=responses.findIndex(r=>r.status===201),saved=await responses[index].json(),id=saved.project.id;
    assert.equal(saved.project.title,'♥♥♥ garden');assert.equal(saved.project.character,'♥♥♥');
    assert.equal((await save(cookie,'192.0.2.1',requests[index])).status,200);
    assert.equal((await(await req('/session',{cookie})).json()).remaining,0);
    const fresh=await profile('192.0.2.1');assert.equal((await save(fresh,'192.0.2.1')).status,429);
    assert.equal((await save(cookie,'192.0.2.9')).status,429); // Profile quota follows a network change.
    const loaded=await(await req('/projects/'+id)).json();assert.equal(loaded.snapshot.player.name,'♥♥♥');assert.equal(loaded.snapshot.state,world().state);
    assert.equal((await req('/projects/'+id+'/like',{method:'POST',cookie,data:{liked:true}})).status,403);
    const second=await profile('192.0.2.2');
    const votes=await Promise.all(Array.from({length:10},()=>req('/projects/'+id+'/like',{method:'POST',cookie:second,ip:'192.0.2.2',data:{liked:true}})));
    for(const vote of votes){assert.equal(vote.status,200);assert.equal((await vote.json()).likes,1);}
    assert.equal((await(await req('/projects/'+id+'/like',{method:'POST',cookie:second,ip:'192.0.2.2',data:{liked:false}})).json()).likes,0);
    const fork=await(await save(second,'192.0.2.2',{parent:id})).json();assert.equal(fork.project.parent,id);
    const listed=await(await req('/projects?sort=top',{cookie:second})).json();assert.equal(listed.projects.length,5);assert(listed.projects.every(p=>p.preview.length>0));assert(!('owner'in listed.projects[0]));
    assert.equal((await save(second,'192.0.2.2',{snapshot:{}})).status,400);
    assert.equal((await save(second,'192.0.2.2',{parent:crypto.randomUUID()})).status,400);
    assert.equal((await req('/projects?offset=-1')).status,400);
    assert.equal((await req('/session',{method:'POST',data:{},headers:{Origin:'https://evil.test'}})).status,403);
    assert.equal((await req('/projects',{method:'DELETE'})).status,405);
    assert.equal((await req('/projects/'+crypto.randomUUID())).status,404);
    assert.equal((await req('/projects',{method:'POST',cookie:second,ip:'192.0.2.2',data:{},headers:{'Content-Type':'text/plain'}})).status,415);
    const third=await profile('192.0.2.3'),large=world(131072),bigResponse=await save(third,'192.0.2.3',{snapshot:large});
    assert.equal(bigResponse.status,201,await bigResponse.clone().text());const big=(await bigResponse.json()).project;
    const bigLoaded=await(await req('/projects/'+big.id)).json();assert.equal(bigLoaded.snapshot.bonds,large.bonds);assert.equal(bigLoaded.snapshot.state,large.state);
    await mf.dispose();mf=create();
    assert.equal((await(await req('/projects')).json()).projects.length,6);
    assert.equal((await(await req('/session',{cookie})).json()).remaining,0);
    assert.equal((await(await req('/projects/'+fork.project.id)).json()).project.parent,id);
    console.log('PASS persistent public catalogue, atomic 4/day quota, cookie-reset guard, retries, votes, fork attribution, moderation, malformed requests and 128k-particle round trip');
  }finally{await mf.dispose();await rm(state,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
