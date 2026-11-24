// Testes permanentes de alcance dos coletáveis (AUDITORIA_MOVIMENTO.md §6–7), divididos em dois arquivos para o
// vitest rodar em paralelo: test/fases_alcance.test.ts (capítulos 1, 2, 4–7) e test/fases_alcance_relogio.test.ts
// (capítulo 3, o mais caro por causa dos ponteiros).
import { describe, expect, it } from 'vitest';
import { CAPITULOS } from '../../src/core/fases/index';
import type { Fase, Ponto } from '../../src/core/types';
import { alcanceDoCapitulo, buscar, soEmDupla } from './busca';

/** Folga mínima de toda estrelinha (pares estado × gesto da busca que a pegam). Medido em 2026-11-24 depois das
 *  correções: a menor é 19 (cap. 5 #7, no quique da gelatina); antes havia 6 (cap. 5 #9) e 1 (cap. 3 #31). */
export const FOLGA_MIN = 15;

/** Estrelinhas que só saem em dupla (superpulo de mãos dadas), aprovadas como segredos de dupla e marcadas no
 *  cenário com `marcas: [{ tipo: 'maos-dadas' }]`. Uma estrelinha que vire "só em dupla" por acidente quebra o teste. */
export const SO_EM_DUPLA: Record<number, number[]> = { 1: [22, 23, 24], 2: [18, 19, 20] };

/** Até onde um jogador sozinho, saindo do início, pode chegar: a primeira ajuda de cada capítulo (porta com a placa
 *  longe, fio ou muro de mãos dadas; AUDITORIA_MOVIMENTO.md §2.2). Com o coyote time, os abismos do fio de 5,6 m
 *  (cap. 2 e 7) passaram a ser vencidos sozinho: a busca achou e os vãos foram para 6,2 m. */
export const SOLO_ATE: Record<number, number> = { 1: 45, 2: 50, 3: 85, 4: 96, 5: 90, 6: 58, 7: 78 };

/**
 * Faixa vertical vista com os dois juntos em pé no chão `chaoY`: câmera de src/render/cena.ts em 2026-11-24
 * (perspectiva 42°, distância 7,6 m, alvo 2 + 0,06·dist acima do meio dos dois, olhando 0,9 + 0,04·dist abaixo).
 * Se a câmera mudar, atualize aqui (tools/revisao/auditoria-movimento/visibilidade.ts faz a mesma conta).
 */
export function topoDaTela(chaoY: number): number {
  const meio = chaoY + 0.55, dist = 7.6, fov = 42;
  const camY = meio + 2 + dist * 0.06, olhaY = camY - 0.9 - dist * 0.04;
  const ang = Math.atan2(camY - olhaY, dist), meia = (fov / 2) * (Math.PI / 180);
  return camY - Math.tan(ang - meia) * dist;
}

/** Topo do chão fixo mais alto logo abaixo da estrelinha (onde a dupla estaria em pé olhando para ela). */
function chaoAbaixo(f: Fase, p: Ponto): number | null {
  let y: number | null = null;
  for (const r of f.plataformas) {
    const topo = r.y + r.h;
    if (p.x < r.x - 0.3 || p.x > r.x + r.w + 0.3 || topo > p.y - 0.2) continue;
    if (y === null || topo > y) y = topo;
  }
  return y;
}

export function testarAlcance(caps: number[]) {
  for (const f of CAPITULOS.filter((c) => caps.includes(c.capitulo))) {
    describe(`${f.capitulo}. ${f.nome}: alcance pela simulação real`, () => {
      it('toda estrelinha, lanterna e placa alcançável, com folga; pedaço alcançável; segredos de dupla marcados', () => {
        const r = alcanceDoCapitulo(f);
        const est = f.estrelinhas ?? [];
        const nome = (k: number) => `#${k} (${+est[k].x.toFixed(2)}, ${+est[k].y.toFixed(2)})`;
        const folga = est.map((_, k) => Math.max(r.A.folga[k], r.B.folga[k]));
        console.log(`cap ${f.capitulo}: busca em ${r.segundos.toFixed(1)} s, estados A ${r.A.estados} B ${r.B.estados}; ` +
          `menor folga ${Math.min(...folga)} (${nome(folga.indexOf(Math.min(...folga)))})`);
        expect(folga.map((v, k) => (v === 0 ? nome(k) : null)).filter(Boolean), 'estrelinhas inalcançáveis').toEqual([]);
        expect(folga.map((v, k) => (v < FOLGA_MIN ? `${nome(k)} folga ${v}` : null)).filter(Boolean), `folga < ${FOLGA_MIN}`).toEqual([]);
        expect(r.B.lanternas.map((v, k) => (v ? null : k)).filter((k) => k !== null), 'lanternas inalcançáveis').toEqual([]);
        expect(Object.entries(r.A.placas).filter(([, v]) => !v).map(([id]) => id), 'placas inalcançáveis').toEqual([]);
        expect(r.B.portal, 'pedaço da estrela').toBe(true);
        expect(r.A.esgotou || r.B.esgotou, 'a busca bateu no limite de estados (resultado incompleto)').toBe(false);
        const dupla = soEmDupla(r);
        expect(dupla, 'estrelinhas só em dupla (aprovadas)').toEqual(SO_EM_DUPLA[f.capitulo] ?? []);
        const marcas = (f.marcas ?? []).filter((m) => m.tipo === 'maos-dadas');
        for (const k of dupla) expect(marcas.some((m) => Math.abs(m.x - est[k].x) <= 6), `${nome(k)} sem marca de mãos dadas a até 6 m`).toBe(true);
      }, 240_000);

      it(`sozinho, desde o início, não passa da primeira ajuda (x < ${SOLO_ATE[f.capitulo]})`, () => {
        const r = buscar(f, 'A', [f.inicio[0]]);
        expect(r.esgotou).toBe(false);
        expect(r.portal).toBe(false);
        expect(r.maxX).toBeLessThan(SOLO_ATE[f.capitulo]);
      }, 120_000);

      it('nenhuma estrelinha fica acima da tela com a dupla no chão logo abaixo dela', () => {
        const fora: string[] = [];
        (f.estrelinhas ?? []).forEach((p, k) => {
          const chao = chaoAbaixo(f, p);
          if (chao === null) return;
          const acima = p.y - topoDaTela(chao);
          if (acima > 0) fora.push(`#${k} (${p.x}, ${p.y}) ${acima.toFixed(2)} m acima`);
        });
        expect(fora).toEqual([]);
      });
    });
  }
}
