let config = {};
let supabaseClient = null;
let currentUser = null;
let profile = { name:'', goal:'', skills:[], languages:[] };

const $ = id => document.getElementById(id);
const splitValues = value => value.split(',').map(v=>v.trim()).filter(Boolean);

async function loadConfig(){
  try{
    config = await fetch('/api/config').then(r=>r.json());
    if(config.whatsappNumber) CONTACT_WHATSAPP = config.whatsappNumber;
    if(config.contactEmail) CONTACT_EMAIL = config.contactEmail;
    renderFooterContact();
    setupWhatsappFloat();
    if(config.supabaseUrl && config.supabaseAnonKey && window.supabase){
      supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        await renderAuthState();
        if(currentUser) await loadRemoteProfile();
        await loadCourseProgress(); renderCourse(); updateCourseProgressBar();
      });
      const { data } = await supabaseClient.auth.getSession();
      currentUser = data.session?.user || null;
    }
  }catch(e){console.warn('Config unavailable',e)}
}

function escapeHtml(str){return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function renderProfile(){
  $('passportName').textContent = profile.name || 'Tu nombre';
  $('passportGoal').textContent = profile.goal || 'Definilo para personalizar tus oportunidades';
  const all=[...profile.skills,...profile.languages];
  $('passportSkills').innerHTML = all.length ? all.map(x=>`<span>${escapeHtml(x)}</span>`).join('') : '<span>Agregá tus habilidades</span>';
  const fields=[profile.name,profile.goal,profile.skills.length,profile.languages.length].filter(Boolean).length;
  $('profileCompletion').textContent=`${Math.max(25,fields*25)}%`;
  localStorage.setItem('glockta-profile',JSON.stringify(profile));
}

function fillProfileForm(){
  $('name').value=profile.name||'';
  $('goal').value=profile.goal||'';
  $('skills').value=(profile.skills||[]).join(', ');
  $('languages').value=(profile.languages||[]).join(', ');
}

async function renderAuthState(){
  if(!currentUser){
    $('loginBtn').textContent='Ingresar con Google';
    $('authTitle').textContent='Ingresar a GLOCKTA';
    $('authDescription').textContent='Google será la autenticación principal del MVP. LinkedIn puede incorporarse como segunda identidad.';
    $('userCard').classList.add('hidden');
    $('googleAuthBtn').classList.remove('hidden');
    $('logoutBtn').classList.add('hidden');
    return;
  }
  const meta=currentUser.user_metadata||{};
  const displayName=meta.full_name||meta.name||currentUser.email||'Usuario Glockta';
  $('loginBtn').textContent=`Hola, ${displayName.split(' ')[0]}`;
  $('authTitle').textContent='Tu cuenta GLOCKTA';
  $('authDescription').textContent='La sesión se administra con Supabase Auth y Google OAuth.';
  $('userCard').innerHTML=`<p><b>${escapeHtml(displayName)}</b></p><p class="status">${escapeHtml(currentUser.email||'')}</p>`;
  $('userCard').classList.remove('hidden');
  $('googleAuthBtn').classList.add('hidden');
  $('logoutBtn').classList.remove('hidden');
  if(!profile.name && displayName) profile.name=displayName;
  renderProfile(); fillProfileForm();
}

async function loadRemoteProfile(){
  if(!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.from('profiles').select('full_name, professional_goal, skills, languages').eq('id',currentUser.id).maybeSingle();
  if(error){console.warn('Profile load error',error.message);return;}
  if(data){
    profile={name:data.full_name||'',goal:data.professional_goal||'',skills:data.skills||[],languages:data.languages||[]};
    renderProfile(); fillProfileForm();
  }
}

async function saveRemoteProfile(){
  if(!supabaseClient || !currentUser) return {saved:false, reason:'not_authenticated'};
  const payload={id:currentUser.id,full_name:profile.name,professional_goal:profile.goal,skills:profile.skills,languages:profile.languages,updated_at:new Date().toISOString()};
  const { error }=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'});
  if(error) throw error;
  return {saved:true};
}

$('profileForm').addEventListener('submit',async e=>{
  e.preventDefault();
  profile={name:$('name').value.trim(),goal:$('goal').value.trim(),skills:splitValues($('skills').value),languages:splitValues($('languages').value)};
  renderProfile();
  try{
    const result=await saveRemoteProfile();
    toast(result.saved?'Perfil guardado en Supabase.':'Perfil guardado localmente. Iniciá sesión para sincronizarlo.');
  }catch(err){toast(`No se pudo sincronizar el perfil: ${err.message}`);}
});

// ---- Asistente de Career Passport con IA ----
if($('aiFillBtn')) $('aiFillBtn').addEventListener('click', async ()=>{
  const text = $('aiFreeText').value.trim();
  const statusEl = $('aiAssistStatus');
  if(!text){statusEl.textContent='Contame un poco tu experiencia primero.'; return;}
  if(!config.aiEnabled){statusEl.textContent='El asistente de IA no está configurado en este entorno (falta ANTHROPIC_API_KEY). Podés completar el formulario a mano.'; return;}
  const btn = $('aiFillBtn');
  btn.disabled = true; btn.textContent='Pensando…'; statusEl.textContent='';
  try{
    const res = await fetch('/api/ai/parse-profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const data = await res.json();
    if(!res.ok){statusEl.textContent = data.message || 'No se pudo procesar el relato. Completá el formulario a mano.'; return;}
    if(data.profile.goal) $('goal').value = data.profile.goal;
    if(data.profile.skills?.length) $('skills').value = data.profile.skills.join(', ');
    if(data.profile.languages?.length) $('languages').value = data.profile.languages.join(', ');
    statusEl.textContent = '✓ Completado con IA. Revisá y ajustá antes de guardar.';
  }catch(err){statusEl.textContent = 'No se pudo conectar con el asistente de IA. Completá el formulario a mano.';}
  finally{btn.disabled=false; btn.textContent='Completar con IA';}
});

$('jobSearchForm').addEventListener('submit',async e=>{e.preventDefault();await searchJobs();});
async function searchJobs(){
  $('jobStatus').textContent='Consultando oportunidades…'; $('jobsGrid').innerHTML='';
  const payload={keywords:$('keywords').value,location:$('location').value,provider:$('provider').value};
  try{
    let res=await fetch('/api/jobs/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let data=await res.json();
    if(!res.ok){$('jobStatus').textContent=`El proveedor real no está disponible (${data.message}). Mostramos modo demo como contingencia.`; data=await fetch('/api/jobs/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,provider:'demo'})}).then(r=>r.json());}
    else $('jobStatus').textContent=`${data.jobs.length} oportunidades · proveedor: ${data.provider}`;
    for(const job of data.jobs){const match=await fetch('/api/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,job})}).then(r=>r.json()); renderJob(job,match);}
    renderExternalSearchLinks(payload.keywords, payload.location);
  }catch(err){$('jobStatus').textContent='No pudimos completar la búsqueda.';}
}

// ---- Nivel 1: redirección a los portales de empleo más usados (sin API, sin clave) ----
function renderExternalSearchLinks(keywords, location){
  const el = $('externalSearchLinks');
  const kw = encodeURIComponent(keywords || '');
  const loc = encodeURIComponent(location || 'Argentina');
  const slug = (keywords || 'empleo').trim().toLowerCase().replace(/\s+/g, '-');
  const links = [
    { name: 'LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}` },
    { name: 'Computrabajo', url: `https://www.ar.computrabajo.com/trabajo-de-${encodeURIComponent(slug)}` },
    { name: 'Bumeran', url: `https://www.bumeran.com.ar/empleos-busqueda-${encodeURIComponent(slug)}.html` },
    { name: 'ZonaJobs', url: `https://www.zonajobs.com.ar/empleos-busqueda-${encodeURIComponent(slug)}.html` }
  ];
  el.classList.remove('hidden');
  el.innerHTML = `<span>Buscar también en:</span>` + links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${escapeHtml(l.name)} ↗</a>`).join('');
}

async function saveJob(job,match){
  if(!supabaseClient || !currentUser){toast('Iniciá sesión con Google para guardar oportunidades.');return;}
  const payload={user_id:currentUser.id,provider:job.source||'external',external_job_id:String(job.id||job.url||Date.now()),title:job.title,company:job.company||'',job_url:job.url||'',match_score:Number.isInteger(match.score)?match.score:null,status:'saved'};
  const {error}=await supabaseClient.from('saved_jobs').insert(payload);
  if(error){toast(`No se pudo guardar: ${error.message}`);return;}
  toast('Oportunidad guardada en tu cuenta GLOCKTA.');
}

function renderJob(job,match){
  const card=document.createElement('article'); card.className='job-card';
  const score=match.score===null?'—':`${match.score}%`;
  const aiBtn = config.aiEnabled ? `<button class="text-btn ai-advice-btn">✦ Ver consejo personalizado</button>` : '';
  card.innerHTML=`<span class="eyebrow">${escapeHtml(job.source||'Proveedor externo')}</span><h3>${escapeHtml(job.title)}</h3><div class="job-meta">${escapeHtml(job.company||'')} · ${escapeHtml(job.location||'')}</div><p>${escapeHtml((job.description||'').slice(0,260))}</p><div class="match-box"><span class="match-score ${match.score!==null&&match.score<60?'low':''}">${score} Match</span><p class="status">${escapeHtml(match.explanation)}</p><div class="chips">${(match.matched||[]).slice(0,5).map(x=>`<span>✓ ${escapeHtml(x)}</span>`).join('')}${(match.gaps||[]).slice(0,3).map(x=>`<span class="gap">△ ${escapeHtml(x)}</span>`).join('')}</div>${aiBtn}<div class="ai-advice-box hidden"></div></div><div class="job-actions"><button class="btn btn-primary save-job">Guardar</button>${job.url&&job.url!=='#'?`<a class="btn btn-secondary" target="_blank" rel="noopener" href="${escapeHtml(job.url)}">Ver fuente</a>`:''}<a class="btn btn-secondary" href="#mentoria">Hablar con mentor</a></div>`;
  card.querySelector('.save-job').addEventListener('click',()=>saveJob(job,match));
  const adviceBtn = card.querySelector('.ai-advice-btn');
  if(adviceBtn) adviceBtn.addEventListener('click', async ()=>{
    const box = card.querySelector('.ai-advice-box');
    box.classList.remove('hidden');
    adviceBtn.disabled = true; box.textContent = 'Pensando un consejo para vos…';
    try{
      const res = await fetch('/api/ai/match-explanation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobTitle:job.title,score:match.score,matched:match.matched||[],gaps:match.gaps||[]})});
      const data = await res.json();
      box.textContent = res.ok ? data.explanation : (data.message || 'No se pudo generar el consejo en este momento.');
    }catch(err){box.textContent='No se pudo conectar con el asistente de IA.';}
    finally{adviceBtn.disabled=false;}
  });
  $('jobsGrid').appendChild(card);
}

// ---- Contacto directo: WhatsApp + email ----
// Valores por defecto; se sobreescriben con WHATSAPP_NUMBER / CONTACT_EMAIL del .env vía /api/config.
let CONTACT_WHATSAPP = '';
let CONTACT_EMAIL = 'info.glockta@gmail.com';

function waLink(text){
  const num = CONTACT_WHATSAPP || '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
function mailLink(subject, body){
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function renderConfirm(el, waText, mailSubject, mailBody, extraHtml){
  el.classList.remove('hidden');
  el.innerHTML = `<a class="btn btn-secondary" target="_blank" rel="noopener" href="${waLink(waText)}">💬 Confirmar por WhatsApp</a><a class="btn btn-secondary" href="${mailLink(mailSubject, mailBody)}">Confirmar por email</a>${extraHtml||''}`;
  if(!CONTACT_WHATSAPP) el.querySelector('a').title = 'Falta configurar WHATSAPP_NUMBER en el .env';
}
function renderFooterContact(){
  const el = $('footerContact');
  if(!el) return;
  el.innerHTML = `<a href="${waLink('Hola GLOCKTA, quiero más info.')}" target="_blank" rel="noopener">💬 WhatsApp</a><a href="${mailLink('Consulta GLOCKTA','Hola, quiero más información.')}">${escapeHtml(CONTACT_EMAIL)}</a>`;
}
function setupWhatsappFloat(){
  const btn = $('waFloat');
  if(!btn) return;
  btn.href = waLink('Hola GLOCKTA, quiero más información.');
  btn.classList.remove('hidden');
}

// ---- Mercado Pago: feedback al volver del checkout ----
(function handlePaymentReturn(){
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment');
  if(!status) return;
  const messages = { success: '¡Pago acreditado! Gracias por tu compra.', pending: 'Tu pago está pendiente de confirmación.', failure: 'El pago no se pudo completar. Podés reintentarlo desde el carrito.' };
  window.addEventListener('DOMContentLoaded', () => toast(messages[status] || 'Volviste de Mercado Pago.'));
  params.delete('payment');
  const clean = window.location.pathname + (params.toString()?`?${params}`:'') + window.location.hash;
  window.history.replaceState({}, '', clean);
})();

// ---- Calendario: generar .ics y link a Google Calendar sin necesitar cuentas ----
function pad(n){ return String(n).padStart(2,'0'); }
function toICSDate(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; }
function buildICS({title, description, start, end}){
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GLOCKTA//Mentoria//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${Date.now()}@glockta.app`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${String(description||'').replace(/\n/g,'\\n')}`,
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
}
function downloadICS(filename, content){
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function googleCalendarLink({title, description, start, end}){
  const p = new URLSearchParams({ action:'TEMPLATE', text:title, dates:`${toICSDate(start)}/${toICSDate(end)}`, details:description||'' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
function calendarButtonsHtml(event){
  const ics = buildICS(event);
  const gcal = googleCalendarLink(event);
  const id = `ics-${Date.now()}`;
  setTimeout(()=>{ const el=document.getElementById(id); if(el) el.addEventListener('click', () => downloadICS('glockta-mentoria.ics', ics)); }, 0);
  return `<a class="btn btn-secondary" target="_blank" rel="noopener" href="${gcal}">📅 Agregar a Google Calendar</a><button type="button" id="${id}" class="btn btn-secondary">⬇ Descargar .ics</button>`;
}

// ---- Curso gratuito: 4 lecciones navegables ----
const COURSE_LESSONS = [
  {
    id: 'l1', title: '1. Armá tu Career Passport',
    content: `Antes de buscar, definí tu objetivo en una frase clara ("busco un rol de atención al cliente presencial en CABA"). Sumá tus habilidades técnicas y también las blandas (organización, comunicación) — muchas veces pesan más de lo que pensás. No hace falta experiencia previa formal: tareas de tu casa, de un emprendimiento o de un voluntariado también cuentan como habilidades reales.`
  },
  {
    id: 'l2', title: '2. Buscá con la palabra clave correcta',
    content: `La palabra que escribís en el buscador determina qué vacantes ves. Probá primero con el nombre del puesto ("recepcionista"), después con una habilidad clave ("atención al cliente"), y comparalos: muchas veces la segunda búsqueda encuentra oportunidades que la primera no muestra. Si no encontrás nada, probá sinónimos: "administrativo" y "auxiliar administrativo" no siempre traen los mismos resultados.`
  },
  {
    id: 'l3', title: '3. Entendé tu Glockta Match',
    content: `El puntaje de coincidencia no es una nota que apruebas o desapruebas — es un mapa de qué tenés y qué te falta. Fijate en "coincidencias": eso es lo que ya podés mencionar en una entrevista con confianza. Fijate en "brechas": esas son las habilidades puntuales que podés reforzar con una capacitación corta o gratuita antes de postular.`
  },
  {
    id: 'l4', title: '4. Preparate para la entrevista',
    content: `Usá la estructura Situación → Tarea → Acción → Resultado para responder preguntas de experiencia: contá brevemente la situación, qué tenías que hacer, qué hiciste vos concretamente, y qué resultado se logró. Practicá una respuesta así para 3 situaciones reales de tu vida (trabajo, estudio o vida personal) antes de tu próxima entrevista — te va a dar mucha más seguridad que memorizar respuestas genéricas.`
  }
];
const COURSE_ID = 'curso-gratis';
const COURSE_PROGRESS_KEY = 'glockta-course-progress';
let courseProgress = []; // array de lesson_id completados (cache en memoria)

function readLocalProgress(){ try{ return JSON.parse(localStorage.getItem(COURSE_PROGRESS_KEY)) || []; }catch{ return []; } }
function writeLocalProgress(arr){ localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(arr)); }

// Si el usuario inicia sesión, migramos lo que haya avanzado como invitado a su cuenta.
async function loadCourseProgress(){
  const local = readLocalProgress();
  if(!supabaseClient || !currentUser){ courseProgress = local; return; }
  const { data, error } = await supabaseClient.from('course_progress').select('lesson_id').eq('user_id', currentUser.id).eq('course_id', COURSE_ID);
  if(error){ console.warn('No se pudo leer el progreso remoto', error.message); courseProgress = local; return; }
  const remote = (data||[]).map(r=>r.lesson_id);
  const merged = Array.from(new Set([...remote, ...local]));
  const missingRemote = merged.filter(id => !remote.includes(id));
  if(missingRemote.length){
    await supabaseClient.from('course_progress').insert(missingRemote.map(lesson_id => ({ user_id: currentUser.id, course_id: COURSE_ID, lesson_id })));
  }
  courseProgress = merged;
  writeLocalProgress(merged);
}

async function completeLesson(id){
  if(courseProgress.includes(id)) return;
  courseProgress.push(id);
  writeLocalProgress(courseProgress);
  if(supabaseClient && currentUser){
    const { error } = await supabaseClient.from('course_progress').insert({ user_id: currentUser.id, course_id: COURSE_ID, lesson_id: id });
    if(error) console.warn('No se pudo sincronizar la lección', error.message);
  }
  renderCourse();
  updateCourseProgressBar();
  toast('¡Lección completada!');
  if(courseProgress.length === COURSE_LESSONS.length) await onCourseCompleted();
}

async function onCourseCompleted(){
  $('courseCertificateBox').classList.remove('hidden');
  if(supabaseClient && currentUser){
    const { data: existing } = await supabaseClient.from('certificates').select('id').eq('user_id', currentUser.id).eq('course_id', COURSE_ID).maybeSingle();
    if(!existing){
      await supabaseClient.from('certificates').insert({ user_id: currentUser.id, course_id: COURSE_ID, full_name: profile.name || currentUser.email || 'Estudiante GLOCKTA' });
    }
  }
}

function openCertificate(){
  const name = escapeHtml(profile.name || (currentUser && (currentUser.user_metadata?.full_name || currentUser.email)) || 'Estudiante GLOCKTA');
  const date = new Date().toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado GLOCKTA</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;background:#0b1c2f;color:#0b1c2f;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .cert{background:#fff;width:900px;max-width:94vw;padding:70px 60px;border:10px solid #0b1c2f;position:relative;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .cert:before{content:"";position:absolute;inset:14px;border:2px solid #2dd4ee}
    .eyebrow{letter-spacing:.25em;color:#0e8bab;font-weight:700;font-size:13px;text-transform:uppercase}
    h1{font-size:38px;margin:18px 0 6px}
    .sub{color:#526274;font-family:Arial,sans-serif;margin-bottom:36px}
    .name{font-size:34px;margin:28px 0;font-style:italic;border-bottom:2px solid #0b1c2f;display:inline-block;padding-bottom:10px}
    .course{font-size:20px;margin:18px 0 40px;font-family:Arial,sans-serif}
    .footer{display:flex;justify-content:space-between;margin-top:50px;font-family:Arial,sans-serif;font-size:13px;color:#526274}
    @media print{ body{background:#fff} .cert{box-shadow:none;border-color:#0b1c2f} }
  </style></head><body>
    <div class="cert">
      <span class="eyebrow">GLOCKTA — Inclusive Employability Accelerator</span>
      <h1>Certificado de finalización</h1>
      <p class="sub">Otorgado por completar el curso gratuito</p>
      <div class="name">${name}</div>
      <p class="course">completó exitosamente <b>"Primeros pasos en tu búsqueda laboral"</b><br>(4 lecciones · Career Passport, búsqueda, Glockta Match y entrevista)</p>
      <div class="footer"><span>Emitido el ${date}</span><span>GLOCKTA · From talent to opportunity</span></div>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`;
  const win = window.open('', '_blank');
  if(!win){ toast('Habilitá las ventanas emergentes para ver tu certificado.'); return; }
  win.document.write(html);
  win.document.close();
}
$('downloadCertificateBtn')?.addEventListener('click', openCertificate);

function renderCourse(){
  const container = $('courseLessons');
  const done = courseProgress;
  container.innerHTML = COURSE_LESSONS.map(l => `
    <article class="lesson-card">
      <button class="lesson-head" type="button" data-toggle="${l.id}">
        <b>${escapeHtml(l.title)}</b>
        <span class="lesson-check ${done.includes(l.id) ? 'done' : ''}" data-check="${l.id}">${done.includes(l.id) ? '✓' : ''}</span>
      </button>
      <div class="lesson-body" data-body="${l.id}">
        <p>${escapeHtml(l.content)}</p>
        <button class="btn btn-secondary" type="button" data-complete="${l.id}">${done.includes(l.id) ? 'Marcada como completada' : 'Marcar como completada'}</button>
      </div>
    </article>`).join('');

  for(const btn of container.querySelectorAll('[data-toggle]')){
    btn.addEventListener('click', () => {
      const body = container.querySelector(`[data-body="${btn.dataset.toggle}"]`);
      body.classList.toggle('open');
    });
  }
  for(const btn of container.querySelectorAll('[data-complete]')){
    btn.addEventListener('click', () => completeLesson(btn.dataset.complete));
  }
}
function updateCourseProgressBar(){
  const done = courseProgress.length;
  const total = COURSE_LESSONS.length;
  $('courseProgressBar').style.width = `${Math.round((done/total)*100)}%`;
  $('courseProgressLabel').textContent = `${done} de ${total} lecciones completadas`;
  if(done === total) $('courseCertificateBox').classList.remove('hidden');
}
$('courseraLink').href = 'https://www.coursera.org/search?query=empleabilidad';

$('openAgenda').addEventListener('click',()=>{$('agendaForm').classList.toggle('hidden');});
$('agendaForm').addEventListener('submit',async e=>{
  e.preventDefault();
  $('agendaStatus').textContent='Guardando…';
  const name=$('agendaName').value, email=$('agendaEmail').value, reason=$('agendaReason').value, date=$('agendaDate').value;
  const body={user_name:name,user_email:email,reason,scheduled_at:date};
  const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();
  $('agendaStatus').textContent=d.demo?'Turno registrado en modo demo. Al conectar Supabase quedará persistido.':'Turno solicitado correctamente.';
  const msg=`Hola GLOCKTA, quiero confirmar mi turno.\nNombre: ${name}\nMotivo: ${reason}\nFecha/hora: ${date || 'a coordinar'}`;
  let calendarHtml = '';
  if(date){
    const start = new Date(date);
    const end = new Date(start.getTime() + 45*60000);
    calendarHtml = calendarButtonsHtml({ title:`Mentoría GLOCKTA — ${reason}`, description:`Sesión de mentoría GLOCKTA con ${name}.`, start, end });
  }
  renderConfirm($('agendaConfirm'), msg, 'Confirmación de turno GLOCKTA', msg, calendarHtml);
});

$('businessForm').addEventListener('submit',async e=>{
  e.preventDefault();
  $('businessStatus').textContent='Enviando…';
  const company=$('companyName').value, contact=$('contactName').value, email=$('businessEmail').value, service=$('businessService').value, message=$('businessMessage').value;
  const body={company_name:company,contact_name:contact,email,service,message};
  const r=await fetch('/api/contact/business',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();
  $('businessStatus').textContent=d.demo?'Lead registrado en modo demo.':'Solicitud registrada.';
  const msg=`Hola GLOCKTA for Business, somos ${company}.\nContacto: ${contact}\nServicio de interés: ${service}\n${message}`;
  renderConfirm($('businessConfirm'), msg, `Propuesta GLOCKTA — ${company}`, msg);
});

$('contrastBtn').addEventListener('click',()=>{const on=document.body.classList.toggle('high-contrast');$('contrastBtn').setAttribute('aria-pressed',String(on));});
$('fontBtn').addEventListener('click',()=>document.body.classList.toggle('large-text'));

const loginDialog=$('loginDialog');
$('loginBtn').addEventListener('click',()=>loginDialog.showModal());
loginDialog.querySelector('.dialog-close').addEventListener('click',()=>loginDialog.close());
$('googleAuthBtn').addEventListener('click',async()=>{
  if(!supabaseClient){$('authStatus').textContent='Falta conectar el proyecto Supabase. El botón ya está preparado.';return;}
  $('authStatus').textContent='Redirigiendo a Google…';
  const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
  if(error)$('authStatus').textContent=error.message;
});
$('logoutBtn').addEventListener('click',async()=>{
  if(!supabaseClient) return;
  const {error}=await supabaseClient.auth.signOut();
  $('authStatus').textContent=error?error.message:'Sesión cerrada.';
  if(!error){currentUser=null;await renderAuthState();}
});

function toast(msg){
  let t=$('cartToast');
  if(!t){t=document.createElement('div');t.id='cartToast';t.className='toast';t.setAttribute('aria-live','polite');document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);
}

// ---- Glockta Store: catálogo, carrito y capacitaciones ----
const money = (value,currency='ARS') => `$${Number(value||0).toLocaleString('es-AR')} ${currency}`;
let cart = [];
try{ cart = JSON.parse(localStorage.getItem('glockta-cart')) || []; }catch{ cart = []; }

function saveCart(){ localStorage.setItem('glockta-cart', JSON.stringify(cart)); renderCartBadge(); }
function renderCartBadge(){ $('cartCount').textContent = cart.reduce((n,i)=>n+i.quantity,0); }

function addToCart(product){
  const existing = cart.find(i=>i.id===product.id);
  if(existing) existing.quantity += 1;
  else cart.push({ id:product.id, name:product.name, price:Number(product.price)||0, quantity:1 });
  saveCart();
  toast(`"${product.name}" agregado al carrito.`);
}

function removeFromCart(id){ cart = cart.filter(i=>i.id!==id); saveCart(); renderCart(); }

function renderCart(){
  const box = $('cartItems');
  if(!cart.length){ box.innerHTML = '<p class="status">Tu carrito está vacío.</p>'; }
  else box.innerHTML = cart.map(i=>`<div class="cart-line"><span>${escapeHtml(i.name)} × ${i.quantity}</span><span>${money(i.price*i.quantity)} <button type="button" data-id="${escapeHtml(i.id)}">Quitar</button></span></div>`).join('');
  for(const btn of box.querySelectorAll('button[data-id]')) btn.addEventListener('click',()=>removeFromCart(btn.dataset.id));
  const total = cart.reduce((sum,i)=>sum+i.price*i.quantity,0);
  $('cartTotal').textContent = money(total);
}

async function loadCatalog(){
  try{
    const data = await fetch('/api/products').then(r=>r.json());
    renderProducts(data.products||[]);
    renderTrainings(data.trainings||[]);
  }catch(e){
    $('productsGrid').innerHTML = '<p class="status">No se pudo cargar el catálogo.</p>';
    $('trainingsGrid').innerHTML = '<p class="status">No se pudieron cargar las capacitaciones.</p>';
  }
}

const TAGS = { ebook:'EBOOK', guide:'GUÍA', course:'CURSO', service:'SERVICIO' };

function renderProducts(products){
  const grid = $('productsGrid');
  if(!products.length){ grid.innerHTML = '<p class="status">Sin productos disponibles por ahora.</p>'; return; }
  grid.innerHTML = products.map(p=>`
    <article class="product-card">
      <span class="tag">${escapeHtml(TAGS[p.product_type]||'ITEM')}</span>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description||'')}</p>
      <div><b>${money(p.price,p.currency)}</b><button class="btn btn-secondary add-cart-btn" data-id="${escapeHtml(p.id)}">Agregar</button></div>
    </article>`).join('');
  for(const btn of grid.querySelectorAll('.add-cart-btn')){
    btn.addEventListener('click',()=>{
      const p = products.find(x=>String(x.id)===btn.dataset.id);
      if(p) addToCart(p);
    });
  }
}

function renderTrainings(trainings){
  const grid = $('trainingsGrid');
  if(!trainings.length){ grid.innerHTML = '<p class="status">No hay capacitaciones programadas por el momento.</p>'; return; }
  grid.innerHTML = trainings.map((t,idx)=>`
    <article class="feature-card">
      <span class="feature-icon">◎</span>
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.description||'')}</p>
      <form class="training-signup" data-training="${escapeHtml(t.name)}" data-idx="${idx}">
        <input type="text" placeholder="Tu nombre" required />
        <input type="email" placeholder="Tu email" required />
        <button class="btn btn-secondary" type="submit">Inscribirme gratis</button>
        <span class="status"></span>
      </form>
    </article>`).join('');
  for(const form of grid.querySelectorAll('.training-signup')){
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const inputs = form.querySelectorAll('input');
      const statusEl = form.querySelector('.status');
      statusEl.textContent = 'Enviando…';
      const body = { training_name: form.dataset.training, full_name: inputs[0].value, email: inputs[1].value };
      try{
        const r = await fetch('/api/trainings/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d = await r.json();
        statusEl.textContent = d.demo ? 'Inscripción registrada en modo demo.' : '¡Listo! Te confirmamos por email.';
        form.reset();
      }catch(err){ statusEl.textContent = 'No se pudo registrar la inscripción.'; }
    });
  }
}

const cartDialog = $('cartDialog');
$('cartBtn').addEventListener('click',()=>{ renderCart(); cartDialog.showModal(); });
cartDialog.querySelector('.dialog-close').addEventListener('click',()=>cartDialog.close());
$('checkoutForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const statusEl = $('checkoutStatus');
  if(!cart.length){ statusEl.textContent = 'Agregá al menos un producto.'; return; }
  statusEl.textContent = 'Procesando…';
  const body = { items: cart, customer_name: $('checkoutName').value, customer_email: $('checkoutEmail').value };
  try{
    const r = await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d = await r.json();
    if(!r.ok){ statusEl.textContent = d.error || 'No se pudo completar la compra.'; return; }
    if(d.checkoutUrl){
      statusEl.textContent = 'Redirigiendo a Mercado Pago…';
      cart = []; saveCart();
      window.location.href = d.checkoutUrl;
      return;
    }
    statusEl.textContent = d.message || 'Compra registrada.';
    cart = []; saveCart(); renderCart();
  }catch(err){ statusEl.textContent = 'No se pudo completar la compra.'; }
});

// ---- PWA: service worker + instalación ----
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click', async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').classList.add('hidden');
});
window.addEventListener('appinstalled', () => { $('installBtn').classList.add('hidden'); toast('GLOCKTA instalada correctamente.'); });

(async()=>{
  await loadConfig();
  const saved=localStorage.getItem('glockta-profile');
  if(saved){try{profile=JSON.parse(saved);}catch{}}
  renderProfile(); fillProfileForm();
  renderCartBadge();
  await renderAuthState();
  if(currentUser) await loadRemoteProfile();
  await loadCourseProgress();
  renderCourse();
  updateCourseProgressBar();
  await searchJobs();
  await loadCatalog();
})();
