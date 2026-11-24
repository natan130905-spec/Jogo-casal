// Painel de diagnóstico para o jogador medir NO CELULAR DE VERDADE: abra o jogo com `?diag=1` (R55, TECNICO §13).
// Base: tools/revisao/tecnico-desempenho/proposta/diag.ts. A Partida cria o painel quando `?diag=1` está na URL e
// chama `quadro(agora, msSim, msDesenho, extras)` uma vez por quadro desenhado.
//
// Linha curta sempre visível (fps, 1 % pior, chamadas, triângulos); um toque abre o resto: tempo de quadro p50/p95,
// CPU da simulação e do desenho, resolução interna, qualidade, texturas/geometrias/programas, GPU real
// (WEBGL_debug_renderer_info), núcleos, RAM, memória JS, bateria (Chrome Android), ping, carga da fase ("Jogar" →
// jogando) e "contexto perdido". Grava 1 linha a cada 5 s por até 30 min (mostra o aquecimento: fps caindo com a
// mesma cena) e tem o botão "Copiar relatório" para mandar no WhatsApp.
//
// Custo: o painel mede o próprio tempo (`custo`); o texto só é refeito a cada 8 quadros. Meta: < 0,3 ms por quadro.
import type * as THREE from 'three';

export const DIAG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('diag') === '1';

export interface ExtrasDiag { qualidade?: string; ping?: number; cargaMs?: number; instantaneos?: number }

/** p-ésimo percentil (0…1) de uma lista (ordena uma cópia) */
export const percentil = (a: readonly number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
};

export interface Diag {
  readonly gpu: string;
  quadro(agora: number, msSim: number, msDesenho: number, x?: ExtrasDiag): void;
  /** custo do próprio painel em ms por quadro (média e p95 dos últimos 240) */
  custo(): { media: number; p95: number };
  relatorio(): string;
  destruir(): void;
}

