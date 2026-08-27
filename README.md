# GLOCKTA — Inclusive Employability Accelerator

MVP de tesis para Escuela Da Vinci. Objetivo: demostrar un recorrido de empleabilidad de punta a punta con UX accesible, API externa, matching explicable, persistencia, cobro real y arquitectura extensible — listo para exponer y para salir al mercado.

## Flujo de demo
0. Primera visita: onboarding de 2 preguntas (qué te trae por GLOCKTA + accesibilidad) que lleva directo a la sección más relevante.
1. Crear/editar Career Passport (objetivo, habilidades, idiomas, experiencia, educación, certificaciones y portfolio) y ver el Career Score actualizarse en vivo.
2. Buscar oportunidades mediante `JobProvider`.
3. Normalizar resultados de Jooble/Adzuna o usar proveedor demo.
4. Calcular Glockta Match y mostrar brechas.
5. Guardar oportunidad / pedir mentoría (con turno + calendario).
6. Completar el curso gratuito y descargar el certificado.
7. Comprar en la tienda con Mercado Pago.
8. Mostrar biblioteca y Glockta for Business.
9. Activar contraste/texto aumentado para demostrar accesibilidad.
10. Contactar por WhatsApp desde el botón flotante.

## Arquitectura
```
Browser / APK -> Express API -> JobProviderAdapter -> Jooble | Adzuna | Demo
                     |-> MatchingService
                     |-> Mercado Pago (Checkout Pro + webhook)
                     |-> Supabase/PostgreSQL (perfiles, órdenes, turnos, progreso de curso, certificados)
```

## Arranque local
```bash
cp .env.example .env
npm install
npm start
```
Abrir `http://localhost:3000`.

Sin completar ningún `.env`, el sitio ya funciona 100% en **modo demo**: catálogo, checkout, turnos, capacitaciones y leads quedan registrados en la respuesta de la API aunque no haya base de datos ni Mercado Pago conectados. Esto sirve para probar la UX, pero **no persiste nada ni cobra de verdad** — para eso hay que completar Supabase y Mercado Pago (siguiente sección).

---

## Puesta en marcha real (para defender la tesis con todo funcionando)

