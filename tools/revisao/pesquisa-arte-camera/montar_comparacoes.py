# Monta pares antes/depois (um em cima do outro, com rótulo) em WebP pequenos. Uso: python3 -I montar_comparacoes.py <entrada> <saida>
import sys, os
from PIL import Image, ImageDraw
ent, sai = sys.argv[1], sys.argv[2]; os.makedirs(sai, exist_ok=True)
def rot(im, t):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 + 7 * len(t), 18], fill=(0, 0, 0)); d.text((4, 3), t, fill=(255, 255, 255)); return im
def par(a, b, ra, rb, nome):
    A, B = Image.open(os.path.join(ent, a)).convert('RGB'), Image.open(os.path.join(ent, b)).convert('RGB')
    o = Image.new('RGB', (A.width, A.height + B.height + 4), (20, 20, 20)); o.paste(rot(A, ra), (0, 0)); o.paste(rot(B, rb), (0, A.height + 4))
    o.save(os.path.join(sai, nome + '.webp'), quality=80)
cam = 'depois_v_2_olho_1.7_alt_0.23'
for ap in ['iphone14', 'redmi11']:
    for c in ['c2_inicio', 'c2_clareira', 'c2_sep8', 'c2_sep20', 'c1_meio', 'c5_doces']:
        a, b = f'antes_media_{ap}_{c}.png', f'{cam}_media_{ap}_{c}.png'
        if os.path.exists(os.path.join(ent, a)) and os.path.exists(os.path.join(ent, b)):
            par(a, b, f'ANTES (camera atual) {ap} {c}', f'DEPOIS (camera proposta) {ap} {c}', f'cam_{ap}_{c}')
for c in ['c2_clareira', 'c1_meio', 'c5_doces']:
    a = f'antes_alta_iphone14_{c}.png'; b = f'antes_bloom_0_luz_0_nevoa_0_alta_iphone14_{c}.png'
    if os.path.exists(os.path.join(ent, a)) and os.path.exists(os.path.join(ent, b)):
        par(a, b, f'ALTA atual {c}', f'ALTA sem bloom, sem raios/halos aditivos, sem nevoa em quadros {c}', f'alta_{c}')
