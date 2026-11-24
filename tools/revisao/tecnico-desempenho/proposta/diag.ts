// PROPOSTA (não ligada ao jogo): painel de diagnóstico para o jogador medir NO CELULAR DE VERDADE, com `?diag=1`.
// Para integrar: src/ui/diag.ts; a Partida (e a PartidaArena) criam `const diag = criarDiag(renderer)` quando
// `?diag=1` está na URL e chamam `diag.quadro(agora, msSim, msDesenho, extras)` uma vez por quadro.
// Mostra (canto superior, toque para expandir/recolher, botão "Copiar" para mandar o relatório no WhatsApp):
//   fps médio e 1 % pior · tempo de quadro p50/p95 · ms de simulação e de desenho (CPU) · chamadas e triângulos ·
//   texturas/geometrias/programas vivos · resolução interna (px) e pixelRatio · qualidade e degrau do governo ·
//   GPU (WEBGL_debug_renderer_info) · memória JS (Chrome) · bateria e carregando (Chrome Android) · Hz da tela
//   estimado · rede: ping, instantâneos/s recebidos, maior buraco entre instantâneos · contexto perdido (sim/não).
// Grava um registro de 1 linha a cada 5 s (até 30 min) para o relatório: assim se vê o AQUECIMENTO (fps caindo aos
// poucos com a mesma cena) — o que nenhuma medida sem GPU daqui consegue ver.
import type * as THREE from 'three';

export interface ExtrasDiag { qualidade?: string; degrau?: string; ping?: number; instantaneos?: number; buracoMs?: number }

export function criarDiag(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  const nav = navigator as Navigator & { deviceMemory?: number; getBattery?: () => Promise<{ level: number; charging: boolean }> };
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:4px;transform:translateX(-50%);z-index:99;font:11px/1.25 monospace;'
    + 'color:#fff;background:#000a;padding:4px 8px;border-radius:6px;white-space:pre;pointer-events:auto;max-width:96vw;overflow:hidden';
  document.body.appendChild(el);
  let aberto = false; el.onclick = () => { aberto = !aberto; };
  const copiar = document.createElement('button'); copiar.textContent = 'Copiar relatório';
  copiar.style.cssText = 'display:block;margin-top:4px;font:11px sans-serif';
  const intervalos: number[] = [], sims: number[] = [], desenhos: number[] = [];
  const registro: string[] = [];
  let ultimo = 0, perdido = false, bateria = '', ultimoReg = 0, inicio = performance.now();
  renderer.domElement.addEventListener('webglcontextlost', () => { perdido = true; });
  nav.getBattery?.().then((b) => { const f = () => { bateria = `${Math.round(b.level * 100)}%${b.charging ? ' ⚡' : ''}`; }; f(); setInterval(f, 30000); }).catch(() => {});
  const pc = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
  const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

  function texto(x: ExtrasDiag) {
    const fps = intervalos.length ? 1000 / (intervalos.reduce((s, v) => s + v, 0) / intervalos.length) : 0;
    const pior1 = 1000 / pc(intervalos, 0.99);
    const i = renderer.info, c = renderer.domElement;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const curto = `${Math.round(fps)} fps (1% ${Math.round(pior1)}) · ${i.render.calls} ch · ${Math.round(i.render.triangles / 1000)} mil tri`;
    if (!aberto) return curto;
    return [
      curto,
      `quadro p50 ${r1(pc(intervalos, 0.5))} ms p95 ${r1(pc(intervalos, 0.95))} ms · CPU sim ${r1(pc(sims, 0.5))} desenho ${r1(pc(desenhos, 0.5))} ms (p95 ${r1(pc(desenhos, 0.95))})`,
      `tela ${innerWidth}×${innerHeight} dpr ${devicePixelRatio} → interno ${c.width}×${c.height} (pr ${r1(renderer.getPixelRatio())})`,
      `qualidade ${x.qualidade ?? '?'} · degrau ${x.degrau ?? '-'} · tex ${i.memory.textures} geo ${i.memory.geometries} prog ${i.programs?.length ?? '?'}`,
      `GPU ${gpu}`,
      `núcleos ${navigator.hardwareConcurrency ?? '?'} · RAM ${nav.deviceMemory ?? '?'} GB · heap JS ${mem ? Math.round(mem.usedJSHeapSize / 2 ** 20) + ' MB' : '?'} · bateria ${bateria || '?'}`,
      `rede: ping ${x.ping !== undefined ? Math.round(x.ping) + ' ms' : '-'} · inst/s ${x.instantaneos ?? '-'} · maior buraco ${x.buracoMs ?? '-'} ms${perdido ? ' · CONTEXTO PERDIDO' : ''}`,
      `tempo de jogo ${Math.round((performance.now() - inicio) / 60000)} min · registros ${registro.length}`,
    ].join('\n');
  }
  copiar.onclick = (e) => {
    e.stopPropagation();
    const r = [`Entre Dois Mundos — diag ${new Date().toISOString()}`, navigator.userAgent, `GPU ${gpu}`, ...registro].join('\n');
    void navigator.clipboard?.writeText(r).then(() => { copiar.textContent = 'Copiado!'; }).catch(() => {});
  };

  return {
    gpu,
    /** chamar a cada quadro desenhado */
    quadro(agora: number, msSim: number, msDesenho: number, x: ExtrasDiag = {}) {
      if (ultimo) { intervalos.push(agora - ultimo); if (intervalos.length > 240) intervalos.shift(); }
      ultimo = agora;
      sims.push(msSim); desenhos.push(msDesenho);
      if (sims.length > 240) { sims.shift(); desenhos.shift(); }
      if (agora - ultimoReg > 5000 && registro.length < 360) {
        ultimoReg = agora;
        const fps = 1000 / pc(intervalos, 0.5);
        registro.push(`${Math.round((agora - inicio) / 1000)}s ${Math.round(fps)}fps p95 ${r1(pc(intervalos, 0.95))}ms des ${r1(pc(desenhos, 0.5))}ms ${renderer.info.render.calls}ch ${renderer.domElement.width}x${renderer.domElement.height} ${x.degrau ?? x.qualidade ?? ''} ${bateria}`);
      }
      if ((intervalos.length & 7) === 0) { el.textContent = texto(x); if (aberto) el.appendChild(copiar); }
    },
    destruir() { el.remove(); },
  };
}
