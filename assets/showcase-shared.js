/* Shared browser/server format. No executable user content is accepted. */
(() => {
  const MAX_PARTICLES = 131072, MAX_BODY = 16 * 1024 * 1024;
  const words = ['nigger', 'nigga', 'tranny', 'trannies', 'faggot', 'fag', 'kike', 'chink', 'spic', 'wetback', 'gook', 'retard', 'retarded', 'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'arsehole', 'bastard', 'damn', 'piss', 'cock', 'dick', 'pussy', 'motherfucker', 'motherfucking', 'bullshit', 'shithead', 'dumbass', 'jackass', 'twat', 'wanker', 'whore', 'slut'];
  const letters = { a: '[a@4]', b: '[b8]', e: '[e3]', g: '[g69]', i: '[i1!|]', o: '[o0]', s: '[s$5]', t: '[t7+]' };
  const embedded = new Set(['nigger','nigga','tranny','trannies','faggot','fuck']);
  const patterns = words.sort((a,b) => b.length-a.length).map(word => new RegExp((embedded.has(word)?'':'(?<![\\p{L}])') + [...word].map(c => (letters[c] || c) + '+').join('[\\s._*\\-]*') + '(?:s|ers|er|ing|ed)?' + (embedded.has(word)?'':'(?![\\p{L}])'), 'giu'));
  function censor(value) {
    const text = String(value).normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    // Match an accent-folded projection, but preserve innocent Unicode names verbatim.
    let folded='',index=0;const positions=[],spans=[];
    for(const char of text){const simple=char.normalize('NFKD').replace(/\p{M}/gu,'');for(let k=0;k<simple.length;k++)positions.push([index,index+char.length]);folded+=simple;index+=char.length;}
    for(const pattern of patterns)for(const match of folded.matchAll(pattern))spans.push([positions[match.index][0],positions[match.index+match[0].length-1][1]]);
    spans.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const span of spans){const last=merged.at(-1);if(last&&span[0]<last[1])last[1]=Math.max(last[1],span[1]);else merged.push(span);}
    let result='',cursor=0;for(const [start,end]of merged){result+=text.slice(cursor,start)+'♥♥♥';cursor=end;}return result+text.slice(cursor);
  }
  function name(value, max, fallback) {
    if (typeof value !== 'string' || value.length > 256) throw new Error('Invalid name.');
    return [...censor(value)].slice(0, max).join('') || fallback;
  }
  function encode(array) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let text = '';
    for (let i=0;i<bytes.length;i+=8192) text += String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(text);
  }
  function decode(text, Type, length) {
    const bytes = length * Type.BYTES_PER_ELEMENT;
    if (typeof text !== 'string' || text.length !== Math.ceil(bytes/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('Invalid world data.');
    const raw = atob(text);
    if (raw.length !== bytes) throw new Error('Invalid world length.');
    return new Type(Uint8Array.from(raw, c => c.charCodeAt(0)).buffer);
  }
  function finite(value, min, max) { if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid world values.'); return value; }
  function integer(value, min, max) { finite(value,min,max); if (!Number.isInteger(value)) throw new Error('Invalid world index.'); return value; }
  function bool(value) { if (typeof value !== 'boolean') throw new Error('Invalid world flag.'); return value; }
  function preview(arrays,s) {
    const pixels=new Uint8Array(16000);
    for(let y=0;y<100;y++)for(let x=0;x<160;x++){const k=y*160+x,w=y*2*320+x*2;if(arrays.walls[w]||arrays.walls[w+1]||arrays.walls[w+320]||arrays.walls[w+321])pixels[k]=31;else if(arrays.wires[k])pixels[k]=21;}
    for(let i=0;i<s.count;i++){const x=Math.floor(arrays.state[i*4+2]),y=Math.floor(arrays.state[i*4+3]);if(x>=0&&x<160&&y>=0&&y<100)pixels[y*160+x]=(arrays.attributes[i]&31)===21?15:arrays.attributes[i]&31;}
    for(const object of [...s.machines.rotors,...s.machines.lights,...s.machines.gates])if(object)for(let y=object.y-2;y<=object.y+2;y++)for(let x=object.x-2;x<=object.x+2;x++)pixels[y*160+x]=22;
    if(s.player.active){const x=Math.floor(s.player.x),y=Math.floor(s.player.y);for(let k=0;k<4;k++)if(x>=0&&x<160&&y-k>=0&&y-k<100)pixels[(y-k)*160+x]=23;}
    return encode(pixels);
  }
  function validate(s) {
    if (!s || s.version !== 1 || s.width !== 160 || s.height !== 100) throw new Error('Unsupported world format.');
    const n = integer(s.count,0,MAX_PARTICLES), arrays = {};
    for (const [key, Type, length] of [['state',Float32Array,n*4],['attributes',Uint32Array,n],['ids',Uint32Array,n],['bonds',Uint32Array,n*8],['anchors',Float32Array,n*4],['walls',Uint8Array,64000],['wires',Uint8Array,16000]]) arrays[key] = decode(s[key],Type,length);
    for (const v of arrays.state) finite(v,-1000,1000);
    for (let i=0;i<arrays.anchors.length;i++) finite(arrays.anchors[i],i%4<2?-1000:0,i%4<2?1000:1e12);
    for (const v of arrays.attributes) if ((v & 31)>21) throw new Error('Unknown material.');
    for (const v of [...arrays.walls,...arrays.wires]) if (v>1) throw new Error('Invalid wall or wire.');
    const seen = new Set();
    for (const v of arrays.ids) { const id=v & 0xfffff; if (seen.has(id)) throw new Error('Duplicate particle ID.'); seen.add(id); }
    integer(s.nextId,0,0xfffff); integer(s.frame,0,1e12); integer(s.clock,0,1e12);
    const settings = { grav: integer(s.settings?.grav,0,2), speed: integer(s.settings?.speed,0,2), view: integer(s.settings?.view,0,2), edge: bool(s.settings?.edge) };
    const position = (o,r) => ({x:integer(o.x,r+1,160-r-2),y:integer(o.y,r+1,100-r-2)});
    const objects = (list,max,convert,nullable) => { if (!Array.isArray(list) || list.length>max) throw new Error('Too many machines.'); return list.map(o => o===null&&nullable?null:convert(o)); };
    const rotors=objects(s.machines?.rotors,64,o=>({...position(o,5),angle:finite(o.angle,-1e12,1e12),omega:finite(o.omega,-1000,1000),energy:finite(o.energy,0,1e12),power:finite(o.power,0,1e12),drive:finite(o.drive,-1e12,1e12),torque:0}),true);
    const lights=objects(s.machines?.lights,64,o=>({...position(o,3),on:bool(o.on)}),true);
    const gates=objects(s.machines?.gates,64,o=>({...position(o,3),a:bool(o.a),b:bool(o.b),out:bool(o.out)}),false);
    if(!Array.isArray(s.machines.signals)||s.machines.signals.length>16000)throw new Error('Invalid circuit state.');
    const signals=s.machines.signals.map(v=>finite(v,0,1e12)),machineClock=integer(s.machines.clock,0,7);
    const p=s.player;
    if (!p) throw new Error('Missing character.');
    const player={name:name(p.name,24,'Player'),active:bool(p.active),x:finite(p.x,-1000,1000),y:finite(p.y,-1000,1000),vx:finite(p.vx,-1000,1000),vy:finite(p.vy,-1000,1000),face:finite(p.face,-1,1),ground:bool(p.ground),wet:bool(p.wet),wasUp:bool(p.wasUp),phase:finite(p.phase,0,1e12)};
    // Return a whitelist so arbitrary properties cannot be persisted or assigned to live objects.
    const snapshot={version:1,width:160,height:100,count:n,nextId:s.nextId,frame:s.frame,clock:s.clock,settings,machines:{rotors,lights,gates,signals,clock:machineClock},player};
    for (const key of Object.keys(arrays)) snapshot[key]=s[key];
    return {snapshot,arrays};
  }
  globalThis.SlurryProject = {MAX_PARTICLES,MAX_BODY,censor,name,encode,decode,validate,preview};
})();
