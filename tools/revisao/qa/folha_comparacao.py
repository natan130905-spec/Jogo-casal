# Folha antes | depois | alvo, um capítulo por linha, a partir de duas rodadas de tools/revisao/capturas.mjs.
# Uso: python3 tools/revisao/qa/folha_comparacao.py <pasta-antes> <pasta-depois> <saida.webp> [--q media] [--tam 844x390@3] [--ponto 012]
#      [--largura 520]
# O alvo (docs/revisao/img/arte-diagnostico/alvo_capN.webp) é recortado no centro para a proporção da captura.
import sys, os
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
def opt(n, pad):
    return args[args.index('--' + n) + 1] if '--' + n in args else pad
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or not args[i - 1].startswith('--'))]
antes, depois, saida = pos[:3]
q, tam, ponto, larg = opt('q', 'media'), opt('tam', '844x390@3'), opt('ponto', '012'), int(opt('largura', '520'))
raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
try:
    fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    fonte = ImageFont.load_default()

def caber(im, w, h):
    r = w / h; iw, ih = im.size
    if iw / ih > r:
        nw = int(ih * r); im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / r); im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    return im.resize((w, h), Image.LANCZOS)

linhas = []
for n in range(1, 8):
    nome = f'cap{n}_{q}_{tam}_p{ponto}.png'
    a, d = os.path.join(antes, nome), os.path.join(depois, nome)
    if not (os.path.exists(a) and os.path.exists(d)):
        continue
    linhas.append((n, a, d, os.path.join(raiz, f'docs/revisao/img/arte-diagnostico/alvo_cap{n}.webp')))
ex = Image.open(linhas[0][1]); alt = round(larg * ex.size[1] / ex.size[0])
folha = Image.new('RGB', (3 * larg + 8, len(linhas) * (alt + 4)), (17, 17, 17))
g = ImageDraw.Draw(folha)
for i, (n, a, d, alvo) in enumerate(linhas):
    for j, (arq, rot) in enumerate([(a, 'antes f362fe6'), (d, 'depois'), (alvo, 'alvo')]):
        if not os.path.exists(arq):
            continue
        im = caber(Image.open(arq).convert('RGB'), larg, alt)
        x, y = j * (larg + 4), i * (alt + 4)
        folha.paste(im, (x, y))
        t = f'cap {n} · {rot}' + (f' · {q}' if j < 2 else '')
        w = g.textlength(t, font=fonte)
        g.rectangle((x, y, x + w + 10, y + 20), fill=(0, 0, 0))
        g.text((x + 5, y + 2), t, fill=(255, 255, 255), font=fonte)
folha.save(saida, 'WEBP', quality=82)
print(saida, folha.size)
