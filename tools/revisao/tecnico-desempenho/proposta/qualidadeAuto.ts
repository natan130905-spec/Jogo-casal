// PROPOSTA (não ligada ao jogo): qualidade adaptável pelo tempo de quadro medido NO APARELHO, com limitador de fps.
// Para integrar: src/render/qualidadeAuto.ts; a Partida chama `governo.quadro(agora)` no começo de cada rAF e só
// simula/desenha quando ele devolve true; a Cena lê `governo.nivel` (degraus abaixo) para escala de resolução, sombra,
// bloom, densidade de partículas e névoa. Tudo testável em Node (sem DOM): o tempo entra por parâmetro.
//
// Ideia: o jogador escolhe Leve / Normal / Bonito (o TETO). O governo começa no teto e desce degraus finos quando o
// aparelho não segura a meta; sobe devagar quando sobra folga; e trava a subida se o mesmo degrau falhou duas vezes
// (aquecimento: o celular fica mais lento depois de 5–10 min, e oscilar é pior do que ficar um degrau abaixo).

export type Qualidade = 'baixa' | 'media' | 'alta';

/** Um degrau = o que a Cena aplica. Do mais bonito (0) ao mais leve. */
export interface Degrau {
  nome: string;
  qualidade: Qualidade;   // materiais/geometria (troca só ao recarregar a fase; ver `exigeRecarga`)
  escala: number;         // multiplica o pixelRatio da qualidade (resolução interna)
  sombras: boolean;       // mapa de sombra real (só alta)
  bloom: boolean;         // pós-processo
  particulas: number;     // fração da densidade (vaga-lumes, névoa, estouros)
}

export const DEGRAUS: readonly Degrau[] = [
  { nome: 'Bonito',            qualidade: 'alta',  escala: 1,    sombras: true,  bloom: true,  particulas: 1 },
  { nome: 'Bonito sem bloom',  qualidade: 'alta',  escala: 1,    sombras: true,  bloom: false, particulas: 1 },
  { nome: 'Bonito 85 %',       qualidade: 'alta',  escala: 0.85, sombras: true,  bloom: false, particulas: 0.8 },
  { nome: 'Normal',            qualidade: 'media', escala: 1,    sombras: false, bloom: false, particulas: 0.8 },
  { nome: 'Normal 85 %',       qualidade: 'media', escala: 0.85, sombras: false, bloom: false, particulas: 0.6 },
  { nome: 'Leve',              qualidade: 'baixa', escala: 1,    sombras: false, bloom: false, particulas: 0.5 },
  { nome: 'Leve 80 %',         qualidade: 'baixa', escala: 0.8,  sombras: false, bloom: false, particulas: 0.4 },
];
const inicioDo = (q: Qualidade) => DEGRAUS.findIndex((d) => d.qualidade === q);

export interface OpcoesGoverno {
  teto: Qualidade;
  /** quadros por segundo desejados: 60 (padrão), 30 no modo economia de bateria */
  meta?: 60 | 30;
  /** janela de medida (ms) */
  janela?: number;
}

export class GovernoQualidade {
  nivel: number;
  readonly meta: number;
  private intervalo: number;       // ms entre quadros desejado
  private ultimoQuadro = 0;
  private proximo = 0;
  private amostras: number[] = []; // intervalos entre quadros desenhados na janela atual
  private inicioJanela = 0;
  private ruins = 0;               // janelas seguidas abaixo da meta
  private boas = 0;                // janelas seguidas com folga
  private falhas = new Map<number, number>(); // degrau → vezes que precisou descer dele
  private ultimaMudanca = 0;
  /** chamado quando o degrau muda (a Cena aplica escala/sombra/bloom; `exigeRecarga` se mudou a qualidade de material) */
  aoMudar: (d: Degrau, exigeRecarga: boolean) => void = () => {};

  constructor(private o: OpcoesGoverno) {
    this.nivel = inicioDo(o.teto);
    this.meta = o.meta ?? 60;
    this.intervalo = 1000 / this.meta;
  }

  get degrau() { return DEGRAUS[this.nivel]; }

