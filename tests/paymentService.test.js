const test = require('node:test');
const assert = require('node:assert/strict');

test('paymentService: isMpConfigured() es false sin MP_ACCESS_TOKEN', () => {
  delete process.env.MP_ACCESS_TOKEN;
  delete require.cache[require.resolve('../src/services/paymentService')];
  const paymentService = require('../src/services/paymentService');
  assert.equal(paymentService.isMpConfigured(), false);
});

test('paymentService: createPreference() devuelve null en modo demo (sin credenciales)', async () => {
  delete process.env.MP_ACCESS_TOKEN;
  delete require.cache[require.resolve('../src/services/paymentService')];
  const paymentService = require('../src/services/paymentService');
  const result = await paymentService.createPreference({ id: 1, customer_email: 'a@a.com' }, [], 'http://localhost:3000');
  assert.equal(result, null);
});
