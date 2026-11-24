// Testes lentos (npm run test:lento, L2a): busca completa de alcance (folga ≥ 100), janela de decolagem e
// visibilidade com a câmera do render. Ficam fora do `npm test` (levam minutos); rode antes de mexer em física,
// colisão ou fases. Um arquivo por capítulo, para o vitest rodar em paralelo.
import { defineConfig } from 'vite';
export default defineConfig({ test: { include: ['test/lento/**/*.lento.ts'], testTimeout: 1_800_000, hookTimeout: 1_800_000 } });
