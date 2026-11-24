// Aviso "Adicionar à Tela de Início" (R31): aparece no iPhone fora do app, uma vez; nunca no app nem no Android.
import { describe, expect, it } from 'vitest';
import { deveAvisarTelaDeInicio } from '../src/ui/plataforma';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; 2201117TY) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('aviso da Tela de Início (R31)', () => {
  it('iPhone no Safari, primeira vez: avisa', () => { expect(deveAvisarTelaDeInicio({ ua: IPHONE }, false)).toBe(true); });
  it('iPhone no Safari, já viu: não avisa de novo', () => { expect(deveAvisarTelaDeInicio({ ua: IPHONE }, true)).toBe(false); });
  it('iPhone aberto pelo ícone (standalone): não avisa', () => {
    expect(deveAvisarTelaDeInicio({ ua: IPHONE, standalone: true }, false)).toBe(false);
    expect(deveAvisarTelaDeInicio({ ua: IPHONE, displayStandalone: true }, false)).toBe(false);
  });
  it('Android: nunca avisa', () => { expect(deveAvisarTelaDeInicio({ ua: ANDROID, toques: 5 }, false)).toBe(false); });
  it('iPad (se apresenta como Mac com toque): avisa; Mac de mesa: não', () => {
    expect(deveAvisarTelaDeInicio({ ua: MAC, plataforma: 'MacIntel', toques: 5 }, false)).toBe(true);
    expect(deveAvisarTelaDeInicio({ ua: MAC, plataforma: 'MacIntel', toques: 0 }, false)).toBe(false);
  });
});
