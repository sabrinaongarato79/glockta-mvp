require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { searchJobs } = require('./services/jobService');
const { calculateMatch } = require('./services/matchingService');
const { getSupabaseAdmin } = require('./supabase');
const paymentService = require('./services/paymentService');
const aiService = require('./services/aiService');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');
const getBaseUrl = req => process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 100 }));
app.use(express.static(publicDir));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'GLOCKTA', version: '0.1.0' }));

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    defaultJobProvider: process.env.JOB_PROVIDER || 'demo',
    whatsappNumber: process.env.WHATSAPP_NUMBER || '',
    contactEmail: process.env.CONTACT_EMAIL || '',
    mercadoPagoEnabled: paymentService.isMpConfigured(),
    aiEnabled: aiService.isAiConfigured()
  });
});

// ---- Asistente de IA: completar el Career Passport a partir de un relato libre ----
app.post('/api/ai/parse-profile', async (req, res) => {
  const freeText = String(req.body.text || '').trim();
  if (!freeText) return res.status(400).json({ error: 'TEXT_REQUIRED' });
  if (!aiService.isAiConfigured()) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'Falta configurar ANTHROPIC_API_KEY en el .env para usar el asistente de IA.' });
  }
  try {
    const profile = await aiService.parseProfileFromText(freeText);
    res.json({ profile });
  } catch (err) {
    res.status(502).json({ error: 'AI_ERROR', message: err.message });
  }
});

// ---- Asistente de IA: explicación del match con tono de mentor ----
app.post('/api/ai/match-explanation', async (req, res) => {
  const { jobTitle, score, matched, gaps } = req.body || {};
  if (!aiService.isAiConfigured()) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'Falta configurar ANTHROPIC_API_KEY en el .env para usar el asistente de IA.' });
  }
  try {
    const explanation = await aiService.explainMatch({
      jobTitle: String(jobTitle || '').slice(0, 160),
      score: Number(score) || 0,
      matched: Array.isArray(matched) ? matched.slice(0, 10) : [],
      gaps: Array.isArray(gaps) ? gaps.slice(0, 10) : []
    });
    res.json({ explanation });
  } catch (err) {
    res.status(502).json({ error: 'AI_ERROR', message: err.message });
  }
});

app.post('/api/jobs/search', async (req, res) => {
  try {
    const keywords = String(req.body.keywords || '').slice(0, 120);
    const location = String(req.body.location || '').slice(0, 120);
    const provider = String(req.body.provider || '').slice(0, 20) || undefined;
    const result = await searchJobs({ keywords, location }, provider);
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: 'PROVIDER_UNAVAILABLE', message: error.message, fallback: 'demo' });
  }
});

app.post('/api/match', (req, res) => {
  const profile = req.body.profile || {};
  const job = req.body.job || {};
  res.json(calculateMatch(profile, job));
});

// ---- Glockta Store: catálogo, carrito/checkout y capacitaciones gratuitas ----
const DEMO_PRODUCTS = [
  { id: 'demo-ebook-cv', name: 'CV que abre puertas', product_type: 'ebook', description: 'Guía práctica para transformar experiencia en valor profesional.', price: 4900, currency: 'ARS' },
  { id: 'demo-guide-interview', name: 'Entrevistas con estrategia', product_type: 'guide', description: 'Preguntas, estructura y preparación para entrevistas reales.', price: 3900, currency: 'ARS' },
  { id: 'demo-course-linkedin', name: 'LinkedIn que consigue entrevistas', product_type: 'course', description: 'Microcurso para optimizar tu perfil y tu red en 7 días.', price: 6900, currency: 'ARS' },
  { id: 'demo-checklist', name: 'Checklist de empleabilidad', product_type: 'guide', description: 'Primer diagnóstico rápido para ordenar tu búsqueda laboral.', price: 0, currency: 'ARS' },
  { id: 'demo-ebook-reconversion', name: 'Reconversión laboral sin miedo', product_type: 'ebook', description: 'Guía para cambiar de rubro o volver al mercado laboral después de una pausa, a cualquier edad.', price: 5200, currency: 'ARS' },
  { id: 'demo-ebook-negociacion', name: 'Negociá tu sueldo', product_type: 'ebook', description: 'Estrategias concretas para negociar una oferta laboral sin subestimarte.', price: 4500, currency: 'ARS' },
  { id: 'demo-course-accesibilidad', name: 'Trabajo remoto accesible', product_type: 'course', description: 'Curso corto sobre herramientas y ajustes para trabajar cómodo con cualquier necesidad de accesibilidad.', price: 7900, currency: 'ARS' }
];
const DEMO_TRAININGS = [
  { id: 'demo-training-cv', name: 'Cómo armar tu CV sin experiencia', product_type: 'course', description: 'Capacitación en vivo gratuita, 60 minutos + preguntas.', price: 0, currency: 'ARS' },
  { id: 'demo-training-a11y', name: 'Accesibilidad digital para pymes', product_type: 'course', description: 'Capacitación en vivo gratuita sobre accesibilidad web aplicada a sitios reales.', price: 0, currency: 'ARS' }
];

