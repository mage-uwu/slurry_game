import { DurableObject } from 'cloudflare:workers';
import './assets/showcase-shared.js';

const { MAX_BODY, validate, name } = globalThis.SlurryProject;
const COOKIE = '__Host-slurry-profile';
const TOKEN = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9-]{36}$/;
const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const json = (body,status=200,extra={}) => Response.json(body,{status,headers:{...headers,...extra}});
const hex = bytes => [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
const hash = text => crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(hex);
class ApiError extends Error { constructor(status,message,retry=0){super(message);this.status=status;this.retry=retry;} }

async function body(request,limit=MAX_BODY) {
  if (!(request.headers.get('Content-Type')||'').startsWith('application/json')) throw new ApiError(415,'Use JSON.');
  if (Number(request.headers.get('Content-Length'))>limit) throw new ApiError(413,'This project is too large.');
  const reader=request.body?.getReader(), chunks=[]; let size=0;
  if (reader) for (;;) {
    const {value,done}=await reader.read(); if(done)break;
    size+=value.length; if(size>limit){await reader.cancel();throw new ApiError(413,'This project is too large.');} chunks.push(value);
  }
  try { const data=JSON.parse(await new Blob(chunks).text()); if(!data||Array.isArray(data)||typeof data!=='object')throw 0; return data; }
  catch {throw new ApiError(400,'Invalid JSON.');}
}

// One serialized catalogue keeps quota checks, project insertion and votes atomic.
// Large worlds are split into small rows, below SQLite's per-row size limit.
export class Showcase extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);this.sql=ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY,used INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS limits_expiry ON limits(expires);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,character TEXT NOT NULL,parent TEXT,created INTEGER NOT NULL,particles INTEGER NOT NULL,likes INTEGER NOT NULL DEFAULT 0,request_id TEXT NOT NULL,preview TEXT NOT NULL,UNIQUE(owner,request_id));
      CREATE INDEX IF NOT EXISTS projects_recent ON projects(created DESC,id DESC);
      CREATE INDEX IF NOT EXISTS projects_popular ON projects(likes DESC,created DESC,id DESC);
      CREATE TABLE IF NOT EXISTS chunks (project TEXT NOT NULL,part INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(project,part));
      CREATE TABLE IF NOT EXISTS votes (project TEXT NOT NULL,profile TEXT NOT NULL,PRIMARY KEY(project,profile));`);
    this.sql.exec('INSERT OR IGNORE INTO settings VALUES (?,?)','salt',hex(crypto.getRandomValues(new Uint8Array(32))));
    this.salt=this.sql.exec('SELECT value FROM settings WHERE key=?','salt').one().value;
  }
  used(key){return this.sql.exec('SELECT used FROM limits WHERE key=?',key).toArray()[0]?.used||0;}
  consume(key,max,expires) {
    if(this.used(key)>=max)throw new ApiError(429,max===4?'Daily limit reached. Try again after midnight UTC.':'Too many requests. Please try again later.',Math.max(1,Math.ceil((expires-Date.now())/1000)));
    this.sql.exec('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1',key,expires);
  }
  remaining(user,network,day){return Math.max(0,4-Math.max(this.used(`save:user:${user}:${day}`),this.used(`save:net:${network}:${day}`)));}
  async fetch(request) {
    try {
      const url=new URL(request.url), path=url.pathname.slice('/api/showcase'.length), now=Date.now(), day=Math.floor(now/86400000), reset=(day+1)*86400000;
      const network=await hash(this.salt+':'+(request.headers.get('CF-Connecting-IP')||'local'));
      this.sql.exec('DELETE FROM limits WHERE expires<=?',now);
      this.consume(`requests:${network}:${Math.floor(now/60000)}`,120,(Math.floor(now/60000)+1)*60000);
      const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
      const tokenHash=token&&TOKEN.test(token)?await hash(token):'';
      let user=this.sql.exec('SELECT id,name FROM profiles WHERE token_hash=?',tokenHash).toArray()[0];
      if(path==='/session'&&request.method==='GET')return json({profile:user||null,remaining:user?this.remaining(user.id,network,day):Math.max(0,4-this.used(`save:net:${network}:${day}`)),resetAt:reset});
      if(path==='/session'&&request.method==='POST') {
        const data=await body(request,2048);let displayName;
        try{displayName=name(data.name??'Player',24,'Player');}catch{throw new ApiError(400,'Invalid character name.');}
        if(user){this.sql.exec('UPDATE profiles SET name=? WHERE id=?',displayName,user.id);user.name=displayName;return json({profile:user,remaining:this.remaining(user.id,network,day),resetAt:reset});}
        this.consume(`profiles:${network}:${day}`,12,reset);
        const secret=hex(crypto.getRandomValues(new Uint8Array(32))), digest=await hash(secret);
        user={id:crypto.randomUUID(),name:displayName};
        this.sql.exec('INSERT INTO profiles VALUES (?,?,?)',user.id,digest,user.name);
        return json({profile:user,remaining:this.remaining(user.id,network,day),resetAt:reset},201,{'Set-Cookie':`${COOKIE}=${secret}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Strict`});
      }
      if(path==='/projects'&&request.method==='GET') {
        const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>10000)throw new ApiError(400,'Invalid page.');
        const order=url.searchParams.get('sort')==='top'?'p.likes DESC,p.created DESC,p.id DESC':'p.created DESC,p.id DESC';
        const rows=this.sql.exec(`SELECT p.id,p.title,p.character,p.parent,p.created,p.particles,p.likes,p.preview,p.owner=? AS own,EXISTS(SELECT 1 FROM votes v WHERE v.project=p.id AND v.profile=?) AS liked FROM projects p ORDER BY ${order} LIMIT 13 OFFSET ?`,user?.id||'',user?.id||'',offset).toArray();
        return json({projects:rows.slice(0,12),nextOffset:rows.length>12?offset+12:null});
      }
      const match=path.match(/^\/projects\/([a-f0-9-]{36})(\/like)?$/);
      if(match&&request.method==='GET'&&!match[2]) {
        const project=this.sql.exec('SELECT id,title,character,parent,created,particles,likes FROM projects WHERE id=?',match[1]).toArray()[0];
        if(!project)throw new ApiError(404,'Project not found.');
        const text=this.sql.exec('SELECT data FROM chunks WHERE project=? ORDER BY part',project.id).toArray().map(r=>r.data).join('');
        return json({project,snapshot:JSON.parse(text)});
      }
      if(request.method!=='POST')throw new ApiError(405,'Method not allowed.');
      if(!user)throw new ApiError(401,'Create your character profile first.');
      this.consume(`writes:${network}:${Math.floor(now/60000)}`,30,(Math.floor(now/60000)+1)*60000);
      if(match&&match[2]) {
        const data=await body(request,2048);if(typeof data.liked!=='boolean')throw new ApiError(400,'Invalid vote.');
        return this.ctx.storage.transactionSync(()=>{
          const project=this.sql.exec('SELECT owner FROM projects WHERE id=?',match[1]).toArray()[0];
          if(!project)throw new ApiError(404,'Project not found.');
          if(project.owner===user.id)throw new ApiError(403,'Thumbs up other creators’ projects.');
          if(data.liked)this.sql.exec('INSERT OR IGNORE INTO votes VALUES (?,?)',match[1],user.id);
          else this.sql.exec('DELETE FROM votes WHERE project=? AND profile=?',match[1],user.id);
          this.sql.exec('UPDATE projects SET likes=(SELECT COUNT(*) FROM votes WHERE project=?) WHERE id=?',match[1],match[1]);
          return json({likes:this.sql.exec('SELECT likes FROM projects WHERE id=?',match[1]).one().likes,liked:data.liked});
        });
      }
      if(path!=='/projects')throw new ApiError(404,'Not found.');
      const data=await body(request);
      if(typeof data.requestId!=='string'||!ID.test(data.requestId))throw new ApiError(400,'Invalid save identifier.');
      // A retry after a dropped response must neither duplicate the project nor spend another slot.
      const existing=this.sql.exec('SELECT id,title,character,parent FROM projects WHERE owner=? AND request_id=?',user.id,data.requestId).toArray()[0];
      if(existing)return json({project:existing,remaining:this.remaining(user.id,network,day),resetAt:reset});
      if(!this.remaining(user.id,network,day))throw new ApiError(429,'Daily limit reached. Try again after midnight UTC.',Math.max(1,Math.ceil((reset-now)/1000)));
      let snapshot,title,thumbnail;
      try{const checked=validate(data.snapshot);snapshot=checked.snapshot;thumbnail=globalThis.SlurryProject.preview(checked.arrays,snapshot);title=name(data.title,48,'Untitled world');}catch(error){throw new ApiError(400,error.message);}
      const parent=data.parent??null;
      if(parent!==null&&(typeof parent!=='string'||!ID.test(parent)||!this.sql.exec('SELECT id FROM projects WHERE id=?',parent).toArray().length))throw new ApiError(400,'Original project not found.');
      const serialized=JSON.stringify(snapshot), id=crypto.randomUUID();
      return this.ctx.storage.transactionSync(()=>{
        this.consume(`save:user:${user.id}:${day}`,4,reset);this.consume(`save:net:${network}:${day}`,4,reset);
        this.sql.exec('INSERT INTO projects(id,owner,title,character,parent,created,particles,request_id,preview) VALUES (?,?,?,?,?,?,?,?,?)',id,user.id,title,snapshot.player.name,parent,now,snapshot.count,data.requestId,thumbnail);
        for(let start=0,part=0;start<serialized.length;start+=250000,part++)this.sql.exec('INSERT INTO chunks VALUES (?,?,?)',id,part,serialized.slice(start,start+250000));
        return json({project:{id,title,character:snapshot.player.name,parent},remaining:this.remaining(user.id,network,day),resetAt:reset},201);
      });
    } catch(error) {
      if(error instanceof ApiError)return json({error:error.message},error.status,error.retry?{'Retry-After':String(error.retry)}:{});
      console.error('Showcase request failed',error.name);
      return json({error:'Showcase is temporarily unavailable. Your current world is safe.'},503);
    }
  }
}

export async function showcaseFetch(request,env) {
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if((origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.method==='POST'&&origin!==url.origin))return json({error:'Same-origin requests only.'},403);
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405,{Allow:'GET, POST'});
  try{return await env.SHOWCASE.getByName('slurry-showcase-v1').fetch(request);}
  catch{return json({error:'Showcase is temporarily unavailable. Your current world is safe.'},503);}
}
