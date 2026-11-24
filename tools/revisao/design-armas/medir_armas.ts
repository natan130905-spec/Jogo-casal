// design-armas: mede quanto cada capítulo depende do tiro atual (Lança-Estrelas) e quanto a Arena depende dos poderes.
// Roda os bots cooperativos de test/fases (planos dos 7 capítulos) e os bots da arena, contando eventos.
// Cenários dos capítulos: "atual" (tiro automático infinito, como hoje), "sem-tiro" (ninguém atira: só pisão e
// desvio), "municao-N" (cada jogador tem N faíscas e não recarrega nada — mede a munição mínima que o plano usa).
// Uso (de uma worktree): tools/revisao/design-armas/rodar.sh [--json saida.json]
import { CAPITULOS } from '../../../src/core/fases/index';
import { INIMIGO } from '../../../src/core/inimigos';
import { jogar } from '../../../test/fases/bot';
import { PLANOS } from '../../../test/fases/planos';
import { estadoInicialArena, passoArena } from '../../../src/core/arena';
import { BotArena } from '../../../test/arena_bot';
import { writeFileSync } from 'node:fs';

type Linha = Record<string, unknown>;
const saida: { capitulos: Linha[]; arena: Linha[] } = { capitulos: [], arena: [] };

function rodarCap(f: (typeof CAPITULOS)[number], modo: 'atual' | 'sem-tiro' | number) {
  const disparos = [0, 0];
  const r = jogar(f, PLANOS[f.id], {
    limite: 600,
    entradas: (ents) => {
      for (const i of [0, 1]) {
        if (modo === 'sem-tiro') ents[i].shoot = false;
        else if (typeof modo === 'number' && disparos[i] >= modo) ents[i].shoot = false;
      }
    },
    cada: (e) => { for (const ev of e.eventos) if (ev.startsWith('tiro:')) disparos[+ev[5]]++; },
  });
  const ev = r.eventos;
  return {
    capitulo: f.capitulo, modo: String(modo), concluida: r.concluida, segundos: +r.segundos.toFixed(1), erro: r.erro ?? '',
    tiros: [disparos[0], disparos[1]], acertos: ev.acerto ?? 0, defendeu: ev.defendeu ?? 0, derrotas: r.derrotados, pisoes: ev.pisao ?? 0,
    danos: r.danos, bolhas: r.bolhas, voltas: r.voltas, estrelinhas: r.estrelinhas,
  };
}

for (const f of CAPITULOS) {
  const ins = f.inimigos ?? [];
  const porTipo: Record<string, number> = {};
  for (const n of ins) porTipo[n.tipo] = (porTipo[n.tipo] ?? 0) + 1;
  const vidaTotal = ins.reduce((s, n) => s + INIMIGO[n.tipo].vida, 0);
  console.log(`\n== cap ${f.capitulo} ${f.id}: ${ins.length} bichinhos ${JSON.stringify(porTipo)}, vida somada ${vidaTotal}`);
  for (const modo of ['atual', 'sem-tiro', 20, 10, 5] as const) {
    const l = rodarCap(f, modo);
    saida.capitulos.push({ ...l, bichinhos: ins.length, porTipo, vidaTotal });
    console.log(`  ${String(modo).padEnd(8)} concl=${l.concluida} t=${l.segundos}s tiros=${l.tiros} acertos=${l.acertos} derrotas=${l.derrotas} pisoes=${l.pisoes} danos=${l.danos} bolhas=${l.bolhas} voltas=${l.voltas} ${l.erro}`);
  }
}

// Arena: de onde vem o dano no Rei (golpe, tiro, cometa, jardim, fio)
for (const [nome, ac, dv] of [['mediana', 0.6, 0.7], ['perfeita', 1, 1]] as const) {
  for (const s of [1, 2, 3]) {
    const e = estadoInicialArena({});
    const bots = [new BotArena(0, { acerto: ac, desvio: dv, semente: s * 11 }), new BotArena(1, { acerto: ac, desvio: dv, semente: s * 17 })];
    const dano: Record<string, number> = {}; const cont: Record<string, number> = {};
    while (!e.vitoria && e.tick < 900 * 60) {
      passoArena(e, [bots[0].entrada(e), bots[1].entrada(e)]);
      for (const x of e.eventos) {
        const p = x.split(':');
        cont[p[0]] = (cont[p[0]] ?? 0) + 1;
        if (p[0] === 'acerto-rei') dano[p[2]] = (dano[p[2]] ?? 0) + Number(p[3]);
      }
    }
    const total = Object.values(dano).reduce((a, b) => a + b, 0);
    const linha = { perfil: nome, semente: s, vitoria: e.vitoria, tempo: +(e.tick / 60).toFixed(1), dano, total,
      golpes: cont.golpe ?? 0, tiros: cont.tiro ?? 0, poderes: cont.poder ?? 0, fio: cont['fio-vermelho'] ?? 0,
      escudoQuebra: cont['escudo-quebra'] ?? 0, cristaisJuntos: cont['cristais-juntos'] ?? 0, curas: cont.cura ?? 0 };
    saida.arena.push(linha);
    const pct = Object.fromEntries(Object.entries(dano).map(([k, v]) => [k, `${Math.round((100 * v) / total)}%`]));
    console.log(`arena ${nome} s${s}: vit=${linha.vitoria} t=${linha.tempo}s dano=${JSON.stringify(dano)} ${JSON.stringify(pct)} golpes=${linha.golpes} tiros=${linha.tiros} poderes=${linha.poderes} fio=${linha.fio} escudo=${linha.escudoQuebra} cristais=${linha.cristaisJuntos}`);
  }
}

const k = process.argv.indexOf('--json');
if (k > 0) writeFileSync(process.argv[k + 1], JSON.stringify(saida, null, 1));
