const test = require('node:test');
const assert = require('node:assert/strict');

// Estas pruebas no llaman a la API real de Anthropic: verifican el comportamiento
// de "modo demo" (degradación segura) cuando falta ANTHROPIC_API_KEY, que es el
// estado por defecto del proyecto sin configurar.
test('aiService: isAiConfigured() es false sin ANTHROPIC_API_KEY', () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete require.cache[require.resolve('../src/services/aiService')];
  const aiService = require('../src/services/aiService');
  assert.equal(aiService.isAiConfigured(), false);
});

test('aiService: isAiConfigured() es true cuando la variable de entorno está presente', () => {
  process.env.ANTHROPIC_API_KEY = 'test-key-fake';
  delete require.cache[require.resolve('../src/services/aiService')];
  const aiService = require('../src/services/aiService');
  assert.equal(aiService.isAiConfigured(), true);
  delete process.env.ANTHROPIC_API_KEY;
});

test('aiService: parseProfileFromText() devuelve null en modo demo (sin clave) en vez de fallar', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete require.cache[require.resolve('../src/services/aiService')];
  const aiService = require('../src/services/aiService');
  const result = await aiService.parseProfileFromText('trabajé atendiendo clientes');
  assert.equal(result, null);
});

test('aiService: explainMatch() devuelve null en modo demo (sin clave) en vez de fallar', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete require.cache[require.resolve('../src/services/aiService')];
  const aiService = require('../src/services/aiService');
  const result = await aiService.explainMatch({ jobTitle: 'Marketing', score: 80, matched: [], gaps: [] });
  assert.equal(result, null);
});
