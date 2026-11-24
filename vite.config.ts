import { defineConfig } from 'vite';
// testTimeout: os testes de alcançabilidade e de balanceamento com bots são cálculo determinístico (não medem
// velocidade); com a máquina carregada passavam dos 5 s padrão do vitest e falhavam por tempo, não por resultado.
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 1500 }, test: { testTimeout: 30000 } });
