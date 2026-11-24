// Detecção de plataforma para avisos (R31). Funções puras (testáveis com valores falsos).

export interface InfoNavegador { ua: string; plataforma?: string; toques?: number; standalone?: boolean; displayStandalone?: boolean }

/** iPhone/iPad (o iPadOS se apresenta como Mac com toque) */
export function ehIOS(n: InfoNavegador) {
  return /iP(hone|ad|od)/.test(n.ua) || (n.plataforma === 'MacIntel' && (n.toques ?? 0) > 1);
}

/** Aviso "Adicionar à Tela de Início": só no iOS e só fora do app da Tela de Início (lá já é tela cheia). No iOS
 *  todo navegador usa o motor do Safari e não tem tela cheia; o "Adicionar" existe no Safari (e, no iOS 16.4+, no
 *  menu Compartilhar dos outros). Uma vez só (`jaViu`). */
export function deveAvisarTelaDeInicio(n: InfoNavegador, jaViu: boolean) {
  return ehIOS(n) && !n.standalone && !n.displayStandalone && !jaViu;
}

export function infoDoNavegador(): InfoNavegador {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    ua: nav.userAgent, plataforma: nav.platform, toques: nav.maxTouchPoints, standalone: nav.standalone === true,
    displayStandalone: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
  };
}
