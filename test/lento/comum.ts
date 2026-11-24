// Bateria lenta de um capítulo (npm run test:lento; L2a, AUDITORIA_MOVIMENTO §7):
//  1. alcance pela BUSCA COMPLETA (gestos da auditoria, chave fina, até 60 mil estados): toda estrelinha com folga
//     ≥ 100, lanternas, placas e pedaço alcançáveis, só em dupla = a lista aprovada, sem bater no limite;
//  2. janela de decolagem: toda estrelinha que sai de salto solo de chão fixo tem janela ≥ 0,4 m e, contando o pulo
//     tardio do coyote, ≥ 0,9 m;
//  3. visibilidade com a câmera do render (src/render/camera.ts): com o jogador em pé no chão logo abaixo da
//     estrelinha (sozinho ou com o parceiro a 6 m), nas duas telas e nos dois celulares, ela aparece no quadro.
// Exceções aprovadas ficam nas listas abaixo, com o motivo.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraJogador, aplicarCamera } from '../../src/render/camera';
import { CAPITULOS } from '../../src/core/fases/index';
import { DT, estadoInicial } from '../../src/core/sim';
import { SO_EM_DUPLA } from '../fases/alcance_teste';
import { alcanceDoCapitulo, soEmDupla } from '../fases/busca';
import { janelas } from '../fases/janela';

export const FOLGA_LENTA = 100;
export const JANELA_MIN = 0.4, JANELA_COYOTE_MIN = 0.9;
/** Estrelinhas com folga < 100 aceitas por enquanto (cap → índices), com o motivo. Vazio = nenhuma. */
export const FOLGA_EXCECOES: Record<number, Record<number, string>> = {};
/** Estrelinhas com janela abaixo do mínimo aceitas por enquanto. */
export const JANELA_EXCECOES: Record<number, Record<number, string>> = {
  // no alto do relógio de dois ponteiros (cx 114): sai subindo no ponteiro; o pulo do chão fixo que também a pega
  // é um extra de 0,1 m (0,62 com o coyote). A busca completa, que usa os ponteiros, exige folga ≥ 100 nela. (R71)
  3: { 24: 'sai pelo ponteiro do relógio de dois ponteiros (x 114)' },
};
/** Estrelinhas fora do quadro aceitas (segredos que pedem subir antes). */
export const VISIBILIDADE_EXCECOES: Record<number, Record<number, string>> = {};

const TELAS = [844 / 390, 873 / 393];

export function testarCapituloLento(cap: number) {
  const f = CAPITULOS.find((c) => c.capitulo === cap)!;
  const est = f.estrelinhas ?? [];
  const nome = (k: number) => `#${k} (${est[k].x}, ${est[k].y})`;
  describe(`${f.capitulo}. ${f.nome} (lento)`, () => {
    it(`busca completa: tudo alcançável, folga ≥ ${FOLGA_LENTA}, segredos de dupla aprovados`, () => {
      const r = alcanceDoCapitulo(f, { completa: true, limite: 60000 });
      const folga = est.map((_, k) => Math.max(r.A.folga[k], r.B.folga[k]));
      const menor = Math.min(...folga);
      console.log(`cap ${cap}: busca completa em ${r.segundos.toFixed(0)} s, estados A ${r.A.estados} B ${r.B.estados}; menor folga ${menor} (${nome(folga.indexOf(menor))})`);
      expect(r.A.esgotou || r.B.esgotou, 'a busca bateu no limite de estados').toBe(false);
      const exc = FOLGA_EXCECOES[cap] ?? {};
      expect(folga.map((v, k) => (v < FOLGA_LENTA && !(k in exc) ? `${nome(k)} folga ${v}` : null)).filter(Boolean)).toEqual([]);
      expect(r.B.lanternas.every(Boolean), 'lanternas').toBe(true);
      expect(Object.values(r.A.placas).every(Boolean), 'placas').toBe(true);
      expect(r.B.portal, 'pedaço da estrela').toBe(true);
      expect(soEmDupla(r), 'só em dupla').toEqual(SO_EM_DUPLA[cap] ?? []);
    });

    it(`janela de decolagem ≥ ${JANELA_MIN} m (≥ ${JANELA_COYOTE_MIN} m com o coyote)`, () => {
      const exc = JANELA_EXCECOES[cap] ?? {};
      const curtas = janelas(f).map((w, k) => (w && !(k in exc) && (w.m < JANELA_MIN || Math.max(w.m, w.coyoteM) < JANELA_COYOTE_MIN)
        ? `${nome(k)} janela ${w.m} m, com coyote ${w.coyoteM} m (${w.perfil} de x ${w.de[0]}…${w.de[1]})` : null)).filter(Boolean);
      expect(curtas).toEqual([]);
    });

    it('visibilidade: com o jogador no chão logo abaixo, a estrelinha aparece no quadro (2 telas, 2 celulares, parceiro junto ou a 6 m)', () => {
      const exc = VISIBILIDADE_EXCECOES[cap] ?? {};
      const fora = new Set<string>();
      est.forEach((s, k) => {
        if (k in exc) return;
        let chao: { x: number; w: number; topo: number } | null = null;
        for (const r of f.plataformas) {
          const topo = r.y + r.h;
          if (s.x < r.x - 0.3 || s.x > r.x + r.w + 0.3 || topo > s.y - 0.2) continue;
          if (!chao || topo > chao.topo) chao = { x: r.x, w: r.w, topo };
        }
        if (!chao) return;
        const xEm = Math.min(chao.x + chao.w - 0.2, Math.max(chao.x + 0.2, s.x));
        for (const asp of TELAS) for (const eu of [0, 1] as const) for (const sep of [0, 6, -6]) {
          const e = estadoInicial(f), c = new CameraJogador(f);
          const cam = new THREE.PerspectiveCamera(35, asp, 0.1, 200);
          const [me, ou] = [e.jogadores[eu], e.jogadores[1 - eu]];
          me.x = xEm; me.y = chao.topo; me.noChao = true;
          ou.x = Math.min(chao.x + chao.w - 0.2, Math.max(chao.x + 0.2, xEm + sep)); ou.y = chao.topo; ou.noChao = true;
          for (let t = 0; t < 240; t++) aplicarCamera(cam, c.atualizar(e, eu, asp, DT));
          const n = new THREE.Vector3(s.x, s.y + 0.3, 0).project(cam);
          if (n.y > 1 || Math.abs(n.x) > 1) fora.add(`${nome(k)}`);
        }
      });
      expect([...fora]).toEqual([]);
    });
  });
}
