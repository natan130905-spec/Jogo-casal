// HUD das armas (L4): chip com a arma e a munição abaixo do rosto de cada um, o ícone do botão ATACAR (a arma na mão
// de quem joga neste aparelho) e o anel de munição do ⇆. Só mexe no DOM quando algo muda. O L5 refaz o layout.
import { defItem, type DefTiro } from '../core/arsenal';
import type { EstadoArsenal, Estado } from '../core/types';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

/** Texto do chip: ícone da arma na mão e a munição ("●●○" no Estilingue, "8·40" nas de munição). */
export function textoChip(a: EstadoArsenal): string {
  const d = defItem(a.itens[a.atual]);
  if (!d) return '';
  let t = d.icone;
  if (d.espaco === 'tiro') {
    const tiro = d as DefTiro, c = a.carga[a.atual];
    t += tiro.infinita ? ` ${'●'.repeat(c)}${'○'.repeat(Math.max(0, tiro.carga - c))}` : ` ${c}·${a.reserva[a.atual]}`;
  }
  if (a.bolsa > 0) t += ` ◦${a.bolsa}`;
  return t;
}

/** Fração da carga da arma na mão (o anel do ⇆): 1 no corpo a corpo. */
export function cargaDaMao(a: EstadoArsenal): number {
  const d = defItem(a.itens[a.atual]);
  return d?.espaco === 'tiro' ? a.carga[a.atual] / (d as DefTiro).carga : 1;
}

export class HudArmas {
  private chips = ['', ''];
  private botao = '';
  atualizar(e: Estado, eu: number) {
    e.jogadores.forEach((j, i) => {
      if (!j.arsenal) return;
      const t = textoChip(j.arsenal);
      if (t === this.chips[i]) return;
      this.chips[i] = t;
      const el = $(`#arma-${i}`);
      if (el) el.textContent = t;
    });
    const a = e.jogadores[eu]?.arsenal;
    if (!a) return;
    const d = defItem(a.itens[a.atual]);
    const chave = `${d?.icone ?? ''}|${cargaDaMao(a).toFixed(2)}`;
    if (chave === this.botao) return;
    this.botao = chave;
    const bt = $('#bt-tiro');
    if (bt && d) { bt.textContent = d.icone; bt.setAttribute('aria-label', `Atacar (${d.nome})`); }
    $('#bt-troca')?.style.setProperty('--carga', cargaDaMao(a).toFixed(2));
  }
}