export function criarDiag(renderer: THREE.WebGLRenderer): Diag {
  const gl = renderer.getContext();
  let gpu = '?';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch { /* sem a extensão */ }
  const nav = navigator as Navigator & { deviceMemory?: number; getBattery?: () => Promise<{ level: number; charging: boolean }> };
  const el = document.createElement('div');
  el.id = 'diag';
  el.style.cssText = 'position:fixed;left:50%;top:max(2px,env(safe-area-inset-top));transform:translateX(-50%);z-index:99;font:11px/1.25 ui-monospace,monospace;'
    + 'color:#fff;background:#000b;padding:3px 8px;border-radius:6px;white-space:pre;pointer-events:auto;max-width:96vw;overflow:hidden;touch-action:manipulation';
  const texto = document.createElement('div');
  const copiar = document.createElement('button');
  copiar.textContent = 'Copiar relatório';
  copiar.style.cssText = 'display:none;margin-top:4px;font:12px sans-serif;padding:4px 10px;border-radius:6px;box-shadow:none';
  el.append(texto, copiar);
  document.body.appendChild(el);
  let aberto = false;
  el.addEventListener('pointerup', (e) => { if (e.target === copiar) return; aberto = !aberto; copiar.style.display = aberto ? 'block' : 'none'; });
  const intervalos: number[] = [], sims: number[] = [], desenhos: number[] = [], custos: number[] = [];
  const registro: string[] = [];
  const inicio = performance.now();
  let ultimo = 0, perdido = false, bateria = '', ultimoReg = 0, n = 0, extras: ExtrasDiag = {};
  renderer.domElement.addEventListener('webglcontextlost', () => { perdido = true; });
  let relogioBateria: ReturnType<typeof setInterval> | null = null;
  nav.getBattery?.().then((b) => { const f = () => { bateria = `${Math.round(b.level * 100)}%${b.charging ? ' ⚡' : ''}`; }; f(); relogioBateria = setInterval(f, 30000); }).catch(() => {});
  const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
  const empurrar = (a: number[], v: number) => { a.push(v); if (a.length > 240) a.shift(); };

  function linhas(): string[] {
    const media = intervalos.length ? intervalos.reduce((s, v) => s + v, 0) / intervalos.length : 0;
    const fps = media ? 1000 / media : 0;
    const pior1 = intervalos.length ? 1000 / percentil(intervalos, 0.99) : 0;
    const i = renderer.info, c = renderer.domElement;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const curto = `${Math.round(fps)} fps (1% ${Math.round(pior1)}) · ${i.render.calls} ch · ${Math.round(i.render.triangles / 1000)} mil tri`;
    if (!aberto) return [curto];
    const x = extras;
    return [
      curto,
      `quadro p50 ${r1(percentil(intervalos, 0.5))} ms p95 ${r1(percentil(intervalos, 0.95))} ms · CPU sim ${r1(percentil(sims, 0.5))} desenho ${r1(percentil(desenhos, 0.5))} ms (p95 ${r1(percentil(desenhos, 0.95))})`,
      `tela ${innerWidth}×${innerHeight} dpr ${r1(devicePixelRatio)} → interno ${c.width}×${c.height} (pr ${r1(renderer.getPixelRatio())})`,
      `qualidade ${x.qualidade ?? '?'} · tex ${i.memory.textures} geo ${i.memory.geometries} prog ${i.programs?.length ?? '?'}`,
      `GPU ${gpu}`,
      `núcleos ${navigator.hardwareConcurrency ?? '?'} · RAM ${nav.deviceMemory ?? '?'} GB · heap JS ${mem ? Math.round(mem.usedJSHeapSize / 2 ** 20) + ' MB' : '?'} · bateria ${bateria || '?'}`,
      `carga "Jogar" → jogando ${x.cargaMs !== undefined ? r1(x.cargaMs / 1000) + ' s' : '?'} · rede: ping ${x.ping !== undefined ? Math.round(x.ping) + ' ms' : '-'}${x.instantaneos !== undefined ? ` · inst/s ${x.instantaneos}` : ''}${perdido ? ' · CONTEXTO PERDIDO' : ''}`,
      `painel ${r1(percentil(custos, 0.5))} ms/quadro · tempo de jogo ${Math.round((performance.now() - inicio) / 60000)} min · registros ${registro.length}`,
    ];
  }

  const diag: Diag = {
    gpu,
    quadro(agora, msSim, msDesenho, x = {}) {
      const t0 = performance.now();
      extras = x;
      if (ultimo) empurrar(intervalos, agora - ultimo);
      ultimo = agora;
      empurrar(sims, msSim); empurrar(desenhos, msDesenho);
      if (agora - ultimoReg > 5000 && registro.length < 360 && intervalos.length > 10) {
        ultimoReg = agora;
        registro.push(`${Math.round((agora - inicio) / 1000)}s ${Math.round(1000 / percentil(intervalos, 0.5))}fps p95 ${r1(percentil(intervalos, 0.95))}ms `
          + `des ${r1(percentil(desenhos, 0.5))}ms ${renderer.info.render.calls}ch ${renderer.domElement.width}x${renderer.domElement.height} ${x.qualidade ?? ''} ${bateria}`);
      }
      if ((++n & 7) === 0) texto.textContent = linhas().join('\n');
      empurrar(custos, performance.now() - t0);
    },
    custo: () => ({ media: custos.length ? custos.reduce((s, v) => s + v, 0) / custos.length : 0, p95: percentil(custos, 0.95) }),
    relatorio: () => [`Entre Dois Mundos — diag ${new Date().toISOString()}`, navigator.userAgent, `GPU ${gpu}`,
      `tela ${innerWidth}×${innerHeight} dpr ${devicePixelRatio} · núcleos ${navigator.hardwareConcurrency ?? '?'} · RAM ${nav.deviceMemory ?? '?'} GB`,
      `qualidade ${extras.qualidade ?? '?'} · carga ${extras.cargaMs !== undefined ? Math.round(extras.cargaMs) + ' ms' : '?'}`, ...registro, ...linhas()].join('\n'),
    destruir() { el.remove(); if (relogioBateria) clearInterval(relogioBateria); },
  };
  copiar.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = diag.relatorio();
    const ok = () => { copiar.textContent = 'Copiado!'; };
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(r).then(ok).catch(() => { prompt('Copie o relatório:', r); });
    else prompt('Copie o relatório:', r);
  });
  return diag;
}
