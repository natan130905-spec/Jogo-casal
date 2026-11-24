// Simulação do governo de qualidade (sem navegador): node --experimental-transform-types tools/revisao/tecnico-desempenho/proposta/teste_governo.mts
import { GovernoQualidade, qualidadeInicial } from './qualidadeAuto.ts';
const g = new GovernoQualidade({ teto: 'alta' });
const log: string[] = []; g.aoMudar = (d, r) => log.push(`${d.nome}${r ? ' (recarga)' : ''}`);
let t = 0; let pulados = 0, desenhados = 0;
// tela 90 Hz, aparelho que só aguenta 35 fps nos 3 degraus "alta", 55 fps no Normal, folga no Normal 85 %
for (let k = 0; k < 90 * 120; k++) { t += 1000 / 90; if (!g.quadro(t)) { pulados++; continue; } desenhados++; const custo = g.degrau.qualidade === 'alta' ? 28 : g.degrau.escala === 1 ? 18 : 14; if (custo > 1000/90) t += custo - 1000/90; }
console.log('degraus:', log.join(' → '), '| final', g.resumo(), '| pulados', pulados, 'desenhados', desenhados);
console.log(qualidadeInicial('Adreno (TM) 610', 4, 873), qualidadeInicial('Mali-G57 MC2', 4, 873), qualidadeInicial('Apple GPU', undefined, 844));
for (const [hz, meta] of [[90, 60], [120, 60], [60, 60], [60, 30]] as const) {
  const g = new GovernoQualidade({ teto: 'media', meta }); let t = 0, d = 0;
  for (let k = 0; k < hz * 10; k++) { t += 1000 / hz; if (g.quadro(t)) d++; }
  console.log(`${hz} Hz, meta ${meta}: ${d / 10} quadros desenhados/s`);
}
