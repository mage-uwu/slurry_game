// Runs in the game's classic-script scope; the engine stays idle during GPU readback.
let projectBusy = false;
function createSlurryProjectBridge() {
  const format = globalThis.SlurryProject;
  async function readGPU(buffer, bytes, offset=0) {
    if(!bytes)return new ArrayBuffer(0);
    const d=sim.device,b=d.createBuffer({size:bytes,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    try {
      const enc=d.createCommandEncoder();enc.copyBufferToBuffer(buffer,offset,b,0,bytes);d.queue.submit([enc.finish()]);
      await b.mapAsync(GPUMapMode.READ);return b.getMappedRange().slice(0);
    } finally {b.destroy();}
  }
  function setName(value) {player.name=format.name(value,24,'Player');return player.name;}
  async function capture() {
    if(projectBusy)throw new Error('Please wait for the current project operation.');
    if(sim.lost)throw new Error('The GPU was lost. Reload before saving.');
    projectBusy=true;ptr.down=false;player.keys.clear();
    try {
      let state,attributes,ids,bonds,anchors,n,nextId,frame,clock;
      if(sim.kind==='GPU') {
        // Drain previous emissions before flushing pending brush particles and sorting.
        await sim.device.queue.onSubmittedWorkDone();
        sim.frame(0,{},ui.view);
        n=sim.nUpper?new Uint32Array(await readGPU(sim.starts,4,NC*4))[0]:0;
        const p=sim.cur;
        const raw=await Promise.all([readGPU(sim.st[p],n*16),readGPU(sim.at[p],n*4),readGPU(sim.pid[p],n*4),readGPU(sim.bond[p],n*NB*4),readGPU(sim.anchor[p],n*16),readGPU(sim.playerBuf,64),readGPU(sim.rotorBuf,ROTOR_MAX*ROTOR_BYTES)]);
        [state,attributes,ids,bonds,anchors]=raw.slice(0,5).map((a,i)=>new ([Float32Array,Uint32Array,Uint32Array,Uint32Array,Float32Array][i])(a));
        const pl=new Float32Array(raw[5]),rot=new Float32Array(raw[6]);
        Object.assign(player,{x:pl[0],y:pl[1],vx:pl[2],vy:pl[3],ground:pl[8]>.5,wet:pl[9]>.5,face:pl[10],wasUp:pl[11]>.5,active:pl[12]>.5});
        machines.rotors.forEach((r,i)=>{if(r)Object.assign(r,{angle:rot[i*ROTOR_WORDS+2],omega:rot[i*ROTOR_WORDS+3],power:rot[i*ROTOR_WORDS+6],energy:rot[i*ROTOR_WORDS+7]});});
        nextId=sim.nextId;frame=sim.frameId;clock=sim.lifeClock;
      } else {
        const e=sim.e;e.sort();n=e.n;state=new Float32Array(n*4);anchors=new Float32Array(n*4);
        for(let i=0;i<n;i++){state.set([e.px[i],e.py[i],e.qx[i],e.qy[i]],i*4);anchors.set([e.anchor[i*2],e.anchor[i*2+1],0,0],i*4);}
        attributes=e.attr.slice(0,n);ids=e.pid.slice(0,n);bonds=e.bonds.slice(0,n*NB);nextId=e.nextId;frame=e.tick;clock=e.lifeClock;
      }
      const snapshot={version:1,width:W,height:H,count:n,nextId,frame,clock,settings:{grav:ui.grav,speed:ui.speed,view:ui.view,edge:edgeOn},
        machines:{rotors:machines.rotors,lights:machines.lights,gates:machines.gates,signals:Array.from(machines.signals),clock:machines.clock},
        player:{name:player.name||'Player',active:player.active,x:player.x,y:player.y,vx:player.vx,vy:player.vy,face:player.face,ground:player.ground,wet:player.wet,wasUp:player.wasUp,phase:player.phase}};
      for(const [key,array]of Object.entries({state,attributes,ids,bonds,anchors,walls,wires:machines.wire}))snapshot[key]=format.encode(array);
      return format.validate(snapshot).snapshot;
    } finally {projectBusy=false;}
  }
  async function restore(input) {
    // Validate everything, including device capacity, before touching the current world.
    const {snapshot:s,arrays:a}=format.validate(input);
    if(s.count>sim.maxP)throw new Error(`This world has ${s.count.toLocaleString()} particles. This device supports ${sim.maxP.toLocaleString()}; open it in a WebGPU browser.`);
    if(projectBusy)throw new Error('Please wait for the current project operation.');
    if(sim.lost)throw new Error('The GPU was lost. Reload before loading.');
    projectBusy=true;ptr.down=false;player.keys.clear();
    try {
      if(sim.kind==='GPU')await sim.device.queue.onSubmittedWorkDone();
      clearAll();ui.running=false;acc=0;
      walls.set(a.walls);wallsDirty=true;machines.wire.set(a.wires);
      s.machines.rotors.forEach((r,i)=>machines.rotors[i]=r);s.machines.lights.forEach((l,i)=>machines.lights[i]=l);machines.gates=s.machines.gates;
      machines.rebuildMap();machines.rebuildWires();
      if(s.machines.signals.length===machines.signals.length)machines.signals.set(s.machines.signals);
      machines.clock=s.machines.clock;
      Object.assign(player,s.player);player.rev++;player.keys.clear();
      Object.assign(ui,{grav:s.settings.grav,speed:s.settings.speed,view:s.settings.view});edgeOn=s.settings.edge;
      if(sim.kind==='GPU') {
        const d=sim.device,q=d.queue,enc=d.createCommandEncoder();
        for(const b of [sim.idxBuf,sim.rareMeta,sim.rareHeads,sim.rareEmits,sim.cellAct,sim.cellWake])enc.clearBuffer(b);
        q.submit([enc.finish()]);
        sim.hasSteel=a.attributes.some(v=>((v&31)===22||(v&31)===23));sim.nUpper=sim.alive=s.count;sim.pendN=0;sim.nextId=s.nextId;sim.lifeClock=s.clock;
        // Keep frameId monotonic: delayed readbacks must not override the restored world.
        sim.frameId=Math.max(sim.frameId,s.frame);sim.playerRev=-1;
        if(s.count)for(const p of [0,1])for(const [buffer,array]of [[sim.st[p],a.state],[sim.at[p],a.attributes],[sim.pid[p],a.ids],[sim.bond[p],a.bonds],[sim.anchor[p],a.anchors]])q.writeBuffer(buffer,0,array);
      } else {
        const e=sim.e=new Engine(W,H,MAXP_CPU,PRM);e.wall=walls;e.n=s.count;e.nextId=s.nextId;e.tick=s.frame;e.lifeClock=s.clock;
        e.attr.set(a.attributes);e.pid.set(a.ids);e.bonds.set(a.bonds);
        for(let i=0;i<s.count;i++){e.px[i]=a.state[i*4];e.py[i]=a.state[i*4+1];e.qx[i]=a.state[i*4+2];e.qy[i]=a.state[i*4+3];e.anchor[i*2]=a.anchors[i*4];e.anchor[i*2+1]=a.anchors[i*4+1];}
      }
      refreshUI();sim.frame(0,{},ui.view);drawCursor();
    } finally {projectBusy=false;}
  }
  return {capture,restore,setName,get name(){return player.name||'Player';},pause(){const running=ui.running;ui.running=false;player.keys.clear();ptr.down=false;refreshUI();return running;},resume(running){ui.running=running;refreshUI();}};
}
