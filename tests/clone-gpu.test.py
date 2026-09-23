"""Native WGSL check of the clone kernel (rare list + rare local): pip install wgpu numpy."""
import json,math,subprocess
from pathlib import Path
import numpy as np,wgpu
page=Path(__file__).resolve().parents[1]/'slurry/index.html'
js=r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8').split('<script>')[1].split('</script>')[0];
const c=new Function(s.slice(0,s.indexOf('const TOOLS'))+`;const worlds={};
const make=(name,items)=>{const e=new Engine(40,40,400,makeParams({jitter:0}));for(const [x,y,a]of items){e.add(x,y,a&31);e.attr[e.n-1]=a;}e.sort();
 worlds[name]={n:e.n,state:Array.from({length:e.n},(_,i)=>[e.px[i],e.py[i],e.qx[i],e.qy[i]]).flat(),attrs:Array.from(e.attr.slice(0,e.n)),pid:Array.from(e.pid.slice(0,e.n)),starts:Array.from(e.cellStart),idx:Array.from(e.idx.slice(0,1024))};};
make('touch',[[20,20,T_CLONE],[20.6,20,1]]);
make('solo',[[20,20,T_CLONE|(8<<16)]]);
make('buried',[[20,20,T_CLONE|(8<<16)],[20,20.8,T_CLONE],[20.8,20,T_CLONE],[20,19.2,T_CLONE],[19.2,20,T_CLONE]]);
const row=[];for(let k=0;k<64;k++)row.push([2+(k%16)*2.2,4+Math.floor(k/16)*8,T_CLONE|(1<<16)]);make('many',row);
return {list:SH_RARE_LIST,local:SH_RARE_LOCAL,words:RARE_HEAD_WORDS,period:CLONE_PERIOD,max:CLONE_FRAME_MAX,worlds};`)();console.log(JSON.stringify(c));"""
code=json.loads(subprocess.check_output(['node','-e',js,str(page)],text=True))
dev=wgpu.gpu.request_adapter_sync(power_preference='low-power').request_device_sync();U=wgpu.BufferUsage
def buf(data=None,size=None,uniform=False):
 b=dev.create_buffer(size=size or data.nbytes,usage=U.COPY_SRC|U.COPY_DST|(U.UNIFORM if uniform else U.STORAGE|U.INDIRECT))
 if data is not None:dev.queue.write_buffer(b,0,data)
 return b
pipes={k:dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=code[k]),'entry_point':'main'})for k in['list','local']}
meta=buf(size=1048576*32)
def run(w,clock,starts_override=None,att=None):
 n=w['n'];uf=np.zeros(424,np.float32);uf.view(np.uint32)[:8]=[40,40,1600,n,80,80,1,1];uf[99]=clock
 starts=np.array(w['starts'],np.uint32)
 if starts_override is not None:starts[1600]=starts_override
 at=buf(np.array(w['attrs'] if att is None else att,np.uint32));emits=buf(size=4112);heads=buf(size=code['words']*4)
 st=buf(np.array(w['state'],np.float32));pid=buf(np.array(w['pid'],np.uint32));snap=buf(size=max(n,1)*32);nxt=buf(size=max(n,1)*4)
 u=buf(uf,uniform=True);walls=buf(size=80*80*4);idx=buf(np.array(w['idx'],np.uint32));sb=buf(starts)
 g=lambda k,bs:dev.create_bind_group(layout=pipes[k].get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate(bs)])
 enc=dev.create_command_encoder();p=enc.begin_compute_pass()
 p.set_pipeline(pipes['list']);p.set_bind_group(0,g('list',[u,st,at,pid,meta,heads,nxt,snap,emits]));p.dispatch_workgroups(math.ceil(n/256))
 p.set_pipeline(pipes['local']);p.set_bind_group(0,g('local',[u,snap,st,at,sb,meta,emits,walls,idx]));p.dispatch_workgroups(math.ceil(n/256))
 p.end();dev.queue.submit([enc.finish()])
 words=np.frombuffer(dev.queue.read_buffer(emits),np.uint32);floats=words.view(np.float32)
 items=[(floats[4+k*8:8+k*8].copy(),int(words[8+k*8]))for k in range(min(128,int(words[0])))]
 return np.frombuffer(dev.queue.read_buffer(at),np.uint32).copy(),items,int(words[2])
W=code['worlds']
attrs,items,_=run(W['touch'],10);clone=[a for a in attrs if a&31==24][0]
assert (clone>>16)&31==1 and not items,(hex(clone),items)
print('PASS GPU contact programs a blank clone with the touching material, without emitting')
attrs,items,_=run(W['solo'],100);assert len(items)==1,items
(m,a)=items[0];assert a&31==8 and abs(math.hypot(m[0]-20,m[1]-20)-.8)<1e-5,(m,a);first=tuple(np.round(m[:2],3))
_,items,_=run(W['solo'],100+code['period']-1);assert not items,'emission waits a full period'
_,items,_=run(W['solo'],100+code['period']);assert len(items)==1 and tuple(np.round(items[0][0][:2],3))!=first,'next emission rotates direction'
_,items,_=run(W['solo'],100+3*code['period'],starts_override=131072);assert not items,'fill ceiling pauses cloning'
print('PASS GPU steady per-clone period, rotating emission spot and fill ceiling')
_,items,_=run(W['buried'],1000);assert not items,items
print('PASS GPU fully surrounded clone emits nothing')
_,items,tried=run(W['many'],5000);assert tried==64 and len(items)==code['max'],(tried,len(items))
assert all(a&31==1 for _,a in items)
print(f"PASS GPU world-wide clone budget: 64 ready clones, {code['max']} emissions per frame")
dev.destroy()
