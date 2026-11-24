// A estrelinha aparece na tela quando a dupla está embaixo dela? Reproduz a câmera de src/render/cena.ts
// (perspectiva 42°, dist = clamp(6 + sep·0,9, 7,6, 22), alvo y = meio + 2 + dist·0,06, olha 0,9 + dist·0,04 abaixo)
// com os dois juntos (sep = 0) em pé no chão mais alto logo abaixo da estrelinha, e diz quantos metros ela fica
// acima da borda de cima da tela. Uso: rodar.sh visibilidade
import { CAPITULOS } from '../../../src/core/fases';
import { montarGrafo } from '../../../test/fases/alcance';

const FOV = 42;
function faixa(meioY: number, sep = 0) {
  const dist = Math.min(22, Math.max(7.6, 6 + sep * 0.9));
  const camY = meioY + 2 + dist * 0.06;
  const olhaY = camY - 0.9 - dist * 0.04;
  const ang = Math.atan2(camY - olhaY, dist); // inclinação para baixo
  const meia = (FOV / 2) * (Math.PI / 180);
  // no plano z=0: topo e base vistos
  const topo = camY - Math.tan(ang - meia) * dist;
  const base = camY - Math.tan(ang + meia) * dist;
  return { topo, base, dist };
}

if (process.argv[2] === 'visibilidade') {
  const f0 = faixa(0);
  console.log(`dois juntos no chão y=0: a tela mostra de y=${f0.base.toFixed(2)} a y=${f0.topo.toFixed(2)} (dist ${f0.dist})`);
  for (const sep of [6, 12, 18, 24]) { const f = faixa(0, sep); console.log(`  separados ${sep} m: ${f.base.toFixed(2)}…${f.topo.toFixed(2)}, dist ${f.dist}`); }
  for (const f of CAPITULOS) {
    const g = montarGrafo(f);
    const fora: string[] = [];
    (f.estrelinhas ?? []).forEach((p, k) => {
      let chao = -Infinity;
      for (const n of g.nos) if (n.tipo === 'fixo' && p.x >= n.x0 - 0.3 && p.x <= n.x1 + 0.3 && n.y <= p.y - 0.2 && n.y > chao) chao = n.y;
      if (!Number.isFinite(chao)) return;
      const v = faixa(chao + 0.55);
      const acima = p.y - v.topo;
      if (acima > -0.3) fora.push(`#${k} (${p.x}, ${p.y}) chão ${chao.toFixed(1)} → ${acima >= 0 ? `${acima.toFixed(2)} m ACIMA da tela` : `colada na borda (${(-acima).toFixed(2)} m)`}`);
    });
    console.log(`cap ${f.capitulo}: ${fora.length} estrelinhas fora/na borda do quadro com a dupla embaixo`);
    for (const s of fora) console.log(`   ${s}`);
  }
}
