"""Optional native WebGPU contact/heat and paused-erasure regression: pip install wgpu numpy."""
from pathlib import Path
import json, subprocess
import numpy as np
import wgpu
page=Path(__file__).resolve().parents[1]/'slurry'/'index.html'
js="""const fs=require('fs'),vm=require('vm');const s=fs.readFileSync(process.argv[1],'utf8').split('<script>')[1].split('</script>')[0],c={};vm.createContext(c);vm.runInContext(s.slice(0,s.indexOf('const TOOLS'))+';this.result={machine:SH_MACHINES,eraser:SH_ERASER};',c);console.log(JSON.stringify(c.result));"""
code=json.loads(subprocess.check_output(['node','-e',js,str(page)],text=True))
dev=wgpu.gpu.request_adapter_sync(power_preference='low-power').request_device_sync()
U=wgpu.BufferUsage
def buf(data,uniform=False):
 return dev.create_buffer_with_data(data=data,usage=(U.UNIFORM if uniform else U.STORAGE)|U.COPY_SRC|U.COPY_DST)
def run(name,resources,n):
 pipe=dev.create_compute_pipeline(layout='auto',compute={'module':dev.create_shader_module(code=code[name]),'entry_point':'main'})
 bg=dev.create_bind_group(layout=pipe.get_bind_group_layout(0),entries=[{'binding':i,'resource':{'buffer':b}} for i,b in enumerate(resources)])
 enc=dev.create_command_encoder();p=enc.begin_compute_pass();p.set_pipeline(pipe);p.set_bind_group(0,bg);p.dispatch_workgroups((n+255)//256);p.end();dev.queue.submit([enc.finish()])
def life(g,v=150):return 16|((g&255)<<8)|(v<<16)|((g>>8)<<24)
attrs=np.array([1,2,5,9,14,13,6,12,3,life(0),life(0x20),life(0xffff),life(0)|32,0],np.uint32);n=len(attrs)
uf=np.zeros(400,np.float32);uu=uf.view(np.uint32);uu[:8]=[40,40,1600,n,80,80,1,1];uf[16]=.45;uf[38]=1;uf[43]=20;uf[46]=1;uf[[59,69,71,72,75,76]]=1
uni=buf(uf,True);grid=np.zeros((40,40),np.uint32);grid[17:24,17:24]=65
lamps=np.zeros((64,4),np.float32);lamps[0]=[20,20,0,1]
positions=np.tile(np.array([20,18.6,20,18.5],np.float32),(n,1))
st=buf(positions);att=buf(attrs);rotor=buf(np.zeros(64*12,np.uint32));mp=buf(grid);walls=buf(np.zeros(80*80,np.uint32));lb=buf(lamps);blast=buf(np.zeros(130,np.uint32))
run('machine',[uni,st,att,rotor,mp,walls,lb,blast],n)
out=np.frombuffer(dev.queue.read_buffer(att),np.uint32);pos=np.frombuffer(dev.queue.read_buffer(st),np.float32).reshape(-1,4)
assert np.array_equal(out&31,attrs&31)
assert pos[0,3]<18.5 and abs(pos[0,1]-pos[0,3])<1e-6
lamps[0,2]=1;dev.queue.write_buffer(lb,0,lamps);dev.queue.write_buffer(st,0,positions);dev.queue.write_buffer(att,0,attrs)
run('machine',[uni,st,att,rotor,mp,walls,lb,blast],n)
out=np.frombuffer(dev.queue.read_buffer(att),np.uint32)
assert list(out&31)==[15,2,4,4,1,1,1,11,3,6,16,16,16,0],list(out&31)
assert out[1]&(1<<30) and out[2]&(1<<28) and out[3]&(1<<28)
assert not(out[12]&32) and (out[11]&~np.uint32(128))==attrs[11]
assert np.frombuffer(dev.queue.read_buffer(blast),np.uint32)[0]==2
# Powered light must not heat particles outside its contact shell.
positions[:]=[20,17.7,20,17.7];dev.queue.write_buffer(st,0,positions);dev.queue.write_buffer(att,0,attrs)
run('machine',[uni,st,att,rotor,mp,walls,lb,blast],n)
assert np.array_equal(np.frombuffer(dev.queue.read_buffer(att),np.uint32),attrs)
# Same physical position can hold a frozen particle; the editor still removes it.
positions[:]=[20,20,20,20];positions[-1]=[30,30,30,30];attrs[-1]=8
dev.queue.write_buffer(st,0,positions);dev.queue.write_buffer(att,0,attrs)
uf[26]=2;uf[28:30]=[20,20];uf[33]=1;dev.queue.write_buffer(uni,0,uf)
run('eraser',[uni,st,att],n)
out=np.frombuffer(dev.queue.read_buffer(att),np.uint32);assert not out[:-1].any() and out[-1]==8
print('PASS native GPU light collision, boiling/melting/combustion, explosives, thermophiles, frozen life, range and paused eraser')