app.get('/api/products', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.json({ demo: true, products: DEMO_PRODUCTS, trainings: DEMO_TRAININGS });
  const { data, error } = await supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const rows = data && data.length ? data : [...DEMO_PRODUCTS, ...DEMO_TRAININGS];
  const products = rows.filter(p => Number(p.price) > 0);
  const trainings = rows.filter(p => !(Number(p.price) > 0));
  res.json({ products, trainings });
});

app.post('/api/checkout', async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 20) : [];
  const customer_name = String(req.body.customer_name || '').slice(0, 120);
  const customer_email = String(req.body.customer_email || '').slice(0, 160);
  if (!items.length) return res.status(400).json({ error: 'CART_EMPTY' });
  if (!customer_email) return res.status(400).json({ error: 'EMAIL_REQUIRED' });
  const total = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const orderPayload = { customer_name, customer_email, total, currency: 'ARS', status: 'pending' };
  const supabase = getSupabaseAdmin();

  // Los ítems gratuitos (price 0) se registran directo, sin pasar por Mercado Pago.
  const payableItems = items.filter(i => (Number(i.price) || 0) > 0);

  if (!supabase) {
    // Modo demo (sin Supabase): igual podemos generar un checkout real de Mercado Pago si hay credenciales.
    const demoOrder = { id: `demo-${Date.now()}`, ...orderPayload, items };
    if (paymentService.isMpConfigured() && payableItems.length) {
      try {
        const pref = await paymentService.createPreference(demoOrder, payableItems, getBaseUrl(req));
        return res.status(202).json({ demo: true, order: demoOrder, checkoutUrl: pref.init_point || pref.sandbox_init_point, message: 'Te llevamos a Mercado Pago para completar el pago.' });
      } catch (err) {
        return res.status(202).json({ demo: true, order: demoOrder, message: `No se pudo iniciar Mercado Pago (${err.message}). Orden registrada en modo demo.` });
      }
    }
    return res.status(202).json({
      demo: true,
      order: demoOrder,
      message: 'Orden registrada en modo demo. Conectá Supabase y Mercado Pago (.env) para cobrar de verdad.'
    });
  }

  const { data: order, error } = await supabase.from('orders').insert(orderPayload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const orderItems = items.map(i => ({
    order_id: order.id,
    product_id: /^[0-9a-f-]{36}$/i.test(String(i.id)) ? i.id : null,
    product_name: String(i.name || '').slice(0, 160),
    unit_price: Number(i.price) || 0,
    quantity: Number(i.quantity) || 1
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) return res.status(400).json({ error: itemsError.message });

  // Sin ítems pagos (todo gratis) o Mercado Pago sin configurar: la orden queda registrada y punto.
  if (!payableItems.length || !paymentService.isMpConfigured()) {
    return res.status(201).json({
      order,
      message: payableItems.length
        ? 'Orden registrada. Falta conectar Mercado Pago (MP_ACCESS_TOKEN en .env) para cobrar automáticamente.'
        : 'Inscripción registrada, no requiere pago.'
    });
  }

  try {
    const pref = await paymentService.createPreference(order, payableItems, getBaseUrl(req));
    await supabase.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id);
    res.status(201).json({ order, checkoutUrl: pref.init_point || pref.sandbox_init_point, message: 'Te llevamos a Mercado Pago para completar el pago.' });
  } catch (err) {
    res.status(201).json({ order, message: `Orden registrada pero no se pudo iniciar Mercado Pago (${err.message}).` });
  }
});

// ---- Mercado Pago: webhook de confirmación de pago ----
app.post('/api/mp/webhook', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id;
    const topic = req.body?.type || req.query.type || req.query.topic;
    if (!paymentId || (topic && topic !== 'payment')) return res.sendStatus(200);

    const payment = await paymentService.getPayment(paymentId);
    const orderId = payment?.external_reference;
    const status = payment?.status; // approved | pending | rejected | ...
    const supabase = getSupabaseAdmin();
    if (supabase && orderId) {
      const mapped = status === 'approved' ? 'paid' : status === 'rejected' ? 'cancelled' : 'pending';
      await supabase.from('orders').update({ status: mapped, mp_payment_id: String(paymentId) }).eq('id', orderId);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('MP webhook error', err.message);
    res.sendStatus(200); // Mercado Pago reintenta si no devolvemos 200; evitamos reintentos infinitos por errores nuestros.
  }
});

