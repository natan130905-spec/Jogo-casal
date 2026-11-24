// Sonda WebGL injetada na página (context.addInitScript) ANTES do jogo carregar. Não depende do código do jogo:
// embrulha os protótipos de WebGL2RenderingContext/WebGLRenderingContext e o requestAnimationFrame.
// Mede por contexto WebGL (cada fase cria um canvas novo): chamadas de desenho e triângulos por quadro, texturas,
// buffers e renderbuffers vivos com bytes estimados de memória de vídeo, programas (shaders) criados e o tempo de
// CPU gasto em compilar/ligar shaders, tempo de CPU de cada callback de requestAnimationFrame e tarefas longas.
// Tudo fica em window.__sonda. Medidas de bytes são ESTIMATIVAS (tamanho × formato × mips), não leitura do driver.
(() => {
  if (window.__sonda) return;
  const agora = () => performance.now();
  const S = (window.__sonda = {
    contextos: 0, ctxCriadoEm: 0, primeiroDesenhoEm: 0,
    // por contexto atual
    tex: 0, texBytes: 0, buf: 0, bufBytes: 0, rb: 0, rbBytes: 0, programas: 0, shaders: 0,
    compilarMs: 0, compilacoes: 0, maiorCompilarMs: 0,
    // por quadro (anel dos últimos N)
    quadros: [], desenhosQuadro: 0, triQuadro: 0, instQuadro: 0,
    longas: [], uploadsTexQuadro: 0, bytesUploadQuadro: 0,
    // totais da vida da página
    totalProgramas: 0, totalCompilarMs: 0,
    zerar() { this.quadros.length = 0; this.longas.length = 0; },
  });
  const N = 900;
  const vivas = new Set();
  S.texLista = () => [...vivas].filter((i) => i.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 12).map((i) => `${i.w}x${i.h}${i.faces ? ' cubo' : ''}${i.mip ? ' +mip' : ''} ${(i.bytes / 2 ** 20).toFixed(2)} MB`);
  const texInfo = new WeakMap(), bufInfo = new WeakMap(), rbInfo = new WeakMap();
  const ligadoTex = new WeakMap(); // gl -> Map(unit:target -> tex)
  const unidade = new WeakMap();
  const ligadoBuf = new WeakMap();
  const ligadoRb = new WeakMap();
  // bytes por texel de formatos internos comuns (WebGL2)
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x881A: 8, 0x8814: 16, 0x822F: 4, 0x8230: 8, 0x8229: 1, 0x822B: 2, 0x81A5: 2, 0x81A6: 4, 0x88F0: 4, 0x8CAC: 4, 0x8CAD: 8, 0x1908: 4, 0x1907: 3, 0x1909: 1, 0x190A: 2, 0x8D48: 1, 0x8C3A: 4, 0x8C3D: 4, 0x8051: 3, 0x8D62: 2, 0x8056: 2, 0x8057: 2 };
  const bpp = (fmt, type) => {
    if ((type === 0x140B || type === 0x8D61) && (fmt === 0x1908 || fmt === 0x1907)) return fmt === 0x1908 ? 8 : 6; // HALF_FLOAT com formato não dimensionado (o dimensionado já está na tabela)
    if (type === 0x1406 && (fmt === 0x1908 || fmt === 0x1907)) return fmt === 0x1908 ? 16 : 12;
    return BPP[fmt] ?? 4;
  };
  const chaveTex = (gl, target) => `${unidade.get(gl) ?? 0}:${target === 0x8515 + 0 || (target >= 0x8515 && target <= 0x851A) ? 0x8513 : target}`;
  const texAtual = (gl, target) => ligadoTex.get(gl)?.get(chaveTex(gl, target));
  const novoContexto = () => {
    S.contextos++; S.ctxCriadoEm = agora(); S.primeiroDesenhoEm = 0;
    S.tex = S.texBytes = S.buf = S.bufBytes = S.rb = S.rbBytes = S.programas = S.shaders = 0;
    S.compilarMs = 0; S.compilacoes = 0; S.maiorCompilarMs = 0;
  };
  const vistos = new WeakSet();
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, ...r) {
    const ctx = origGetContext.call(this, tipo, ...r);
    if (ctx && /webgl/.test(tipo) && !vistos.has(ctx)) { vistos.add(ctx); novoContexto(); S.ultimoCanvas = this; S.atributos = ctx.getContextAttributes(); }
    return ctx;
  };
  const embrulhar = (P, nome, antes, depois) => {
    const o = P[nome]; if (!o) return;
    P[nome] = function (...a) { const x = antes?.call(this, a); const r = o.apply(this, a); depois?.call(this, a, r, x); return r; };
  };
  const tri = (modo, n) => (modo === 4 ? n / 3 : modo === 5 || modo === 6 ? Math.max(0, n - 2) : 0);
  const marcarDesenho = (modo, n, inst = 1) => {
    S.desenhosQuadro++; S.triQuadro += tri(modo, n) * inst; if (inst > 1) S.instQuadro += inst;
    if (!S.primeiroDesenhoEm) S.primeiroDesenhoEm = agora();
  };
  for (const P of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype].filter(Boolean)) {
    embrulhar(P, 'drawArrays', (a) => marcarDesenho(a[0], a[2]));
    embrulhar(P, 'drawElements', (a) => marcarDesenho(a[0], a[1]));
    embrulhar(P, 'drawArraysInstanced', (a) => marcarDesenho(a[0], a[2], a[3]));
    embrulhar(P, 'drawElementsInstanced', (a) => marcarDesenho(a[0], a[1], a[4]));
    embrulhar(P, 'activeTexture', function (a) { unidade.set(this, a[0] - 0x84C0); });
    embrulhar(P, 'bindTexture', function (a) { let m = ligadoTex.get(this); if (!m) ligadoTex.set(this, (m = new Map())); m.set(chaveTex(this, a[0]), a[1]); });
    embrulhar(P, 'createTexture', null, (a, t) => { S.tex++; const i = { bytes: 0 }; texInfo.set(t, i); vivas.add(i); });
    embrulhar(P, 'deleteTexture', (a) => { const i = texInfo.get(a[0]); if (i) { S.tex--; S.texBytes -= i.bytes; texInfo.delete(a[0]); vivas.delete(i); } });
    const definirTex = function (gl, target, level, bytes, faces = 1, w = 0, h = 0) {
      const t = texAtual(gl, target); const i = t && texInfo.get(t); if (!i) return;
      if (level === 0) { i.w = w; i.h = h; }
      S.uploadsTexQuadro++; S.bytesUploadQuadro += bytes;
      if (level !== 0) return;
      const ehFace = target >= 0x8515 && target <= 0x851A;
      const novo = ehFace ? (i.faces = (i.faces ?? 0) + 1, (i.face0 ?? (i.face0 = bytes)) * Math.min(6, i.faces)) : bytes * faces;
      S.texBytes += novo - i.bytes; i.bytes = novo;
    };
    embrulhar(P, 'texImage2D', function (a) {
      let w, h, fmt = a[2], type;
      if (a.length >= 8 && typeof a[3] === 'number') { w = a[3]; h = a[4]; type = a[7]; }
      else { const s = a[5]; w = s?.videoWidth || s?.naturalWidth || s?.width || 0; h = s?.videoHeight || s?.naturalHeight || s?.height || 0; type = a[4]; }
      definirTex(this, a[0], a[1], w * h * bpp(fmt, type), 1, w, h);
    });
    embrulhar(P, 'texStorage2D', function (a) {
      const [target, levels, fmt, w, h] = a; const base = w * h * bpp(fmt);
      const t = texAtual(this, target); const i = t && texInfo.get(t); if (!i) return;
      const total = (levels > 1 ? base * 4 / 3 : base) * (target === 0x8513 ? 6 : 1); i.w = w; i.h = h; i.mip = levels > 1;
      S.texBytes += total - i.bytes; i.bytes = total;
    });
    embrulhar(P, 'texImage3D', function (a) { if (typeof a[3] === 'number') definirTex(this, a[0], a[1], a[3] * a[4] * a[5] * bpp(a[2], a[8]), 1, a[3], a[4] * a[5]); });
    embrulhar(P, 'texSubImage2D', function () { S.uploadsTexQuadro++; });
    embrulhar(P, 'generateMipmap', function (a) { const t = texAtual(this, a[0]); const i = t && texInfo.get(t); if (i && !i.mip) { i.mip = 1; const n = i.bytes * 4 / 3; S.texBytes += n - i.bytes; i.bytes = n; } });
    embrulhar(P, 'createBuffer', null, (a, b) => { S.buf++; bufInfo.set(b, { bytes: 0 }); });
    embrulhar(P, 'deleteBuffer', (a) => { const i = bufInfo.get(a[0]); if (i) { S.buf--; S.bufBytes -= i.bytes; bufInfo.delete(a[0]); } });
    embrulhar(P, 'bindBuffer', function (a) { let m = ligadoBuf.get(this); if (!m) ligadoBuf.set(this, (m = new Map())); m.set(a[0], a[1]); });
    embrulhar(P, 'bufferData', function (a) {
      const b = ligadoBuf.get(this)?.get(a[0]); const i = b && bufInfo.get(b); if (!i) return;
      const n = typeof a[1] === 'number' ? a[1] : a[1]?.byteLength ?? 0; S.bufBytes += n - i.bytes; i.bytes = n;
    });
    embrulhar(P, 'createRenderbuffer', null, (a, r) => { S.rb++; rbInfo.set(r, { bytes: 0 }); });
    embrulhar(P, 'deleteRenderbuffer', (a) => { const i = rbInfo.get(a[0]); if (i) { S.rb--; S.rbBytes -= i.bytes; rbInfo.delete(a[0]); } });
    embrulhar(P, 'bindRenderbuffer', function (a) { ligadoRb.set(this, a[1]); });
    const rbDef = function (amostras, fmt, w, h) { const r = ligadoRb.get(this); const i = r && rbInfo.get(r); if (!i) return; const n = w * h * bpp(fmt) * Math.max(1, amostras); S.rbBytes += n - i.bytes; i.bytes = n; };
    embrulhar(P, 'renderbufferStorage', function (a) { rbDef.call(this, 1, a[1], a[2], a[3]); });
    embrulhar(P, 'renderbufferStorageMultisample', function (a) { rbDef.call(this, a[1], a[2], a[3], a[4]); });
    embrulhar(P, 'createProgram', null, () => { S.programas++; S.totalProgramas++; });
    embrulhar(P, 'deleteProgram', () => { S.programas--; });
    embrulhar(P, 'createShader', null, () => { S.shaders++; });
    embrulhar(P, 'deleteShader', () => { S.shaders--; });
    // compilação: o custo aparece em compileShader/linkProgram e na primeira consulta de estado (que espera o driver)
    for (const nome of ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog']) {
      embrulhar(P, nome, () => agora(), (a, r, t0) => {
        const d = agora() - t0; S.compilarMs += d; S.totalCompilarMs += d;
        if (nome === 'linkProgram') S.compilacoes++;
        if (d > S.maiorCompilarMs) S.maiorCompilarMs = d;
      });
    }
  }
  // tempo de CPU de cada quadro (callback do requestAnimationFrame) + o que o quadro desenhou
  const rafOrig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rafOrig((ts) => {
    S.desenhosQuadro = 0; S.triQuadro = 0; S.instQuadro = 0; S.uploadsTexQuadro = 0; S.bytesUploadQuadro = 0;
    const t0 = agora();
    try { cb(ts); } finally {
      const cpu = agora() - t0;
      if (S.desenhosQuadro > 0) {
        S.quadros.push([t0, cpu, S.desenhosQuadro, S.triQuadro, S.uploadsTexQuadro, S.bytesUploadQuadro]);
        if (S.quadros.length > N) S.quadros.shift();
      }
    }
  });
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { S.longas.push([e.startTime, e.duration]); if (S.longas.length > 400) S.longas.shift(); } })
      .observe({ type: 'longtask', buffered: true });
  } catch { /* sem suporte */ }
  // rede: tamanho e quantidade das mensagens dos canais de dados (WebRTC), por rótulo
  S.rede = { env: 0, envBytes: 0, rec: 0, recBytes: 0, hist: [] };
  const tam = (d) => (typeof d === 'string' ? d.length : d?.byteLength ?? d?.size ?? 0);
  if (window.RTCDataChannel) {
    const envOrig = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (d) { const n = tam(d); S.rede.env++; S.rede.envBytes += n; S.rede.hist.push([agora(), n]); if (S.rede.hist.length > 4000) S.rede.hist.shift(); return envOrig.call(this, d); };
  }
})();
// Rede simulada (só quando window.__redeSim = { lat, jitter, perda } é definido antes da conexão): atrasa cada
// mensagem RECEBIDA pelo canal de dados em lat ± jitter ms, mantendo a ordem (canal confiável e ordenado, como o do
// PeerJS); uma "perda" vira retransmissão: a mensagem e as seguintes esperam mais 2×lat + 60 ms (bloqueio na fila).
// É um MODELO do SCTP confiável, não a pilha real (o CDP não limita WebRTC).
(() => {
  if (!window.RTCDataChannel || window.__redeSimInstalada) return;
  window.__redeSimInstalada = true;
  const d = Object.getOwnPropertyDescriptor(RTCDataChannel.prototype, 'onmessage');
  let ultima = 0;
  const atrasar = (h) => function (ev) {
    const c = window.__redeSim;
    if (!c || !h) return h?.call(this, ev);
    const t = performance.now();
    let atraso = (c.lat ?? 0) + (Math.random() * 2 - 1) * (c.jitter ?? 0);
    if (Math.random() * 100 < (c.perda ?? 0)) atraso += 2 * (c.lat ?? 0) + 60;
    const em = Math.max(ultima, t + Math.max(0, atraso));
    ultima = em;
    const self = this, dado = ev.data;
    setTimeout(() => h.call(self, new MessageEvent('message', { data: dado })), em - t);
  };
  // o PeerJS 1.5 escuta com addEventListener('message', …) (o onmessage dele só registra log)
  const addOrig = RTCDataChannel.prototype.addEventListener;
  RTCDataChannel.prototype.addEventListener = function (tipo, h, ...r) {
    if (tipo === 'message' && typeof h === 'function') return addOrig.call(this, tipo, atrasar(h), ...r);
    return addOrig.call(this, tipo, h, ...r);
  };
  Object.defineProperty(RTCDataChannel.prototype, 'onmessage', {
    configurable: true, get() { return d.get.call(this); }, set(h) { d.set.call(this, h ? atrasar(h) : h); },
  });
})();
