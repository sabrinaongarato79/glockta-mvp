const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

function isMpConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function getClient() {
  if (!isMpConfigured()) return null;
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
}

/**
 * Crea una preferencia de pago de Mercado Pago Checkout Pro para una orden.
 * Devuelve { id, init_point } o null si Mercado Pago no está configurado.
 */
async function createPreference(order, items, baseUrl) {
  const client = getClient();
  if (!client) return null;

  const preference = new Preference(client);
  const result = await preference.create({
    body: {
      items: items.map(i => ({
        title: String(i.name || 'Producto GLOCKTA').slice(0, 200),
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.price) || 0,
        currency_id: 'ARS'
      })),
      payer: { email: order.customer_email, name: order.customer_name },
      external_reference: String(order.id),
      back_urls: {
        success: `${baseUrl}/api/mp/return?status=success`,
        failure: `${baseUrl}/api/mp/return?status=failure`,
        pending: `${baseUrl}/api/mp/return?status=pending`
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/mp/webhook`,
      statement_descriptor: 'GLOCKTA'
    }
  });

  return { id: result.id, init_point: result.init_point, sandbox_init_point: result.sandbox_init_point };
}

/** Consulta el estado real de un pago en Mercado Pago a partir de su ID. */
async function getPayment(paymentId) {
  const client = getClient();
  if (!client) return null;
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

module.exports = { isMpConfigured, createPreference, getPayment };
