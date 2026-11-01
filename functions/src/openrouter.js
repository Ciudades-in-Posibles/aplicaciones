/**
 * Cliente OpenRouter ejecutado exclusivamente en el backend (Cloud Functions).
 * La clave de API se recibe del Secret Manager y el modelo está fijado a google/gemini-3.8-flash.
 */

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_ID = 'google/gemini-3.8-flash';

/**
 * Llama a OpenRouter desde el servidor de forma segura.
 * @param {{ apiKey: string, messages: any[], effort?: string, maxTokens?: number, timeoutMs?: number }} opciones
 * @returns {Promise<any>} Objeto JSON devuelto por el modelo
 */
export async function callOpenRouterBackend({
  apiKey,
  messages,
  effort = 'low',
  maxTokens = 1024,
  timeoutMs = 50000
}) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('No se configuró la clave de OpenRouter en el servidor (OPENROUTER_API_KEY).');
  }

  const payload = {
    model: MODEL_ID, // Fijo en el servidor: ningún cliente puede solicitar otros modelos
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  };

  if (effort && effort !== 'none') {
    payload.reasoning = { effort };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ciudadesinposibles.net',
        'X-Title': 'Ciudades(In)Posibles Backend'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Error de OpenRouter en servidor:', response.status, errorText);
      throw new Error(`OpenRouter respondió con error ${response.status}.`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Respuesta vacía de OpenRouter:', data);
      throw new Error('OpenRouter respondió en blanco.');
    }

    try {
      return JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      console.error('Error parseando JSON devuelto por OpenRouter:', content);
      throw new Error('No se pudo interpretar la respuesta estructurada del modelo.');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('La consulta a OpenRouter agotó el tiempo de espera.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
