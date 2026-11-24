# Desenha a envoltória do pulo (trajetórias medidas na simulação real + tabela vão × desnível) em PNG pequeno.
# Uso: python3 desenhar_envoltoria.py envoltoria.json saida.png
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1]))
W, H = 1100, 520
im = Image.new('RGB', (W, H), (250, 248, 243)); g = ImageDraw.Draw(im)
try: fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14); fp = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except Exception: fonte = fp = ImageFont.load_default()
# painel 1: trajetórias (escala 60 px/m), origem em (40, 440)
ox, oy, k = 40, 440, 60
for x in range(0, 9):
    g.line([(ox + x * k, 60), (ox + x * k, oy)], fill=(225, 222, 215)); g.text((ox + x * k - 4, oy + 6), f'{x}', fill=(90, 90, 90), font=fp)
for y in range(0, 7):
    g.line([(ox, oy - y * k), (ox + 8 * k, oy - y * k)], fill=(225, 222, 215)); g.text((ox - 18, oy - y * k - 7), f'{y}', fill=(90, 90, 90), font=fp)
cores = [(200, 70, 60), (230, 150, 40), (120, 120, 120), (60, 110, 200)]
for (nome, tr), c in zip(d['trajetorias'].items(), cores):
    pts = [(ox + x * k, oy - y * k) for x, y in tr]
    g.line(pts, fill=c, width=3)
    for p in pts[::6]: g.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], fill=c)
for i, ((nome, tr), c) in enumerate(zip(d['trajetorias'].items(), cores)):
    hm = max(y for _, y in tr); dx = tr[-1][0]
    g.rectangle([ox + 10, 70 + i * 20, ox + 24, 82 + i * 20], fill=c)
    g.text((ox + 30, 68 + i * 20), f'{nome}: {hm:.2f} m de altura, {dx:.2f} m', fill=(30, 30, 30), font=fp)
g.text((ox, 20), 'Trajetórias medidas (pés; m; passo fixo 60 Hz)', fill=(20, 20, 20), font=fonte)
# painel 2: tabela vão × desnível
tx, ty = 600, 60
deg = d['degrau']; gaps = deg['gaps']
g.text((tx, 20), 'Vence o degrau? (corrida, pula na quina) ● normal  ○ só superpulo', fill=(20, 20, 20), font=fonte)
linhas = list(reversed(range(len(deg['normal']))))
cw, ch = 36, 19
for j, gp in enumerate(gaps): g.text((tx + 50 + j * cw, ty + len(linhas) * ch + 4), f'{gp:g}', fill=(90, 90, 90), font=fp)
g.text((tx + 160, ty + len(linhas) * ch + 22), 'vão horizontal (m)', fill=(90, 90, 90), font=fp)
for r, i in enumerate(linhas):
    n, s = deg['normal'][i], deg['super'][i]
    g.text((tx, ty + r * ch), f"{n['dh']:+.2f}", fill=(90, 90, 90), font=fp)
    for j in range(len(gaps)):
        cx, cy = tx + 56 + j * cw, ty + r * ch + 7
        if n['ok'][j]: g.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(200, 70, 60))
        elif s['ok'][j]: g.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=(60, 110, 200), width=2)
        else: g.text((cx - 2, cy - 8), '·', fill=(170, 170, 170), font=fp)
g.text((tx, ty + len(linhas) * ch + 40), 'desnível (m) à esquerda · coluna 0 = parede colada (o teste não pula nela)', fill=(110, 110, 110), font=fp)
im.save(sys.argv[2], optimize=True)
