#!/usr/bin/env python3
"""Otimiza um GLB para o jogo web (REF02): reduz as texturas embutidas (JPEG, lado máximo N px),
conta triângulos/vértices e mede o tamanho do objeto (para escalar a medidas reais).

Uso: python3 -I glb_optimize.py entrada.glb saida.glb [--max 512] [--max-aux N] [--quality 80]
  --max-aux: lado máximo dos mapas que não são de cor (relevo, metal/rugosidade, oclusão); padrão = --max
"""
import argparse
import io
import json
import struct
import sys

from PIL import Image

COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2, 'não é GLB 2.0'
    off = 12
    gltf, binary = None, b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:
            binary = chunk
        off += 8 + clen
    return gltf, binary


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    binary += b'\x00' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binary), 0x004E4942) + binary)


def stats(gltf, binary):
    tris = verts = 0
    lo, hi = [1e9] * 3, [-1e9] * 3
    for mesh in gltf.get('meshes', []):
        for prim in mesh['primitives']:
            pos = gltf['accessors'][prim['attributes']['POSITION']]
            verts += pos['count']
            if 'min' in pos:
                lo = [min(a, b) for a, b in zip(lo, pos['min'])]
                hi = [max(a, b) for a, b in zip(hi, pos['max'])]
            if 'indices' in prim:
                tris += gltf['accessors'][prim['indices']]['count'] // 3
            else:
                tris += pos['count'] // 3
    return {'triangulos': tris, 'vertices': verts, 'min': lo, 'max': hi,
            'tamanho': [round(h - l, 3) for l, h in zip(lo, hi)]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--max', type=int, default=512)
    ap.add_argument('--max-aux', type=int, default=None)
    ap.add_argument('--quality', type=int, default=80)
    a = ap.parse_args()

    gltf, binary = read_glb(a.src)
    before = len(open(a.src, 'rb').read())
    views = gltf['bufferViews']
    replaced = {}
    report_imgs = []
    # Imagens usadas como cor (baseColor/emissive) ficam com --max; as demais (relevo, metal/rugosidade, oclusão) com --max-aux.
    color_imgs = set()
    for m in gltf.get('materials', []):
        for ref in (m.get('pbrMetallicRoughness', {}).get('baseColorTexture'), m.get('emissiveTexture')):
            if ref is not None:
                color_imgs.add(gltf['textures'][ref['index']].get('source'))
    for idx, img in enumerate(gltf.get('images', [])):
        if 'bufferView' not in img:
            continue
        limit = a.max if (a.max_aux is None or idx in color_imgs) else a.max_aux
        bv = views[img['bufferView']]
        raw = binary[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        im = Image.open(io.BytesIO(raw))
        orig = im.size
        has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        im.thumbnail((limit, limit), Image.LANCZOS)
        out = io.BytesIO()
        if has_alpha:
            im.save(out, 'PNG', optimize=True)
            img['mimeType'] = 'image/png'
        else:
            im.convert('RGB').save(out, 'JPEG', quality=a.quality, optimize=True)
            img['mimeType'] = 'image/jpeg'
        replaced[img['bufferView']] = out.getvalue()
        report_imgs.append({'de': orig, 'para': im.size, 'bytes': [len(raw), len(out.getvalue())]})

    # Reconstrói o buffer binário mantendo a ordem dos bufferViews (alinhamento de 4 bytes).
    new = bytearray()
    for i, bv in enumerate(views):
        chunk = replaced.get(i)
        if chunk is None:
            s = bv.get('byteOffset', 0)
            chunk = binary[s: s + bv['byteLength']]
        while len(new) % 4:
            new.append(0)
        bv['byteOffset'] = len(new)
        bv['byteLength'] = len(chunk)
        new += chunk
    gltf['buffers'] = [{'byteLength': len(new)}]
    write_glb(a.dst, gltf, bytes(new))
    after = len(open(a.dst, 'rb').read())
    print(json.dumps({'arquivo': a.dst, 'bytes_antes': before, 'bytes_depois': after,
                      'imagens': report_imgs, **stats(gltf, bytes(new))}, ensure_ascii=False))


if __name__ == '__main__':
    sys.exit(main())
