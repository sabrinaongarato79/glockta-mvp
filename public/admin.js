const $ = id => document.getElementById(id);
const escapeHtml = str => String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (v, c = 'ARS') => `$${Number(v || 0).toLocaleString('es-AR')} ${c}`;
const fmtDate = d => d ? new Date(d).toLocaleString('es-AR') : '—';

function getToken() { return sessionStorage.getItem('glockta-admin-token') || ''; }
function setToken(t) { sessionStorage.setItem('glockta-admin-token', t); }

async function loadOverview() {
  const res = await fetch('/api/admin/overview', { headers: { 'x-admin-token': getToken() } });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('No se pudo cargar la información.');
  return res.json();
}

function renderDashboard(data) {
  $('kpiLeads').textContent = data.leads?.length || 0;
  $('kpiAppointments').textContent = data.appointments?.length || 0;
  $('kpiOrders').textContent = data.orders?.length || 0;
  $('kpiSignups').textContent = data.trainingSignups?.length || 0;

  $('leadsBody').innerHTML = (data.leads || []).map(l => `<tr>
    <td>${escapeHtml(l.company_name)}</td><td>${escapeHtml(l.contact_name)}</td><td>${escapeHtml(l.email)}</td>
    <td>${escapeHtml(l.service)}</td><td><span class="badge ${escapeHtml(l.status)}">${escapeHtml(l.status)}</span></td><td>${fmtDate(l.created_at)}</td>
  </tr>`).join('') || '<tr><td colspan="6" class="status">Sin leads todavía.</td></tr>';

  $('apptBody').innerHTML = (data.appointments || []).map(a => `<tr>
    <td>${escapeHtml(a.user_name)}</td><td>${escapeHtml(a.user_email)}</td><td>${escapeHtml(a.reason)}</td>
    <td>${fmtDate(a.scheduled_at)}</td><td><span class="badge ${escapeHtml(a.status)}">${escapeHtml(a.status)}</span></td>
  </tr>`).join('') || '<tr><td colspan="5" class="status">Sin turnos todavía.</td></tr>';

  $('ordersBody').innerHTML = (data.orders || []).map(o => `<tr>
    <td>${escapeHtml(o.customer_name)}</td><td>${escapeHtml(o.customer_email)}</td><td>${money(o.total, o.currency)}</td>
    <td><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td><td>${fmtDate(o.created_at)}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="status">Sin órdenes todavía.</td></tr>';

  $('signupsBody').innerHTML = (data.trainingSignups || []).map(s => `<tr>
    <td>${escapeHtml(s.full_name)}</td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.training_name)}</td><td>${fmtDate(s.created_at)}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="status">Sin inscripciones todavía.</td></tr>';
}

async function tryEnter() {
  $('gateStatus').textContent = 'Verificando…';
  try {
    const data = await loadOverview();
    $('gate').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    renderDashboard(data);
    if (data.demo) $('gateStatus').textContent = '';
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') $('gateStatus').textContent = 'Token incorrecto. Revisá ADMIN_TOKEN en tu .env.';
    else $('gateStatus').textContent = err.message;
  }
}

$('enterBtn').addEventListener('click', () => { setToken($('tokenInput').value.trim()); tryEnter(); });
$('tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('enterBtn').click(); });
$('refreshBtn').addEventListener('click', async () => { try { renderDashboard(await loadOverview()); } catch { /* noop */ } });

// Si ya había un token guardado en esta pestaña, entramos directo.
if (getToken()) tryEnter();
