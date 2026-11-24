// HUD da Arena do Coração: rostos e corações (os mesmos do 2.5D), barra de poder de cada um, barra de vida do Rei
// com as 3 fases marcadas (escudo, vulnerável, rugido) e o aviso "Usem o poder juntos!" quando as duas barras estão
// cheias. Só desenha o estado; não muda nada nele.
import { PODER, REI, type EstadoArena } from '../core/arena';
import { $ } from './telas';

const NOMES_FASE = ['Coroa Brava', 'Névoa Teimosa', 'Medo de se Perder'];

export class HudArena {
  private chave = '';
  private chaveRei = '';
  private poder = [-1, -1];

  configurar(eu: number) {
    $('#hud-cap').textContent = 'Capítulo 7 · Arena do Coração';
    this.eu(eu);
    this.chave = ''; this.chaveRei = ''; this.poder = [-1, -1];
  }

  eu(eu: number) {
    $('#hud-p1').classList.toggle('eu', eu === 0);
    $('#hud-p2').classList.toggle('eu', eu === 1);
  }

  atualizar(e: EstadoArena, eventos: readonly string[]) {
    const chave = e.jogadores.map((j) => `${j.coracoes}${j.bolha ? 'b' : ''}`).join('|');
    if (chave !== this.chave) {
      this.chave = chave;
      e.jogadores.forEach((j, i) => {
        const cs = $(`#cor-${i}`).children;
        for (let k = 0; k < cs.length; k++) cs[k].classList.toggle('vazio', k >= j.coracoes);
        $(`#hud-p${i + 1}`).classList.toggle('bolha', j.bolha);
      });
    }
    e.jogadores.forEach((j, i) => {
      const p = Math.round((j.poder / PODER.max) * 100);
      if (p === this.poder[i]) return;
      this.poder[i] = p;
      const barra = $(`#pod-${i}`);
      (barra.firstElementChild as HTMLElement).style.width = `${p}%`;
      barra.classList.toggle('cheia', p >= 100);
    });
    // os dois cheios (e em jogo): hora do Golpe do Fio Vermelho. No treino o parceiro não usa poder: não avisa.
    const juntos = !e.treino && !e.vitoria && e.jogadores.every((j) => !j.bolha && j.poder >= PODER.max);
    const av = $('#hud-juntos');
    if (av.hidden === juntos) av.hidden = !juntos;

    const r = e.rei;
    const vida = Math.max(0, Math.round((r.vida / REI.vidaMax) * 1000) / 10);
    const estado = `${vida}|${r.fase}|${r.escudo ? 1 : 0}|${r.vulneravel > 0 ? 1 : 0}|${r.transicao > 0 ? 1 : 0}|${e.vitoria ? 1 : 0}`;
    if (estado !== this.chaveRei) {
      this.chaveRei = estado;
      $('#rei-vida').style.width = `${vida}%`;
      $('#rei-fase').textContent = e.vitoria ? 'virou vaga-lume ✨' : NOMES_FASE[r.fase - 1];
      const h = $('#hud-rei');
      h.classList.toggle('escudo', r.escudo && !e.vitoria);
      h.classList.toggle('vulneravel', r.vulneravel > 0 && !e.vitoria);
      h.classList.toggle('rugido', r.transicao > 0);
    }
    for (const ev of eventos) {
      if (!ev.startsWith('dano:')) continue;
      const el = $(`#hud-p${Number(ev.split(':')[1]) + 1}`);
      el.classList.remove('dano'); void el.offsetWidth; el.classList.add('dano');
    }
  }
}
