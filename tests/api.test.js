const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Aislamos el estado de configuración para que estas pruebas de integración
// sean deterministas sin importar qué .env tenga la máquina que las corre.
delete process.env.SUPABASE_URL;
delete process.env.MP_ACCESS_TOKEN;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ADMIN_TOKEN;

const app = require('../src/server');

let server;
let baseUrl;

test.before(() => new Promise(resolve => {
  server = http.createServer(app).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

test.after(() => new Promise(resolve => server.close(resolve)));

test('GET /api/health responde ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('GET /api/config expone las banderas de integraciones sin filtrar secretos', async () => {
  const res = await fetch(`${baseUrl}/api/config`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.aiEnabled, false);
  assert.equal(body.mercadoPagoEnabled, false);
  assert.ok(!('supabaseServiceRoleKey' in body), 'la service role key nunca debe exponerse al frontend');
  assert.ok(!('mpAccessToken' in body), 'el access token de Mercado Pago nunca debe exponerse al frontend');
});

test('POST /api/ai/parse-profile sin ANTHROPIC_API_KEY responde 503 con mensaje claro', async () => {
  const res = await fetch(`${baseUrl}/api/ai/parse-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'trabajé en atención al cliente' })
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'AI_NOT_CONFIGURED');
});

test('POST /api/ai/parse-profile sin texto responde 400', async () => {
  const res = await fetch(`${baseUrl}/api/ai/parse-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
});

test('POST /api/match calcula compatibilidad de forma explicable (sin IA)', async () => {
  const res = await fetch(`${baseUrl}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: { skills: ['excel'], languages: ['español'] },
      job: { title: 'Vacante', description: 'Se requiere excel y sql' }
    })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.score, 50);
  assert.ok(body.matched.includes('excel'));
  assert.ok(body.gaps.includes('sql'));
});

test('POST /api/checkout sin email responde 400', async () => {
  const res = await fetch(`${baseUrl}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: 'demo-item', name: 'Ebook demo', price: 1000, quantity: 1 }] })
  });
  assert.equal(res.status, 400);
});

test('POST /api/checkout en modo demo (sin Mercado Pago) crea una orden pendiente sin cobrar de verdad', async () => {
  const res = await fetch(`${baseUrl}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test',
      customer_email: 'test@example.com',
      items: [{ id: 'demo-item', name: 'Ebook demo', price: 1000, quantity: 1 }]
    })
  });
  assert.ok([200, 201, 202].includes(res.status));
  const body = await res.json();
  assert.equal(body.checkoutUrl, undefined, 'sin MP_ACCESS_TOKEN no debe generar una URL de pago real');
});

test('GET /api/admin/overview sin ADMIN_TOKEN configurado queda abierto en modo demo (documentado como limitación del MVP)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/overview`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.demo, true);
});

test('GET /api/admin/overview con ADMIN_TOKEN configurado exige el header correcto', async () => {
  process.env.ADMIN_TOKEN = 'secreto-de-prueba';
  try {
    const withoutHeader = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(withoutHeader.status, 401);

    const withWrongHeader = await fetch(`${baseUrl}/api/admin/overview`, { headers: { 'x-admin-token': 'incorrecto' } });
    assert.equal(withWrongHeader.status, 401);

    const withRightHeader = await fetch(`${baseUrl}/api/admin/overview`, { headers: { 'x-admin-token': 'secreto-de-prueba' } });
    assert.equal(withRightHeader.status, 200);
  } finally {
    delete process.env.ADMIN_TOKEN;
  }
});