  /**
   * Limitador + medida. Chamar no começo do callback do rAF com o `agora` dele. Devolve false quando este quadro
   * deve ser pulado (tela de 90/120 Hz desenhando a 60, ou modo 30 fps): nada de simular nem desenhar.
   */
  quadro(agora: number): boolean {
    // relógio-alvo (não "intervalo desde o último"): numa tela de 90 Hz com meta 60 desenha 2 de cada 3 batidas (60/s);
    // com "desde o último" desenharia 1 de 2 (45/s). Tolerância de 1/4 do intervalo para a variação do vsync.
    if (this.proximo && agora < this.proximo - this.intervalo / 4) return false;
    this.proximo = this.proximo && agora - this.proximo < this.intervalo ? this.proximo + this.intervalo : agora + this.intervalo;
    const dt = this.ultimoQuadro ? agora - this.ultimoQuadro : this.intervalo;
    this.ultimoQuadro = agora;
    if (dt > 250) { this.amostras.length = 0; this.inicioJanela = agora; return true; } // volta de pausa/segundo plano
    this.amostras.push(dt);
    if (!this.inicioJanela) this.inicioJanela = agora;
    if (agora - this.inicioJanela >= (this.o.janela ?? 2000)) this.avaliar(agora);
    return true;
  }

  private avaliar(agora: number) {
    const a = this.amostras.sort((x, y) => x - y);
    const p90 = a[Math.floor(a.length * 0.9)] ?? this.intervalo;
    this.amostras.length = 0; this.inicioJanela = agora;
    const lento = p90 > this.intervalo * 1.25;   // 60 → p90 > 20,8 ms (menos de ~48 fps em 10 % dos quadros)
    const folga = p90 < this.intervalo * 1.08;   // praticamente todos os quadros no tempo
    if (lento) { this.ruins++; this.boas = 0; } else if (folga) { this.boas++; this.ruins = 0; } else { this.ruins = 0; this.boas = 0; }
    const teto = inicioDo(this.o.teto);
    // desce depois de 2 janelas ruins (4 s); se for muito ruim (p90 > 2× a meta), desce já
    if ((this.ruins >= 2 || p90 > this.intervalo * 2) && this.nivel < DEGRAUS.length - 1) {
      this.falhas.set(this.nivel, (this.falhas.get(this.nivel) ?? 0) + 1);
      this.mudar(this.nivel + 1, agora);
    } else if (this.boas >= 8 && this.nivel > teto && agora - this.ultimaMudanca > 30000) {
      // sobe só com 16 s de folga, no máximo uma vez a cada 30 s, e nunca para um degrau que já falhou 2 vezes
      if ((this.falhas.get(this.nivel - 1) ?? 0) < 2) this.mudar(this.nivel - 1, agora);
      this.boas = 0;
    }
  }

  private mudar(n: number, agora: number) {
    const antes = this.degrau;
    this.nivel = n; this.ultimaMudanca = agora; this.ruins = 0; this.boas = 0;
    this.aoMudar(this.degrau, antes.qualidade !== this.degrau.qualidade);
  }

  /** Para o painel ?diag=1 e para salvar no aparelho o degrau em que ele se estabilizou. */
  resumo() { return { nivel: this.nivel, nome: this.degrau.nome, meta: this.meta, falhas: Object.fromEntries(this.falhas) }; }
}

/**
 * Qualidade inicial sugerida na PRIMEIRA vez (antes de haver medida salva). Heurística pela GPU informada pelo
 * navegador; o governo corrige depois. LIMIARES A CALIBRAR com as medidas reais do ?diag=1 nos dois aparelhos. "Apple GPU" não diz o modelo: decide pela tela (iPhone 12+ têm tela ≥ 844 pt).
 */
export function qualidadeInicial(gpu: string, memoriaGB: number | undefined, telaMaior: number): Qualidade {
  const g = gpu.toLowerCase();
  if (/apple/.test(g)) return telaMaior >= 844 ? 'alta' : 'media';
  const adreno = g.match(/adreno[^0-9]*(\d{3})/);
  if (adreno) { const n = Number(adreno[1]); return n >= 640 ? 'alta' : n >= 605 ? 'media' : 'baixa'; } // 610 (Redmi Note 11 global) → media, o governo desce se precisar
  const mali = g.match(/mali-g(\d+)(?:\s*mc(\d+))?/);
  if (mali) { const n = Number(mali[1]), mc = Number(mali[2] ?? 1); return n >= 710 || mc >= 6 ? 'alta' : n >= 52 ? 'media' : 'baixa'; } // G57 MC2 (Redmi Note 11S/11 Pro) → media
  if (memoriaGB !== undefined && memoriaGB <= 3) return 'baixa';
  return 'media';
}
