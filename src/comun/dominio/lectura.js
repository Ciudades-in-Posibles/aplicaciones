/**
 * Lectura de una toma por el LLM: una descripción corta y el filtro.
 * El filtro falla de forma segura: si la respuesta no trae los campos, la toma no sale.
 */

export const MAX_DESCRIPCION = 240;

export const PROMPT_LECTURA = `Eres el Transmisor de Ciudades(In)Posibles, un juego en el que equipos de una niña o un niño con una persona adulta miran la ciudad a través de canales y registran tomas en blanco y negro.
Recibes una toma registrada en el canal {canal} («{nombre}»), cuya lente dice: «{lente}».

Responde ÚNICAMENTE un objeto JSON con estos campos:
{
  "descripcion": "Una o dos oraciones, de hasta 20 palabras cada una, en español latino neutro. Di lo que hay en el lugar, no en la foto: «Una raíz levanta el adoquín junto al muro». Mirada atenta a lo pequeño. Sin nombrar personas, sin jerga técnica, sin signos de exclamación, sin emojis.",
  "rostros_reconocibles": true o false,
  "inadecuada": true o false,
  "motivo": "Si alguno de los dos es true, una frase breve sin describir a nadie; si no, cadena vacía."
}

Reglas del filtro:
- "rostros_reconocibles" es true si se ve el rostro reconocible de al menos una persona real: una cara de frente o de perfil con rasgos identificables. No cuentan las personas lejanas sin rasgos distinguibles, de espaldas o con la cara cubierta, ni los rostros de murales, afiches, pantallas, estatuas, dibujos o maniquíes.
- "inadecuada" es true si la toma muestra desnudez, violencia explícita, contenido sexual, armas en uso, datos que identifican a alguien (placas legibles, documentos, pantallas con datos personales) o algo que no deba ver una niña o un niño de 8 años.
- Si cualquiera es true, "descripcion" va vacía.`;

/**
 * @param {{n: number, nombre: string, lente: string}} canal
 */
export function promptLectura(canal) {
  return PROMPT_LECTURA
    .replace('{canal}', String(canal.n))
    .replace('{nombre}', canal.nombre)
    .replace('{lente}', canal.lente);
}

/**
 * Valida la respuesta del modelo.
 * @returns {{ok: true, descripcion: string} | {ok: false, motivo: string, tipo: 'rostro'|'inadecuada'|'invalida'}}
 */
export function validarLectura(r) {
  if (!r || typeof r !== 'object'
    || typeof r.rostros_reconocibles !== 'boolean'
    || typeof r.inadecuada !== 'boolean') {
    return { ok: false, tipo: 'invalida', motivo: 'No alcancé a leer esta toma.' };
  }
  if (r.rostros_reconocibles) {
    return { ok: false, tipo: 'rostro', motivo: 'Aquí aparece alguien. Probemos otra toma donde solo esté la ciudad.' };
  }
  if (r.inadecuada) {
    return { ok: false, tipo: 'inadecuada', motivo: 'Esta toma no sale al aire. Probemos con otra.' };
  }
  const descripcion = typeof r.descripcion === 'string' ? r.descripcion.trim().slice(0, MAX_DESCRIPCION) : '';
  return { ok: true, descripcion };
}
