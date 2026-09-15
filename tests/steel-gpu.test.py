"""Native steel projection/CPU parity check: pip install wgpu numpy."""
from pathlib import Path
import subprocess,json,numpy as np,wgpu
page=Path(__file__).resolve().parents[1]/'slurry/index.html'
js="""const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(process.argv[1],'utf8').split('<script>')[1].split('</script>')[0],c={};vm.createContext(c);vm.runInContext(s.slice(0,s.indexOf('const TOOLS'))+`;
const e=new Engine(40,40,200,makeParams({gy:0,jitter:0}));
for(let y=10;y<13;y+=.5)for(let x=15;x<21;x+=.5)e.add(x,y,22);
e.sort();e.wakePass();e.density();e.bondPass();
const initial=[];for(let i=0;i<e.n;i++){e.nx[i]=e.px[i]+.2*Math.sin(e.py[i]*3);e.ny[i]=e.py[i]+.1*Math.cos(e.px[i]*3);initial.push(e.nx[i],e.ny[i],0,0);}
this.result={iterations:STEEL_ITERS,shaders:{steel:SH_STEEL,bonds:SH_BONDS,relax:SH_RELAX,tiled:SH_RELAX_T,density:SH_DENSITY,densityT:SH_DENSITY_T,count:SH_COUNT,move:SH_BONDMOVE,player:SH_PLAYER,dots:SH_DOTS,pixel:SH_PIX,composite:SH_COMPOSITE},n:e.n,initial,attrs:Array.from(e.attr.slice(0,e.n)),pid:Array.from(e.pid.slice(0,e.n)),bonds:Array.from(e.bonds.slice(0,e.n*8)),idx:Array.from(e.idx.slice(0,200)),starts:Array.from(e.cellStart)};
e.steelProject();result.expected=Array.from({length:e.n},(_,i)=>[e.nx[i],e.ny[i]]);
`,c);console.log(JSON.stringify(c.result));"""
data=json.loads(subprocess.check_output(['node','-e',js,str(page)],text=True))
dev=wgpu.gpu.request_adapter_sync(power_preference='low-power').request_device_sync();U=wgpu.BufferUsage
for shader in data['shaders'].values():dev.create_shader_module(code=shader)
def buf(a,uniform=False):return dev.create_buffer_with_data(data=a,usage=(U.UNIFORM if uniform else U.STORAGE)|U.COPY_SRC|U.COPY_DST)
n=data['n'];uf=np.zeros(400,np.float32);uf.view(np.uint32)[:8]=[40,40,1600,n,80,80,1,1]
u=buf(uf,True);attr=buf(np.array(data['attrs'],np.uint32));pid=buf(np.array(data['pid'],np.uint32));bonds=buf(np.array(data['bonds'],np.uint32));idx=buf(np.array(data['idx'],np.uint32));starts=buf(np.array(data['starts'],np.uint32));walls=buf(np.zeros(6400,np.uint32));x=[buf(np.array(data['initial'],np.float32)),buf(np.zeros(n*4,np.float32))]
pipe=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=data['shaders']['steel']),'entry_point':'main'})
bgs=[dev.create_bind_group(layout=pipe.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate([u,attr,pid,bonds,idx,starts,x[k],x[1-k],walls])])for k in range(2)]
enc=dev.create_command_encoder();p=enc.begin_compute_pass();p.set_pipeline(pipe)
for k in range(data['iterations']):p.set_bind_group(0,bgs[k%2]);p.dispatch_workgroups((n+255)//256)
p.end();dev.queue.submit([enc.finish()]);out=np.frombuffer(dev.queue.read_buffer(x[0]),np.float32).reshape(n,4)
np.testing.assert_allclose(out[:,:2],data['expected'],atol=2e-5,rtol=0)
assert np.isfinite(out).all()
print('PASS steel GPU shader compilation and 128-iteration strained-block projection matching CPU')
# All views rasterize steel onto the same contiguous fluid pixel grid.
rp=np.zeros(16,np.float32);rp[:4]=[40,40,.46,.30];rp[13:16]=[80,80,n]
ru=buf(rp,True);state=np.array(data['initial'],np.float32).reshape(n,4);state[:,2:]=state[:,:2];st=buf(state);owner=buf(np.zeros(6400,np.uint32));coverage=buf(np.zeros(6400,np.uint32))
pp=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=data['shaders']['pixel']),'entry_point':'main'})
bg=dev.create_bind_group(layout=pp.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate([ru,st,attr,owner,coverage])])
baseline=None
for mode in range(3):
 rp.view(np.uint32)[4]=mode;dev.queue.write_buffer(ru,0,rp);enc=dev.create_command_encoder();enc.clear_buffer(owner);enc.clear_buffer(coverage);p=enc.begin_compute_pass();p.set_pipeline(pp);p.set_bind_group(0,bg);p.dispatch_workgroups((n+255)//256);p.end();dev.queue.submit([enc.finish()])
 cov=np.frombuffer(dev.queue.read_buffer(coverage),np.uint32).reshape(80,80);ids=np.frombuffer(dev.queue.read_buffer(owner),np.uint32).reshape(80,80)
 assert (cov[21:24,32:40]>=276).all() and ((ids[21:24,32:40]&31)==22).all()
 if baseline is None:baseline=cov.copy()
 else:np.testing.assert_array_equal(cov,baseline)
print('PASS filled steel pixel coverage, identical in Pixel/Smooth/Dots views')
