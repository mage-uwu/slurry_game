"""Native GPU validation and thermal dispatch: pip install wgpu numpy."""
from pathlib import Path
import subprocess,json,numpy as np,wgpu
page=Path(__file__).resolve().parents[1]/'slurry/index.html'
js="""const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(process.argv[1],'utf8').split('<script>')[1].split('</script>')[0],c={};vm.createContext(c);vm.runInContext(s.slice(0,s.indexOf('const TOOLS'))+';this.result={thermal:SH_MERCURY_THERMAL,density:SH_DENSITY,tiled:SH_DENSITY_T,relax:SH_RELAX,relaxT:SH_RELAX_T,final:SH_FINAL,lights:SH_MACHINES,player:SH_PLAYER,dots:SH_DOTS,glow:SH_FIRE,parameters:makeParams()};',c);console.log(JSON.stringify(c.result));"""
code=json.loads(subprocess.check_output(['node','-e',js,str(page)],text=True))
dev=wgpu.gpu.request_adapter_sync(power_preference='low-power').request_device_sync();U=wgpu.BufferUsage
for key,shader in code.items():
 if key!='parameters':dev.create_shader_module(code=shader)
print('PASS native compilation: thermal, both density/relax kernels, final, lamps, player and vapor renderer')
def buf(a,uniform=False):return dev.create_buffer_with_data(data=a,usage=(U.UNIFORM if uniform else U.STORAGE)|U.COPY_DST|U.COPY_SRC)
n=5;W=40;H=40
uf=np.zeros(400,np.float32);uu=uf.view(np.uint32);uu[:8]=[W,H,W*H,n,W*2,H*2,1,1]
pos=np.array([[10,10,10,10],[10.2,10,10.2,10],[20,10,20,10],[20.2,10,20.2,10],[30,10,30,10]],np.float32)
# Sorted by cell: hot/cold mercury pair, boiling mercury beside lava, isolated vapor.
def attr(t,e):return np.uint32(t|(round(e*8)<<16))
attrs=np.array([attr(10,40),attr(10,0),attr(10,342.125),7,attr(21,47.125)],np.uint32)
counts=np.zeros(W*H+1,np.uint32)
for p in pos:counts[int(p[1])*W+int(p[0])]+=1
starts=np.zeros(W*H+2,np.uint32);starts[1:]=np.cumsum(counts)
u=buf(uf,True);st=buf(pos);a=buf(attrs);cs=buf(starts);out=buf(np.zeros(n,np.uint32))
pipe=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=code['thermal']),'entry_point':'main'})
bg=dev.create_bind_group(layout=pipe.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate([u,st,a,cs,out])])
for k in range(600):
 uu[7]=k;uf[99]=k;dev.queue.write_buffer(u,0,uf)
 enc=dev.create_command_encoder();p=enc.begin_compute_pass();p.set_pipeline(pipe);p.set_bind_group(0,bg);p.dispatch_workgroups(1);p.end();enc.copy_buffer_to_buffer(out,0,a,0,n*4);dev.queue.submit([enc.finish()])
result=np.frombuffer(dev.queue.read_buffer(a),np.uint32);energy=((result>>16)&4095)*.125
assert 0<energy[1]<energy[0]<40,energy
assert result[2]&31==21,result
assert result[3]==7,result
assert result[4]&31==10,result
assert energy[0]+energy[1]<45,energy
# Native density consumes the new vapor source before the gas early-out, including tiled fallback.
# Shader compilation above validates both paths; the normal path is dispatched here.
uf[16]=.45;uf[8:10]=0;uf[13]=.012;uf[14]=.05;uf[15]=.62;uf[22]=.5;uf[25]=1;uf[84]=100
for t in range(22):
 P=code['parameters'];uf[100+t*4:104+t*4]=[6 if t in [10,21] else 1,P['sigma'][t],P['xsph'][t],P['wallFric'][t]]
 nt=len(P['sigma']);uf[100+nt*4+t*4:104+nt*4+t*4]=[P['grain'][t],P['muSt'][t],P['muKt'][t],P['coh'][t]];uf[100+nt*8+t*4]=P['tens'][t]
