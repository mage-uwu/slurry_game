const assert=require('node:assert/strict'),world=require('./project-fixture.cjs'),F=globalThis.SlurryProject;
for(const text of ['NIGGER','n1gg4','n.i.g.g.e.r','n i g g a','tranny','faggot','f.u.c.k','sh1t','bitch','cunt','nig\u200bger','ＦＵＣＫ','nígger','trannies','motherfucking','bullshit'])assert.equal(F.censor(text),'♥♥♥',text);
for(const text of ['Scunthorpe','Classic glass','Dickinson','Cockatoo','Night garden','Élodie','ガーデン'])assert.equal(F.censor(text),text);
assert.equal(F.name('nigger world',48,'World'),'♥♥♥ world');
const s=world(),{snapshot,arrays}=F.validate(s);assert.deepEqual(snapshot,s);assert.equal(F.decode(F.preview(arrays,snapshot),Uint8Array,16000).length,16000);
for(const edit of [s=>s.version=2,s=>s.count=131073,s=>s.walls='bad',s=>s.state=F.encode(new Float32Array([NaN,1,1,1,1,1,1,1])),s=>s.ids=F.encode(new Uint32Array([2,2])),s=>s.machines.lights=[{x:-3,y:2,on:false}],s=>s.machines.signals=[Infinity],s=>s.player.name={},s=>s.settings.grav=9]){const bad=world();edit(bad);assert.throws(()=>F.validate(bad));}
const untrusted=world();untrusted.player.name='Tranny';untrusted.player.extra='ignored';untrusted.extra='ignored';const clean=F.validate(untrusted).snapshot;assert.equal(clean.player.name,'♥♥♥');assert(!('extra'in clean));assert(!('extra'in clean.player));
const big=world(131072);assert(JSON.stringify(big).length<F.MAX_BODY);assert.equal(F.validate(big).snapshot.count,131072);
console.log('PASS hearts, obfuscation, innocent names, malformed worlds, whitelisted metadata and full 128k capacity');
// Exercise the actual streaming parser without an HTTP client rejecting oversized bodies first.
const fs=require('node:fs'),path=require('node:path'),worker=fs.readFileSync(path.join(__dirname,'..','showcase-worker.js'),'utf8');
const parse=new Function('MAX_BODY',worker.slice(worker.indexOf('class ApiError'),worker.indexOf('// One serialized'))+';return body;')(F.MAX_BODY);
(async()=>{
 const make=(data,headers={})=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:data});
 await assert.rejects(parse(make('x'.repeat(F.MAX_BODY+1))),error=>error.status===413);
 await assert.rejects(parse(make('{}',{'Content-Length':String(F.MAX_BODY+1)})),error=>error.status===413);
 await assert.rejects(parse(make('{bad')),error=>error.status===400);
 await assert.rejects(parse(make('"'+'x'.repeat(2100)+'"'),2048),error=>error.status===413);
 assert.deepEqual(await parse(make('{"ok":true}')),{ok:true});
 console.log('PASS streaming size limits, declared size limits, small mutation limits and JSON errors');
})().catch(error=>{console.error(error);process.exitCode=1;});
