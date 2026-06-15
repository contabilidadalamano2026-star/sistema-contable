// config.js
// En producción (Vercel) usamos la ruta relativa, ya que backend y frontend comparten el mismo dominio
export const API_URL = import.meta.env.PROD ? 'https://frontend-v2-contabilidadalamano.vercel.app/api' : 'http://localhost:8001/api';
export default API_URL;