// ---- Mercado Pago: retorno del comprador (success/failure/pending) ----
app.get('/api/mp/return', (req, res) => {
  const status = String(req.query.status || 'pending');
  res.redirect(`/?payment=${encodeURIComponent(status)}#biblioteca`);
});

app.post('/api/trainings/signup', async (req, res) => {
  const payload = {
    training_name: String(req.body.training_name || '').slice(0, 160),
    full_name: String(req.body.full_name || '').slice(0, 120),
    email: String(req.body.email || '').slice(0, 160)
  };
  if (!payload.training_name || !payload.email) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(202).json({ demo: true, signup: { id: `demo-${Date.now()}`, ...payload } });
  const { data, error } = await supabase.from('training_signups').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ signup: data });
});

app.post('/api/appointments', async (req, res) => {
  const payload = {
    user_name: String(req.body.user_name || '').slice(0, 120),
    user_email: String(req.body.user_email || '').slice(0, 160),
    reason: String(req.body.reason || '').slice(0, 240),
    scheduled_at: req.body.scheduled_at || null,
    status: 'requested'
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(202).json({ demo: true, appointment: { id: `demo-${Date.now()}`, ...payload } });
  const { data, error } = await supabase.from('appointments').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ appointment: data });
});

app.post('/api/contact/business', async (req, res) => {
  const payload = {
    company_name: String(req.body.company_name || '').slice(0, 160),
    contact_name: String(req.body.contact_name || '').slice(0, 120),
    email: String(req.body.email || '').slice(0, 160),
    service: String(req.body.service || '').slice(0, 120),
    message: String(req.body.message || '').slice(0, 1000),
    status: 'new'
  };
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(202).json({ demo: true, lead: { id: `demo-${Date.now()}`, ...payload } });
  const { data, error } = await supabase.from('business_leads').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ lead: data });
});

// ---- Panel de administración (rol "business/admin") ----
// Acceso simple por token compartido (ADMIN_TOKEN en .env), pensado para que la mesa de tesis
// pueda ver un segundo rol de usuario (gestión) distinto del candidato que usa el sitio público.
// DEMO_ADMIN_DATA sostiene el panel funcionando aunque todavía no haya Supabase conectado.
const DEMO_ADMIN_DATA = {
  leads: [{ id: 'demo-lead-1', company_name: 'Acme SRL', contact_name: 'Juan Pérez', email: 'juan@acme.com', service: 'Landing inclusiva', status: 'new', created_at: new Date().toISOString() }],
  appointments: [{ id: 'demo-appt-1', user_name: 'Sabrina Ongarato', user_email: 'sabrina@example.com', reason: 'CV', scheduled_at: new Date().toISOString(), status: 'requested' }],
  orders: [{ id: 'demo-order-1', customer_name: 'Sabrina Ongarato', customer_email: 'sabrina@example.com', total: 4900, currency: 'ARS', status: 'pending', created_at: new Date().toISOString() }],
  trainingSignups: [{ id: 'demo-signup-1', training_name: 'Cómo armar tu CV sin experiencia', full_name: 'Sabrina Ongarato', email: 'sabrina@example.com', created_at: new Date().toISOString() }]
};

function requireAdminToken(req, res, next) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return next(); // Sin ADMIN_TOKEN configurado, el panel queda abierto en modo demo local.
  const provided = req.get('x-admin-token') || req.query.token;
  if (provided !== configured) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de administrador inválido o faltante.' });
  next();
}

app.get('/api/admin/overview', requireAdminToken, async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.json({ demo: true, ...DEMO_ADMIN_DATA });

  const [leads, appointments, orders, trainingSignups] = await Promise.all([
    supabase.from('business_leads').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('appointments').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100),
    supabase.from('training_signups').select('*').order('created_at', { ascending: false }).limit(100)
  ]);
  const firstError = [leads, appointments, orders, trainingSignups].find(r => r.error);
  if (firstError) return res.status(500).json({ error: firstError.error.message });

  res.json({
    demo: false,
    leads: leads.data,
    appointments: appointments.data,
    orders: orders.data,
    trainingSignups: trainingSignups.data
  });
});

app.get('/*splat', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(port, () => console.log(`GLOCKTA running on http://localhost:${port}`));
