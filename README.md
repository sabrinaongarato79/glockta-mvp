# GLOCKTA — Inclusive Employability Accelerator

Plataforma de empleabilidad inclusiva: perfil profesional (Career Passport), búsqueda de oportunidades con matching explicable, cierre de brechas de habilidades y cobro real, con foco en accesibilidad para personas de cualquier edad, idioma y nivel tecnológico.

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

Sin completar ningún `.env`, el sitio funciona en **modo demo**: catálogo, checkout, turnos, capacitaciones y leads quedan registrados en la respuesta de la API aunque no haya base de datos ni Mercado Pago conectados. Sirve para probar la UX, pero no persiste nada ni cobra de verdad — para eso hay que completar Supabase y Mercado Pago (siguiente sección).

---

## Puesta en marcha en producción

### 1. Base de datos — Supabase
1. Creá un proyecto gratis en [supabase.com](https://supabase.com).
2. En **Project Settings → API** copiá `Project URL`, `anon public key` y `service_role key`.
3. Pegalos en tu `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. En el editor SQL de Supabase, corré todo el contenido de `sql/schema.sql`. Crea: `profiles`, `saved_jobs`, `appointments`, `business_leads`, `products`, `orders`, `order_items`, `training_signups`, `course_progress`, `certificates`, `experience`, `education`, `certifications` y `portfolio_items`, con Row Level Security activado donde corresponde.
5. En **Authentication → Providers**, activá Google y completá el Client ID/Secret de un OAuth Client de Google Cloud (tipo "Web application", con `https://TU-PROYECTO.supabase.co/auth/v1/callback` como redirect URI).

Con esto el login con Google, el Career Passport, las oportunidades guardadas, el progreso del curso y los certificados quedan guardados por usuario (antes vivían solo en `localStorage` del navegador).

### 2. Cobros reales — Mercado Pago
1. Entrá a [mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel) con tu cuenta de Mercado Pago (o creá una).
2. Creá una aplicación → copiá las credenciales de prueba (`Access Token` que empieza con `TEST-`).
3. Pegalo en `.env` como `MP_ACCESS_TOKEN` (y opcionalmente `MP_PUBLIC_KEY`).
4. Completá `PUBLIC_BASE_URL` con la URL pública donde esté hosteado el sitio (en local podés dejarlo vacío; Mercado Pago necesita una URL pública real para el webhook, así que esta parte se prueba una vez deployado — ver sección de Hosting).
5. Al comprar algo en la tienda, el checkout crea una preferencia real de Mercado Pago (Checkout Pro) y redirige al comprador a pagar. Cuando el pago se aprueba, Mercado Pago llama a `/api/mp/webhook` y la orden pasa de `pending` a `paid` automáticamente.
6. Para cobrar de verdad, reemplazá las credenciales de prueba por las de producción en el mismo panel de Mercado Pago.

Si `MP_ACCESS_TOKEN` está vacío, el checkout queda en modo demo (registra la orden como `pending` sin cobrar).

### 3. WhatsApp
Completá `WHATSAPP_NUMBER` en `.env` con tu número en formato internacional sin signos ni espacios (ej. `5491122334455` = 54 Argentina + 9 + código de área sin el 0 + número sin el 15).

Activa el botón flotante de WhatsApp en todo el sitio, la confirmación de turnos de mentoría, la confirmación de solicitudes de empresas y el link del footer, cada uno con un mensaje precargado distinto según de dónde vengan.

Es un botón "click to chat" (`wa.me`), sin costo y sin necesidad de aprobar ninguna cuenta. El siguiente nivel (mensajes automáticos, confirmaciones de compra por WhatsApp) requiere WhatsApp Business API vía Meta o Twilio, con costo por mensaje y verificación de varios días.

### 4. Asistente de IA (Claude)
Completá `ANTHROPIC_API_KEY` en `.env` con una clave de [console.anthropic.com](https://console.anthropic.com). Activa dos funciones opcionales:

- **Completar el Career Passport con IA**: la persona cuenta su experiencia en un texto libre y se completan objetivo, habilidades e idiomas del formulario.
- **Consejo personalizado por oportunidad**: en cada resultado de búsqueda, un botón "Ver consejo personalizado" redacta, en base al mismo cálculo de coincidencias/brechas del Glockta Match, un consejo breve.

Sin esta clave, ambos botones quedan ocultos y el resto del sitio sigue funcionando igual.

### 5. Calendario de mentorías
Funciona sin configuración adicional: al reservar un turno aparecen dos botones — "Agregar a Google Calendar" y "Descargar .ics" (compatible con Google Calendar, Outlook y Apple Calendar). No requiere OAuth.

### 6. Curso gratuito y certificado
El curso persiste el avance en `localStorage` como invitado, y si el usuario inicia sesión con Google, el progreso se sincroniza a la tabla `course_progress` en Supabase. Al completar las 4 lecciones se emite un certificado descargable (PDF vía diálogo de impresión del navegador) y, si el usuario está logueado, queda un registro en la tabla `certificates`.

---

## Subir el proyecto a GitHub

1. Entrá a [github.com/new](https://github.com/new) y creá un repositorio vacío (por ejemplo `glockta-mvp`). No marques "Add a README" ni ".gitignore" — ya los tenemos.
2. Copiá la URL que te da GitHub (algo como `https://github.com/TU-USUARIO/glockta-mvp.git`).
3. En una terminal, parado en esta carpeta:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/glockta-mvp.git
   git branch -M main
   git push -u origin main
   ```
4. GitHub va a pedir iniciar sesión la primera vez (usuario + contraseña de acceso personal, o token).

Cada cambio nuevo se sube con:
```bash
git add .
git commit -m "Descripción del cambio"
git push
```

El archivo `.env` con claves reales nunca se sube (está en `.gitignore`). Al hostear el sitio, esas variables se cargan directamente en el panel del hosting.

---

## Hosting

Cualquiera de estos sirve gratis para un backend Node/Express:

1. **Render**: New → Web Service → conectá el repo de GitHub → Build command `npm install` → Start command `npm start` → cargá las variables de entorno en la sección "Environment".
2. **Railway**: New Project → Deploy from GitHub repo → cargá las mismas variables de entorno.

Una vez deployado, actualizá `PUBLIC_BASE_URL` en las variables de entorno del hosting con esa URL pública (necesaria para el webhook de Mercado Pago).

## PWA → APK
El sitio ya es una PWA instalable: manifest (`public/manifest.webmanifest`), service worker (`public/sw.js`) con caché de shell offline, íconos 192/512, y un botón "Instalar app" que aparece automáticamente en Chrome/Edge cuando el sitio está hosteado con HTTPS.

Para obtener el .apk (sin escribir código nativo aparte):
1. Hosteá el sitio en HTTPS.
2. Entrá a **https://www.pwabuilder.com**, pegá la URL pública.
3. PWABuilder valida el manifest y el service worker y genera un paquete para Android con Bubblewrap.
4. Descargá el `.apk` (o `.aab` para Play Store) firmado.

La APK y el Website comparten el mismo backend, base de datos y lógica.

## Wizard de 3 pasos
`#inicio` es una pantalla liviana con un solo mensaje y un botón ("Empezar →"). El Career Passport se recorre como un asistente de 3 pasos con un indicador visual ("Paso X de 3"):

1. **Tu perfil** — nombre, objetivo, habilidades e idiomas (con el asistente de IA opcional).
2. **Experiencia** — experiencia laboral, educación, certificaciones y portfolio (opcional).
3. **Oportunidades** — al guardar el perfil se destraba automáticamente la sección de búsqueda (`#jobs`) y la página hace scroll directo ahí.

La sección de Oportunidades sigue siendo alcanzable en cualquier momento desde el menú "Oportunidades" o desde "¿Ya tenés tu perfil? Ir directo a Oportunidades" en el hero. Cambio de interfaz únicamente (`public/index.html`, `public/app.js`, `public/styles.css`); no se tocó ningún endpoint.

## Jerarquía visual
El núcleo (Career Passport → Oportunidades → Curso gratuito) queda numerado 01/02/03 y resaltado en la navegación (`.nav-core`). Después hay un separador visual y aparecen Mentoría, Capacitaciones, Tienda y Empresas, marcadas con "Complemento ·" en un tono más apagado. Cambio de jerarquía visual y de orden en el HTML; ninguna sección se eliminó.

## Catálogo
El catálogo de Glockta Store y Capacitaciones tiene 24 ítems (18 pagos, 6 gratuitos) que cubren las palabras clave del diccionario de habilidades del Glockta Match (excel, sql, power bi, html/css/javascript, canva, inglés, portugués, español, crm, google analytics, ventas, atención al cliente, comunicación, organización, administración, facturación, redes sociales, marketing, scrum, liderazgo, primeros auxilios, cuidado de adultos mayores, contenidos web). El seed vive en `sql/schema.sql` (Supabase) y en `DEMO_PRODUCTS`/`DEMO_TRAININGS` de `src/server.js` (modo demo) — mantenelos sincronizados si agregás o cambiás productos.

## Learning Path
Cada oportunidad con brechas detectadas muestra un botón "Ver ruta para cerrar la brecha". `POST /api/learning-path` conecta cada habilidad faltante con un producto del catálogo si su nombre o descripción la menciona, o si no hay ninguno, con un enlace de búsqueda externo. Cálculo por palabra clave, sin IA; nunca inventa un curso inexistente (cubierto por tests).

## Onboarding
En la primera visita (detectado por `localStorage`) aparece un diálogo de 2 preguntas: qué te trae por GLOCKTA (buscar empleo, capacitarte, mejorar el perfil o "soy una empresa") y si necesitás alto contraste o texto más grande. Según la respuesta, la página hace scroll directo a la sección más relevante. Un usuario con perfil ya guardado no ve el onboarding.

## Career Passport ampliado (Career Score)
Suma secciones editables de experiencia laboral, educación, certificaciones y portfolio/evidencia.

- **Career Score**: `POST /api/career-score` calcula, sin IA, qué porcentaje del pasaporte está completo (7 secciones en partes iguales) y devuelve qué falta (`missingSections`). Se muestra en vivo en la tarjeta del pasaporte al guardar el perfil.
- **Persistencia**: logueado con Google, cada sección se guarda en su propia tabla de Supabase (`experience`, `education`, `certifications`, `portfolio_items`) con el patrón "reemplazar todo" (se borran las filas anteriores y se insertan las actuales). Sin sesión, se guarda en `localStorage`.

## Glockta Store
- **Catálogo dinámico**: `GET /api/products` lee de la tabla `products` (o modo demo). Separa pagos (`price > 0`) de capacitaciones gratuitas (`price = 0`).
- **Carrito**: persiste en `localStorage`, con panel lateral, totales y checkout.
- **Checkout con Mercado Pago**: `POST /api/checkout` crea la orden y la preferencia de pago (si está configurado) y redirige al comprador. El webhook (`POST /api/mp/webhook`) confirma el pago y marca la orden como `paid`.
- **Capacitaciones gratuitas**: `POST /api/trainings/signup` guarda inscripciones en `training_signups`.
- **Glockta for Business**: 3 paquetes de desarrollo web/consultoría que alimentan el formulario de leads (`business_leads`), con confirmación por WhatsApp.

## Seguridad
- Las claves de Jooble/Adzuna/Mercado Pago quedan solo en `.env` del backend; el navegador nunca las recibe.
- Supabase usa Row Level Security para proteger datos por usuario.
- El estado de una orden solo lo cambia el webhook de Mercado Pago, nunca el navegador del comprador.
- El matching no decide contrataciones; solo informa coincidencias y brechas.

## Privacidad
La página `/privacidad.html` explica qué datos se recolectan, para qué se usan, dónde se guardan y cómo ejercer los derechos de acceso/rectificación/supresión, conforme a la Ley 25.326. Enlazada desde el pie de página y el checkout.

## Tests automatizados
```
npm test
```

31 pruebas con el test runner nativo de Node:
- **Lógica de negocio** (`tests/matchingService.test.js`, `tests/careerScoreService.test.js`, `tests/learningPathService.test.js`): matching, Career Score y Learning Path — sin distinguir mayúsculas/minúsculas, sin inventar cursos inexistentes.
- **Integraciones externas** (`tests/aiService.test.js`, `tests/paymentService.test.js`): sin credenciales, el sistema entra en modo demo (`null`/`false`) en vez de romperse.
- **API** (`tests/api.test.js`): servidor Express real en un puerto de prueba; valida que `/api/config` no filtre claves secretas, que los endpoints de IA respondan `503` sin `ANTHROPIC_API_KEY`, que el checkout rechace pedidos sin email, y que `/api/admin/overview` exija el token correcto.

## Próximos pasos
1. Facturación automática (Monotributo/Responsable Inscripto vía AFIP, o un facturador como Alegra/Contabilium) al confirmarse cada pago.
2. WhatsApp Business API real (Meta Cloud API o Twilio) para confirmaciones automáticas de compra/turno.
3. Panel de administración simple para gestionar productos, capacitaciones y leads sin entrar directo a Supabase.
4. Sumar LinkedIn como segunda identidad de login (OpenID Connect), además de Google.
