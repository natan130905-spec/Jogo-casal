# Estatísticas de valor/cor de capturas (pesquisa-arte-camera). Uso: python3 -I estatisticas_imagem.py img[:x0,y0,x1,y1] ...
# Luminância relativa (sRGB → linear → Y, depois volta para L* aproximado), contraste RMS, percentis e saturação.
import sys
import numpy as np
from PIL import Image
def stats(caminho, caixa=None):
    im = Image.open(caminho).convert('RGB')
    if caixa: im = im.crop(caixa)
    a = np.asarray(im).astype(np.float32) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722])
    L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y) / 100  # L* 0..1
    mx, mn = a.max(2), a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    p = np.percentile(L, [5, 50, 95])
    return dict(L_media=L.mean(), L_desvio=L.std(), p5=p[0], p50=p[1], p95=p[2], faixa_p5_p95=p[2] - p[0],
                claros_L_gt_085=(L > 0.85).mean(), escuros_L_lt_025=(L < 0.25).mean(), saturacao_media=S.mean())
for arg in sys.argv[1:]:
    cam, _, cx = arg.partition(':')
    caixa = tuple(int(v) for v in cx.split(',')) if cx else None
    s = stats(cam, caixa)
    print(cam.split('/')[-1] + (f' {caixa}' if caixa else ''), ' '.join(f'{k}={v:.3f}' for k, v in s.items()))
