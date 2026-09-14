"""Native WGSL regression for parallel ??? statistics, including the full 128k capacity.
Run with Python, NumPy, wgpu, and Node.js installed. Uses the game's actual shaders.
"""
import json
import math
from pathlib import Path
import subprocess
import numpy as np
import wgpu

page = Path(__file__).resolve().parents[1] / 'index.html'
extract = r"""
const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8').split('<script>')[1].split('</script>')[0];
console.log(JSON.stringify(new Function(s.slice(0,s.indexOf('const TOOLS'))+';return {list:SH_RARE_LIST,body:SH_UNKNOWN_BODY,base:UNKNOWN_STATS,words:RARE_HEAD_WORDS};')()));
"""
code = json.loads(subprocess.check_output(['node', '-e', extract, str(page)], text=True))
device = wgpu.gpu.request_adapter_sync(power_preference='low-power').request_device_sync()
U = wgpu.BufferUsage

def buffer(size, data=None, uniform=False):
    usage = U.COPY_SRC | U.COPY_DST | (U.UNIFORM if uniform else U.STORAGE | U.INDIRECT)
    b = device.create_buffer(size=size, usage=usage)
    if data is not None:
        device.queue.write_buffer(b, 0, data)
    return b

pipes = {k: device.create_compute_pipeline(layout='auto', compute={
    'module': device.create_shader_module(code=code[k]), 'entry_point': 'main'}) for k in ['list', 'body']}

for n, mixed, sign in [(257, True, -1), (131072, False, 1), (131072, False, -1)]:
    uniform = np.zeros(400, np.float32)
    uniform.view(np.uint32)[:8] = [160, 100, 16000, n, 320, 200, 0, 1]
    points = np.zeros((n, 4), np.float32)
    points[:, 2] = 159.5 + np.arange(n) % 5 * .04
    points[:, 3] = 99.5 + np.arange(n) % 3 * .04
    points[:, :2] = points[:, 2:] + [sign * .29, sign * .30]
    attrs = np.full(n, 0xfffaff10, np.uint32)
    if mixed:
        attrs[::3] = 1
    ids = np.arange(1, n + 1, dtype=np.uint32)
    uni = buffer(1600, uniform, True)
    st = buffer(points.nbytes, points)
    at = buffer(attrs.nbytes, attrs)
    pid = buffer(ids.nbytes, ids)
    meta = buffer(1048576 * 32)
    heads = buffer(code['words'] * 4)
    next_ids = buffer(n * 4)
    snap = buffer(n * 32)
    emits = buffer(4112)
    walls = buffer(320 * 200 * 4)
    groups = {}
    for name, buffers in [('list', [uni, st, at, pid, meta, heads, next_ids, snap, emits]),
                          ('body', [uni, st, snap, heads, walls])]:
        groups[name] = device.create_bind_group(layout=pipes[name].get_bind_group_layout(0), entries=[
            {'binding': i, 'resource': {'buffer': b}} for i, b in enumerate(buffers)])
    enc = device.create_command_encoder()
    p = enc.begin_compute_pass()
    p.set_pipeline(pipes['list']); p.set_bind_group(0, groups['list']); p.dispatch_workgroups(math.ceil(n / 256))
    p.set_pipeline(pipes['body']); p.set_bind_group(0, groups['body']); p.dispatch_workgroups_indirect(heads, (code['base'] + 5) * 4)
    p.end(); device.queue.submit([enc.finish()])
    out = np.frombuffer(device.queue.read_buffer(st), np.float32).reshape(n, 4)
    words = np.frombuffer(device.queue.read_buffer(heads), np.uint32)
    unknown = attrs != 1
    count = int(unknown.sum())
    stats = words[code['base']:code['base'] + 8]
    assert words[65536] == 0, '??? must never enter the serial rare-body list'
    assert stats[0] == count
    assert np.array_equal(stats[5:], [math.ceil(n / 256), 1, 1])
    centre = stats[1:3].astype(np.float64) / (128 * count)
    velocity = stats[3:5].view(np.int32).astype(np.float64) / (32768 * count)
    assert np.allclose(centre, points[unknown, 2:].mean(axis=0, dtype=np.float64), atol=.0001)
    assert np.allclose(velocity, (points[unknown, :2] - points[unknown, 2:]).mean(axis=0, dtype=np.float64), atol=.0001)
    assert np.isfinite(out).all()
    assert np.allclose(out[unknown, :2] - out[unknown, 2:], velocity, atol=.0001)
    assert np.array_equal(out[~unknown], points[~unknown]), 'ordinary matter must stay untouched'
    # Clear/erase removes the indirect job, so empty worlds run no ??? body work.
    device.queue.write_buffer(at, 0, np.ones(n, np.uint32))
    enc = device.create_command_encoder(); enc.clear_buffer(heads); enc.clear_buffer(emits)
    p = enc.begin_compute_pass(); p.set_pipeline(pipes['list']); p.set_bind_group(0, groups['list']); p.dispatch_workgroups(math.ceil(n / 256)); p.end()
    device.queue.submit([enc.finish()])
    after = np.frombuffer(device.queue.read_buffer(heads), np.uint32)
    assert not after[code['base']:code['base'] + 8].any()
    print(f'PASS native GPU reduction: n={n}, mixed={mixed}, velocity sign={sign}, no serial body work', flush=True)
    for b in [uni, st, at, pid, meta, heads, next_ids, snap, emits, walls]:
        b.destroy()
device.destroy()