### 1. Base de datos — Supabase
1. Creá un proyecto gratis en [supabase.com](https://supabase.com).
2. En **Project Settings → API** copiá `Project URL`, `anon public key` y `service_role key`.
3. Pegalos en tu `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. En el editor SQL de Supabase, corré todo el contenido de `sql/schema.sql`. Esto crea: `profiles`, `saved_jobs`, `appointments`, `business_leads`, `products`, `orders`, `order_items`, `training_signups`, `course_progress`, `certificates`, `experience`, `education`, `certifications` y `portfolio_items`, con Row Level Security activado donde corresponde.
5. En **Authentication → Providers**, activá Google y completá el Client ID/Secret de un OAuth Client de Google Cloud (tipo "Web application", con `https://TU-PROYECTO.supabase.co/auth/v1/callback` como redirect URI).

Con esto: el login con Google, el Career Passport, las oportunidades guardadas, el progreso del curso y los certificados quedan guardados de verdad por usuario (antes vivían solo en `localStorage` del navegador).

### 2. Cobros reales — Mercado Pago
1. Entrá a [mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel) con tu cuenta de Mercado Pago (o creá una).
2. Creá una aplicación → copiá las **credenciales de prueba** (`Access Token` que empieza con `TEST-`).
3. Pegalo en `.env` como `MP_ACCESS_TOKEN` (y opcionalmente `MP_PUBLIC_KEY`).
4. Completá `PUBLIC_BASE_URL` con la URL pública donde esté hosteado el sitio (en local podés dejarlo vacío; Mercado Pago igual va a necesitar una URL pública real para el webhook, así que probá esta parte una vez deployado — ver sección de Hosting).
5. Al comprar algo en la tienda, el checkout ahora crea una **preferencia real de Mercado Pago (Checkout Pro)** y redirige al comprador a pagar. Cuando el pago se aprueba, Mercado Pago llama a `/api/mp/webhook` y la orden pasa de `pending` a `paid` en la base de datos automáticamente.
6. Para cobrar de verdad (no solo probar), reemplazá las credenciales de prueba por las de **producción** en el mismo panel de Mercado Pago.

Si `MP_ACCESS_TOKEN` está vacío, el checkout sigue funcionando en modo demo (registra la orden como `pending` sin cobrar), así que nunca se rompe la demo aunque todavía no tengas cuenta de Mercado Pago.

### 3. WhatsApp
Completá `WHATSAPP_NUMBER` en `.env` con tu número en formato internacional sin signos ni espacios (ej. `5491122334455` = 54 Argentina + 9 + código de área sin el 0 + número sin el 15).

Con eso se activa: el botón flotante de WhatsApp en todo el sitio, la confirmación de turnos de mentoría, la confirmación de solicitudes de empresas, y el link del footer — todos con un mensaje precargado distinto según de dónde vengan.

Es un botón "click to chat" (`wa.me`), sin costo y sin necesidad de aprobar ninguna cuenta — funciona apenas completás el número. El siguiente nivel (mensajes automáticos, confirmaciones de compra por WhatsApp) requiere WhatsApp Business API vía Meta o Twilio, que tiene costo por mensaje y un proceso de verificación de varios días; se puede sumar más adelante sin tocar el resto de la arquitectura.

### 4. Asistente de IA (Claude)
Completá `ANTHROPIC_API_KEY` en `.env` con una clave de [console.anthropic.com](https://console.anthropic.com). Con eso se activan dos funciones opcionales:

- **Completar el Career Passport con IA**: la persona cuenta su experiencia en un texto libre ("le cuento a un amigo qué hice hasta hoy") y la IA completa objetivo, habilidades e idiomas del formulario.
- **Consejo personalizado por oportunidad**: en cada resultado de búsqueda aparece un botón "Ver consejo personalizado" que redacta, en base al mismo cálculo de coincidencias/brechas del Glockta Match (no inventa un puntaje nuevo), un consejo breve en tono de mentor.

Sin esta clave, ambos botones quedan ocultos automáticamente y el resto del sitio sigue funcionando igual — es 100% opcional, pensado para reforzar (no reemplazar) el matching explicable que ya tiene la plataforma.

### 6. Calendario de mentorías
Ya funciona sin configuración adicional: al reservar un turno, además de guardarse en la base de datos, aparecen dos botones — **"Agregar a Google Calendar"** (abre Google Calendar con el evento precargado) y **"Descargar .ics"** (archivo de invitación de calendario compatible con Google Calendar, Outlook y Apple Calendar). No requiere cuentas de Google Cloud ni OAuth.

### 7. Curso gratuito y certificado
El curso ya persiste el avance en `localStorage` como invitado, y si el usuario inicia sesión con Google, el progreso (y el avance que ya tenía como invitado) se sincroniza a la tabla `course_progress` en Supabase — así el progreso no se pierde si cambia de dispositivo. Al completar las 4 lecciones se emite un certificado descargable (PDF vía diálogo de impresión del navegador) y, si el usuario está logueado, queda un registro verificable en la tabla `certificates`.

---

## Subir el proyecto a GitHub

Este proyecto ya viene con `git init` hecho y el primer commit listo. Para subirlo a tu cuenta:

1. Entrá a [github.com/new](https://github.com/new) y creá un repositorio vacío (por ejemplo `glockta-mvp`). **No** marques "Add a README" ni ".gitignore" — ya los tenemos.
2. Copiá la URL que te da GitHub (algo como `https://github.com/TU-USUARIO/glockta-mvp.git`).
3. En una terminal, parado en esta carpeta, corré:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/glockta-mvp.git
   git branch -M main
   git push -u origin main
   ```
4. GitHub te va a pedir iniciar sesión la primera vez (usuario + contraseña de acceso personal, o token).

A partir de ahí, cada cambio nuevo se sube con:
```bash
git add .
git commit -m "Descripción del cambio"
git push
```

**Importante:** el archivo `.env` con tus claves reales nunca se sube (está en `.gitignore` a propósito). Cuando hosteés el sitio (ver siguiente sección), esas variables se cargan directamente en el panel del hosting, no desde un archivo subido a GitHub.

---

## Hosting (para tener la URL pública que pide la tesis)

Cualquiera de estos sirve gratis para un backend Node/Express simple:

1. **Render** (recomendado, más simple): New → Web Service → conectá el repo de GitHub → Build command `npm install` → Start command `npm start` → cargá las variables de entorno del `.env` en la sección "Environment".
2. **Railway**: New Project → Deploy from GitHub repo → cargá las mismas variables de entorno.

Una vez deployado, actualizá `PUBLIC_BASE_URL` en las variables de entorno del hosting con esa URL pública (necesaria para que el webhook de Mercado Pago funcione).

## PWA → APK (requisito de Mesa de Tesis)
El sitio ya es una **PWA instalable**: manifest (`public/manifest.webmanifest`), service worker (`public/sw.js`) con caché de shell offline, íconos 192/512, y un botón "Instalar app" que aparece automáticamente en Chrome/Edge cuando el sitio está hosteado con HTTPS.

Para obtener el **.apk real** que pide el punto 3/12 de los entregables (sin escribir código nativo aparte):
1. Hosteá el sitio en HTTPS (Render, Railway o Vercel funcionan gratis).
2. Entrá a **https://www.pwabuilder.com**, pegá la URL pública.
3. PWABuilder valida el manifest y el service worker (ya están listos) y genera un paquete para **Android** con **Bubblewrap**.
4. Descargá el `.apk` (o `.aab` para Play Store) firmado, subilo a un repo GitHub aparte (o a una carpeta `/apk` del mismo repo) y usá esa URL para el punto 12 de los entregables.
5. Para "URL a una DEMO" (punto 11): mismo sitio hosteado sirve para mostrar tanto el flujo Website como el flujo APK.

Esto resuelve el requisito sin duplicar código: la APK y el Website comparten el mismo backend, base de datos y lógica.

## Wizard: la home ya no es una sola página larga
La landing arrancaba mostrando las 7 secciones a la vez, lo que hacía que la persona se perdiera. Ahora `#inicio` es una pantalla liviana con un solo mensaje y un botón ("Empezar →"), y el núcleo del producto (Career Passport → Oportunidades) se recorre como un asistente de 3 pasos con un indicador visual ("Paso X de 3") arriba del formulario:

1. **Tu perfil** — nombre, objetivo, habilidades e idiomas (con el asistente de IA opcional).
2. **Experiencia** — experiencia laboral, educación, certificaciones y portfolio (opcional, explícitamente marcado como tal, para no frenar a quien tiene apuro).
3. **Oportunidades** — al guardar el perfil se destraba automáticamente la sección de búsqueda (`#jobs`, antes visible siempre) y la página hace scroll directo ahí.

La sección de Oportunidades sigue existiendo en el HTML y sigue siendo alcanzable en cualquier momento desde el menú "Oportunidades" o desde "¿Ya tenés tu perfil? Ir directo a Oportunidades" en el hero — en ese caso se destraba igual, sin obligar a pasar por el formulario. Es un cambio 100% de interfaz (`public/index.html`, `public/app.js`, `public/styles.css`): no se tocó ningún endpoint ni la lógica de guardado, por eso los 31 tests automatizados siguen pasando sin cambios.

## Jerarquía visual: núcleo vs. complementos
La landing ya no trata las 7 secciones como pestañas del mismo peso. El núcleo (Career Passport → Oportunidades → Curso gratuito, que cierra la primera brecha) queda numerado 01/02/03 y resaltado en la navegación (`.nav-core`, en blanco y negrita). Después hay un separador visual explícito ("Con tu Career Passport en marcha, esto te puede servir") y recién ahí aparecen Mentoría, Capacitaciones, Tienda y Empresas, marcadas con la etiqueta "Complemento ·" en un tono más apagado. Es un cambio de jerarquía visual y de orden en el HTML — ninguna sección se eliminó ni perdió funcionalidad.

## Catálogo profesional
El catálogo de Glockta Store y Capacitaciones tiene 24 ítems (18 pagos, 6 gratuitos) diseñados a propósito para cubrir cada palabra clave del diccionario de habilidades del Glockta Match (excel, sql, power bi, html/css/javascript, canva, inglés, portugués, español, crm, google analytics, ventas, atención al cliente, comunicación, organización, administración, facturación, redes sociales, marketing, scrum, liderazgo, primeros auxilios, cuidado de adultos mayores, contenidos web). Esto no es solo contenido de venta: es lo que hace que el Learning Path (sección siguiente) pueda recomendar un curso propio real en vez de derivar siempre a una búsqueda externa. El seed vive en `sql/schema.sql` (para Supabase) y en `DEMO_PRODUCTS`/`DEMO_TRAININGS` de `src/server.js` (modo demo) — mantenelos sincronizados si agregás o cambiás productos.

## Learning Path: cerrar la brecha, no solo mostrarla
Cada oportunidad con brechas detectadas por el Glockta Match muestra un botón "Ver ruta para cerrar la brecha". `POST /api/learning-path` conecta cada habilidad faltante con: un producto/capacitación del catálogo de GLOCKTA si su nombre o descripción menciona esa habilidad (recomendación interna), o si no hay ninguno, un enlace de búsqueda externo (mismo patrón ya usado en "Buscar más cursos en Coursera" del curso gratuito). Es un cálculo por palabra clave, explicable y sin IA — nunca inventa un curso que no existe en el catálogo real (cubierto por tests). Es la respuesta concreta al hallazgo de la auditoría de que "el curso está desconectado del match": ahora cada brecha tiene un próximo paso accionable.

## Onboarding inteligente
En la primera visita (detectado por `localStorage`, no se repite después) aparece un diálogo de 2 preguntas cortas: qué te trae por GLOCKTA (buscar empleo, capacitarte, mejorar el perfil o "soy una empresa") y si necesitás alto contraste o texto más grande. Según la respuesta, la página hace scroll directo a la sección más relevante en vez de mostrar todo el sitio de una vez. Una usuaria que ya tenía perfil guardado antes de esta función no ve el onboarding (se asume ya orientada).

## Career Passport ampliado (Career Score)
El Career Passport ya no es solo objetivo/habilidades/idiomas: suma secciones editables de **experiencia laboral**, **educación**, **certificaciones** y **portfolio/evidencia**, cada una con entradas que se agregan y quitan libremente desde el formulario.

- **Career Score**: `POST /api/career-score` calcula, de forma explicable y sin IA, qué porcentaje del pasaporte está completo (7 secciones en partes iguales) y devuelve exactamente qué falta (`missingSections`). Se muestra en vivo en la tarjeta del pasaporte apenas se guarda el perfil.
- **Persistencia**: logueado con Google, cada sección se guarda en su propia tabla de Supabase (`experience`, `education`, `certifications`, `portfolio_items`) con el patrón "reemplazar todo" (se borran las filas anteriores del usuario y se insertan las actuales) — simple y suficiente para un MVP donde estas listas son cortas. Sin sesión, se guarda igual que el resto del perfil en `localStorage`.
- **Por qué importa para la tesis**: es la respuesta concreta a "el Career Passport es solo un formulario corto" — ahora tiene el mismo tipo de estructura que un CV real, pero con feedback inmediato (el Career Score sube al completar cada sección) en vez de ser un formulario que se llena una vez y se olvida.

## Glockta Store
- **Catálogo dinámico**: `GET /api/products` lee de la tabla `products` (o modo demo sin Supabase). Separa automáticamente pagos (`price > 0`) de capacitaciones gratuitas (`price = 0`).
- **Carrito real**: persiste en `localStorage`, con panel lateral, totales y checkout.
- **Checkout con Mercado Pago**: `POST /api/checkout` crea la orden, genera la preferencia de pago con Mercado Pago Checkout Pro (si está configurado) y redirige al comprador. El webhook (`POST /api/mp/webhook`) confirma el pago y marca la orden como `paid` automáticamente.
- **Capacitaciones gratuitas**: `POST /api/trainings/signup` guarda inscripciones en `training_signups`, para nutrir la base de leads que luego se convierten en compradores de ebooks/mentorías.
- **Glockta for Business**: 3 paquetes orientativos de desarrollo web/consultoría (landing, sitio a medida, consultoría de inclusión) que alimentan el formulario de leads existente (`business_leads`), con confirmación directa por WhatsApp.

## Defensa académica
**Qué hicimos:** separamos frontend, backend, proveedores externos, pagos y matching.
**Por qué:** evita acoplar Glockta a un portal, pasarela o proveedor específico, y permite reemplazar/integrar cada pieza sin reescribir el resto.
**Qué mostramos:** software funcionando de punta a punta (búsqueda, match, mentoría con calendario, curso con certificado, cobro real), contingencia ante APIs caídas, accesibilidad, y un cálculo de compatibilidad explicable.

## Seguridad
- Las claves de Jooble/Adzuna/Mercado Pago quedan sólo en `.env` del backend — el navegador nunca las recibe.
- Supabase usa Row Level Security para proteger datos por usuario (perfil, oportunidades guardadas, progreso de curso, certificados).
- El estado de una orden sólo lo cambia el webhook de Mercado Pago (con la confirmación real del pago), nunca el navegador del comprador.
- El matching no decide contrataciones; sólo explica coincidencias y brechas.

## Privacidad
La página `/privacidad.html` explica en lenguaje simple qué datos se recolectan, para qué se usan, dónde se guardan y cómo ejercer los derechos de acceso/rectificación/supresión, conforme a la Ley 25.326 de Protección de Datos Personales. Está enlazada desde el pie de página del sitio y desde el formulario de checkout.

## Tests automatizados
El proyecto incluye una suite de pruebas con el test runner nativo de Node (no requiere instalar nada extra):

```
npm test
```

Cubre tres niveles (31 pruebas en total):
- **Unitarias de lógica de negocio** (`tests/matchingService.test.js`, `tests/careerScoreService.test.js`, `tests/learningPathService.test.js`): verifican que el cálculo de compatibilidad, el Career Score y la ruta de aprendizaje sean correctos, no distingan mayúsculas/minúsculas, usen `job.skills` cuando existen y nunca "decidan" automáticamente ni inventen un curso inexistente — sólo informan coincidencias, brechas, completitud y próximos pasos reales.
- **Unitarias de integraciones externas** (`tests/aiService.test.js`, `tests/paymentService.test.js`): confirman que, sin credenciales configuradas, el sistema entra en modo demo de forma segura (devuelve `null`/`false`) en vez de romperse.
- **De integración de API** (`tests/api.test.js`): levantan el servidor Express real en un puerto de prueba y validan los endpoints más sensibles — que `/api/config` nunca filtre claves secretas, que los endpoints de IA respondan `503` claro sin `ANTHROPIC_API_KEY`, que el checkout rechace pedidos sin email, que `/api/career-score` calcule bien la completitud, y que `/api/admin/overview` exija el token correcto cuando `ADMIN_TOKEN` está configurado.

Para la defensa: esta suite no busca cobertura exhaustiva (fuera del alcance de un MVP de tesis), sino demostrar una práctica real de calidad sobre las partes más riesgosas del sistema — dinero, datos sensibles y decisiones automáticas.

## Próximos pasos sugeridos (post-tesis, para escalar)
1. Facturación automática (Monotributo/Responsable Inscripto vía AFIP, o un facturador como Alegra/Contabilium) al confirmarse cada pago.
2. WhatsApp Business API real (Meta Cloud API o Twilio) para confirmaciones automáticas de compra/turno, cuando el volumen lo justifique.
3. Panel de administración simple para gestionar productos, capacitaciones y leads sin entrar directo a Supabase.
4. Sumar LinkedIn como segunda identidad de login (OpenID Connect), además de Google.
