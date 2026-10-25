#!/usr/bin/env python3
import sys, os, gzip, json, struct, plistlib, io
from plistlib import UID

class Scene:

    def __init__(s, raw):
        d = plistlib.loads(raw)
        s.objs = d['$objects']
        s.root = d['$top']['root'].data

    def cname(s, o):
        return s.objs[o['$class'].data]['$classname']

    def get(s, idx, seen=()):
        if idx in seen:
            return {'_ref': idx}
        return s.val(s.objs[idx], seen + (idx,))

    def val(s, o, seen):
        if isinstance(o, UID):
            return s.get(o.data, seen)
        if isinstance(o, dict):
            if '$class' in o:
                c = s.cname(o)
                if 'NS.keys' in o:
                    return {'_c': c, 'd': {str(s.val(k, seen)): s.val(v, seen) for k, v in zip(o['NS.keys'], o['NS.objects'])}}
                if 'NS.objects' in o:
                    return {'_c': c, 'a': [s.val(v, seen) for v in o['NS.objects']]}
                out = {'_c': c}
                for k, v in o.items():
                    if k != '$class':
                        out[k] = s.val(v, seen)
                return out
            return {k: s.val(v, seen) for k, v in o.items()}
        if isinstance(o, list):
            return [s.val(v, seen) for v in o]
        return o

def aslist(x):
    return x['a'] if isinstance(x, dict) and 'a' in x else x or []

def decode_source(s):
    data = bytes(s['data'])
    stride = s['dataStride']
    off = s['dataOffset']
    n = s['vectorCount']
    c = s['componentsPerVector']
    assert s['floatComponents'] and s['bytesPerComponent'] == 4
    out = []
    for i in range(n):
        out.extend(struct.unpack_from('<%df' % c, data, off + i * stride))
    return (n, c, out)

def triangulate(prim_type, idx, prim_count):
    if prim_type == 0:
        return list(idx)
    if prim_type == 4:
        counts, rest = (idx[:prim_count], idx[prim_count:])
        assert sum(counts) == len(rest), (sum(counts), len(rest))
        tris, p = ([], 0)
        for n in counts:
            poly = rest[p:p + n]
            p += n
            for k in range(1, n - 1):
                tris += [poly[0], poly[k], poly[k + 1]]
        return tris
    return None

def col(c):
    if not isinstance(c, dict):
        return None
    for k in ('NSRGB', 'NSComponents'):
        if k in c:
            v = c[k]
            t = v.decode('latin1', 'ignore').strip('\x00').split() if isinstance(v, (bytes, bytearray)) else str(v).split()
            try:
                f = [float(x) for x in t]
            except ValueError:
                return None
            return (f + [1.0])[:4] if len(f) == 3 else f[:4]
    if 'NSWhite' in c:
        v = c['NSWhite']
        t = v.decode('latin1', 'ignore').strip('\x00').split()
        try:
            w = float(t[0])
            return [w, w, w, float(t[1]) if len(t) > 1 else 1.0]
        except Exception:
            return None
    return None

