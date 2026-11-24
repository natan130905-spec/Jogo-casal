// Mapas de apoio dos capítulos (gerados por `npm run apoio`, ver src/core/companheiro/apoio.ts). Carregados sob
// demanda, junto com a fase: cada capN.json vira um pedaço separado no build e só baixa quando o companheiro precisa.
import { lerMapa, type MapaApoio, type MapaApoioJson } from '../../companheiro/apoio';

const arquivos = import.meta.glob<MapaApoioJson>('./cap*.json', { import: 'default' });

/** Mapa de apoio do capítulo n (1–7), ou null se não houver. */
export async function carregarApoio(capitulo: number): Promise<MapaApoio | null> {
  const carregar = arquivos[`./cap${capitulo}.json`];
  return carregar ? lerMapa(await carregar()) : null;
}