attrs[:]=[attr(21,400),1,attr(10,40),14,1];dev.queue.write_buffer(a,0,attrs);dev.queue.write_buffer(u,0,uf)
dens=buf(np.zeros(n*4,np.float32));wake=buf(np.ones(W*H,np.uint32));pid=buf(np.arange(n,dtype=np.uint32));idx=buf(np.zeros((1<<20)+10000,np.uint32))
p=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=code['density']),'entry_point':'main'})
b=dev.create_bind_group(layout=p.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':v}}for i,v in enumerate([u,st,a,cs,dens,wake,pid,idx])])
e=dev.create_command_encoder();c=e.begin_compute_pass();c.set_pipeline(p);c.set_bind_group(0,b);c.dispatch_workgroups(1);c.end();dev.queue.submit([e.finish()]);d=np.frombuffer(dev.queue.read_buffer(dens),np.float32).reshape(-1,4)
assert d[1,2]>0 and d[3,3]>0,d
print('PASS native mercury diffusion, latent boiling, condensation, unchanged neighbors and heat transfer from vapor/liquid')

# Render the actual glow shader offscreen: cold/liquid invisible; hot gas redder,
# then brighter and whiter, in all three display modes. Alpha stays additive.
shader=dev.create_shader_module(code=code['glow'])
pipe=dev.create_render_pipeline(layout='auto',vertex={'module':shader,'entry_point':'vs'},fragment={'module':shader,'entry_point':'fs','targets':[{'format':'rgba16float'}]},primitive={'topology':'triangle-list'})
rf=np.zeros(16,np.float32);rf[:2]=[10,10];rf[11]=1.1
ru=buf(rf,True);rs=buf(np.array([[5,5,5,5]],np.float32));ra=buf(np.array([10],np.uint32))
bg=dev.create_bind_group(layout=pipe.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate([ru,rs,ra])])
tex=dev.create_texture(size=(32,32,1),format='rgba16float',usage=wgpu.TextureUsage.RENDER_ATTACHMENT|wgpu.TextureUsage.COPY_SRC)
def render(material,energy,mode):
 rf.view(np.uint32)[4]=mode;dev.queue.write_buffer(ru,0,rf);dev.queue.write_buffer(ra,0,np.array([attr(material,energy)],np.uint32))
 enc=dev.create_command_encoder();p=enc.begin_render_pass(color_attachments=[{'view':tex.create_view(),'resolve_target':None,'clear_value':(0,0,0,0),'load_op':'clear','store_op':'store'}]);p.set_pipeline(pipe);p.set_bind_group(0,bg);p.draw(6,1);p.end();dev.queue.submit([enc.finish()])
 pixels=np.frombuffer(dev.queue.read_texture({'texture':tex},{'bytes_per_row':256,'rows_per_image':32},(32,32,1)),np.float16).astype(np.float32).reshape(32,32,4)
 return pixels.sum(axis=(0,1))
for mode in range(3):
 assert not render(10,40,mode).any()
 assert not render(21,342.125,mode).any()
 red=render(21,342.138+(700-356.7)*.104,mode);white=render(21,510,mode)
 assert red[0]>red[1]*5>red[2]>0 and red[3]==0,red
 assert white[0]>red[0] and white[1]/white[0]>red[1]/red[0] and white[3]==0,(red,white)
print('PASS offscreen mercury glow: no cold/boiling glow, hot red to warm white, all views, additive alpha')
# The shared thermal pass also melts and solidifies steel, preserving other materials.
steel_attrs=np.array([22|(1479<<16),18,23|(1430<<16),1,1],np.uint32)
dev.queue.write_buffer(a,0,steel_attrs)
tp=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=code['thermal']),'entry_point':'main'})
tbg=dev.create_bind_group(layout=tp.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}}for i,b in enumerate([u,st,a,cs,out])])
for k in range(64):
 uu[7]=k;uf[99]=k;dev.queue.write_buffer(u,0,uf)
 enc=dev.create_command_encoder();p=enc.begin_compute_pass();p.set_pipeline(tp);p.set_bind_group(0,tbg);p.dispatch_workgroups(1);p.end();enc.copy_buffer_to_buffer(out,0,a,0,n*4);dev.queue.submit([enc.finish()])
steel_result=np.frombuffer(dev.queue.read_buffer(a),np.uint32)
assert steel_result[0]&31==23 and steel_result[2]&31==22,steel_result
assert steel_result[1]==18 and steel_result[3]==1 and steel_result[4]==1,steel_result
print('PASS native steel melting and cooling back into solid steel')
