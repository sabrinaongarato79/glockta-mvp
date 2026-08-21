const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!isAiConfigured()) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Extrae del relato libre de una persona (texto tipo "le cuento a un amigo qué hice hasta hoy")
 * un objetivo laboral, habilidades e idiomas estructurados para el Career Passport.
 * Pensado para bajar la barrera de entrada a personas con poca práctica armando un CV formal.
 */
async function parseProfileFromText(freeText) {
  const client = getClient();
  if (!client) return null;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: 'Sos un asistente de empleabilidad inclusivo. A partir de un relato informal en español (Argentina) sobre la experiencia de una persona, extraés un objetivo laboral breve, una lista de habilidades (técnicas y blandas, en minúscula, sin duplicar conceptos) y una lista de idiomas mencionados o implícitos (siempre incluí "español"). No inventes habilidades que la persona no mencionó ni insinuó. Si el relato es muy corto o vago, hacé la mejor inferencia razonable sin inventar experiencia concreta. Respondé ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta: {"goal": string, "skills": string[], "languages": string[]}.',
    messages: [{ role: 'user', content: freeText.slice(0, 3000) }]
  });

  const text = message.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  return {
    goal: String(parsed.goal || '').slice(0, 200),
    skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 15).map(s => String(s).slice(0, 60)) : [],
    languages: Array.isArray(parsed.languages) ? parsed.languages.slice(0, 8).map(s => String(s).slice(0, 40)) : []
  };
}

/**
 * Convierte el resultado explicable del MatchingService (coincidencias/brechas en listas)
 * en un párrafo con tono de mentor humano. Sigue siendo explicable: la IA sólo redacta
 * mejor los mismos datos que ya calculó MatchingService, no inventa un puntaje nuevo.
 */
async function explainMatch({ jobTitle, score, matched, gaps }) {
  const client = getClient();
  if (!client) return null;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: 'Sos un mentor de empleo cálido, directo y breve (máximo 3 frases cortas). Nunca inventes datos que no te dieron. Hablá en español rioplatense, en segunda persona ("vos"), con tono alentador pero honesto. No repitas literalmente las listas, integralas en una explicación natural.',
    messages: [{
      role: 'user',
      content: `Puesto: ${jobTitle}\nPuntaje de compatibilidad: ${score}%\nCoincidencias: ${matched.join(', ') || 'ninguna detectada'}\nBrechas: ${gaps.join(', ') || 'ninguna detectada'}\n\nEscribí el consejo para la persona candidata.`
    }]
  });

  return message.content?.[0]?.text?.trim() || null;
}

module.exports = { isAiConfigured, parseProfileFromText, explainMatch };