def main(src, name, out):
    raw = open(src, 'rb').read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    S = Scene(raw)
    root = S.get(S.root)
    meshes, blob = ([], bytearray())

    def align():
        while len(blob) % 4:
            blob.append(0)

    def walk(n, chain):
        if not isinstance(n, dict) or n.get('_c') != 'SCNNode':
            return

        def v(k, c):
            b = n.get(k)
            return [round(x, 6) for x in struct.unpack('<%df' % c, bytes(b))] if isinstance(b, (bytes, bytearray)) and len(b) == 4 * c else None
        xf = {'name': n.get('name'), 'position': v('position', 3), 'scale': v('scale', 3), 'orientation': v('orientation', 4), 'hidden': bool(n.get('hidden'))}
        chain = chain + [xf]
        g = n.get('geometry')
        if isinstance(g, dict) and g.get('_c') == 'SCNGeometry':

            def src_of(sem):
                s = g.get('kGeometrySourceSemantic' + sem)
                if isinstance(s, dict) and 'a' in s:
                    s = s['a'][0] if s['a'] else None
                return decode_source(s) if isinstance(s, dict) and 'data' in s else None
            pos, nor, uv = (src_of('Vertex'), src_of('Normal'), src_of('Texcoord'))
            tris = []
            for e in aslist(g.get('elements')):
                data = bytes(e['elementData'])
                bpi = e['bytesPerIndex']
                idx = struct.unpack('<%d%s' % (len(data) // bpi, {1: 'B', 2: 'H', 4: 'I'}[bpi]), data)
                t = triangulate(e['primitiveType'], idx, e['primitiveCount'])
                if t:
                    tris += t
            nv = pos[0]
            m = aslist(g['materials'])[0]

            def prop(k):
                p = m.get(k)
                if not isinstance(p, dict):
                    return None
                img = p.get('image')
                img = img['d'].get('path') if isinstance(img, dict) and 'd' in img else None
                return {'intensity': p.get('intensity'), 'image': img}
            align()
            o_pos = len(blob)
            blob.extend(struct.pack('<%df' % (nv * 3), *pos[2]))
            align()
            o_nor = len(blob)
            blob.extend(struct.pack('<%dh' % (nv * 3), *[max(-32767, min(32767, round(x * 32767))) for x in nor[2]]))
            align()
            o_uv = len(blob)
            blob.extend(struct.pack('<%df' % (nv * 2), *uv[2]))
            identity = tris == list(range(len(tris)))
            o_idx, icount, itype = (0, 0, None)
            if not identity:
                align()
                o_idx = len(blob)
                icount = len(tris)
                itype = 'u16' if nv < 65536 else 'u32'
                blob.extend(struct.pack('<%d%s' % (icount, 'H' if itype == 'u16' else 'I'), *tris))
            meshes.append({'name': xf['name'], 'path': [c['name'] for c in chain], 'chain': chain, 'vertexCount': nv, 'triangleCount': len(tris) // 3, 'offsets': {'position': o_pos, 'normal': o_nor, 'uv': o_uv, 'index': o_idx}, 'indexCount': icount, 'indexType': itype, 'material': {'name': m.get('name'), **{k: prop(k) for k in ('diffuse', 'emission', 'roughness', 'metalness', 'clearCoat', 'selfIllumination', 'multiply')}}})
        for c in aslist(n.get('childNodes')):
            walk(c, chain)
    walk(root['rootNode'], [])
    lights, camera, emitters = ([], None, [])
    for n in aslist(root['rootNode']['childNodes']):

        def v(k, c):
            b = n.get(k)
            return [round(x, 6) for x in struct.unpack('<%df' % c, bytes(b))] if isinstance(b, (bytes, bytearray)) and len(b) == 4 * c else None
        if isinstance(n.get('light'), dict):
            l = n['light']
            lights.append({'node': n['name'], 'type': l['type'], 'intensity': l['intensity'], 'position': v('position', 3), 'orientation': v('orientation', 4), 'attenuationEnd': l.get('attenuationEndDistance'), 'temperature': l.get('temperature')})
        if isinstance(n.get('camera'), dict):
            c = n['camera']
            camera = {'position': v('position', 3), 'yFov': c['yFov'], 'zNear': c['zNear'], 'zFar': c['zFar']}
        ps = n.get('particleSystem')
        if isinstance(ps, dict) and 'a' in ps:
            ps = ps['a'][0] if ps['a'] else None
        if isinstance(ps, dict) and ps.get('_c') == 'SCNParticleSystem':

            def fv(k, c):
                b = ps.get(k)
                return [round(x, 6) for x in struct.unpack('<%df' % c, bytes(b))] if isinstance(b, (bytes, bytearray)) and len(b) == 4 * c else None
            emitters.append({'node': n['name'], 'position': v('position', 3), 'orientation': v('orientation', 4), 'birthRate': ps['birthRate'], 'lifeSpan': ps['particleLifeSpan'], 'lifeSpanVariation': ps['particleLifeSpanVariation'], 'velocity': ps['particleVelocity'], 'size': ps['particleSize'], 'sizeVariation': ps['particleSizeVariation'], 'intensity': ps['particleIntensity'], 'intensityVariation': ps['particleIntensityVariation'], 'spreadingAngle': ps['spreadingAngle'], 'direction': fv('emittingDirection', 3), 'colorVariation': fv('particleColorVariation', 4), 'shapeWidth': (ps.get('emitterShape') or {}).get('width'), 'shapeHeight': (ps.get('emitterShape') or {}).get('height'), 'speedFactor': ps['speedFactor'], 'color': col(ps.get('particleColor')), 'imageSequenceRowCount': ps.get('imageSequenceRowCount'), 'gravity': bool(ps['affectedByGravity']), 'warmup': ps['warmupDuration'], 'blendMode': ps['blendMode']})
    os.makedirs(out, exist_ok=True)
    g = root.get('physicsWorld', {}).get('gravity') if isinstance(root.get('physicsWorld'), dict) else None
    gravity = [round(x, 4) for x in struct.unpack('<3f', bytes(g))] if isinstance(g, (bytes, bytearray)) and len(g) == 12 else None
    manifest = {'name': name, 'gravity': gravity, 'meshes': meshes, 'lights': lights, 'camera': camera, 'emitters': emitters, 'byteLength': len(blob)}
    json.dump(manifest, open(os.path.join(out, name + '.json'), 'w'), indent=1)
    open(os.path.join(out, name + '.bin'), 'wb').write(bytes(blob))
    print(name, 'meshes:', [(m['name'], m['vertexCount'], m['triangleCount']) for m in meshes], 'bin bytes:', len(blob))
if __name__ == '__main__':
    main(*sys.argv[1:4])
