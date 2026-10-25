#!/usr/bin/env python3
import sys, json, gzip, base64, os
build, outdir, texdir = sys.argv[1:4]
os.makedirs(outdir, exist_ok=True)
for name in ('star', 'coin'):
    m = json.load(open(f'{build}/{name}.json'))
    b = open(f'{build}/{name}.bin', 'rb').read()
    z = base64.b64encode(gzip.compress(b, 9, mtime=0)).decode()
    open(f'{outdir}/{name}.ts', 'w').write(f'import type {{ SceneManifest }} from "../types";\n\nexport const {name.upper()}_MANIFEST: SceneManifest = {json.dumps(m, separators=(',', ':'))};\n\nexport const {name.upper()}_BIN = "{z}";\n')
    print(name, 'raw', len(b), '-> b64', len(z))
tex = {'diagonalShine': 'diagonal_shine.png', 'particle': 'particles.png', 'gradientDefault': 'texture.jpg', 'gradientLighter': 'lighterTexture.jpg', 'gradientDarker': 'darkerTexture.jpg'}
out = ['export const TEXTURES = {']
for k, f in tex.items():
    mime = 'image/png' if f.endswith('.png') else 'image/jpeg'
    out.append(f'  {k}: "data:{mime};base64,{base64.b64encode(open(os.path.join(texdir, f), 'rb').read()).decode()}",')
out.append('} as const;\n')
open(f'{outdir}/textures.ts', 'w').write('\n'.join(out))
print('textures ok')
