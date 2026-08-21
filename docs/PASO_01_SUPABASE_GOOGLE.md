# PASO 01 — Supabase + Login con Google

## Objetivo
Conectar GLOCKTA a una base PostgreSQL real y habilitar autenticación con Google mediante Supabase Auth.

## Qué queda preparado en el código
- Botón **Ingresar con Google**.
- Sesión persistente mediante Supabase Auth.
- Nombre del usuario visible en la interfaz al iniciar sesión.
- Cierre de sesión.
- Career Passport sincronizado con la tabla `profiles` cuando el usuario está autenticado.
- Guardado de oportunidades en `saved_jobs` usando Row Level Security.
- Modo local/demo si todavía no hay credenciales.

## Configuración manual
1. Crear un proyecto nuevo en Supabase.
2. Abrir **SQL Editor** y ejecutar `sql/schema.sql`.
3. Ir a la configuración del proyecto y copiar la **Project URL** y la **anon/publishable key**.
4. Crear `.env` a partir de `.env.example` y completar:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

La service role key sólo se usa en el backend. Nunca debe colocarse en `public/` ni subirse a GitHub.

5. En Google Cloud crear/configurar el proyecto OAuth y un cliente Web.
6. En Supabase > Authentication > Providers > Google, activar Google y pegar Client ID + Client Secret.
7. Usar como callback autorizado de Google el callback que Supabase muestra en la configuración del proveedor.
8. En Supabase > Authentication > URL Configuration agregar:
   - `http://localhost:3000` como URL local permitida.
   - La URL pública del sitio cuando se haga el deploy.
9. Instalar y ejecutar:

```bash
npm install
npm start
```

10. Abrir `http://localhost:3000`, presionar **Ingresar con Google** y verificar que luego aparezca el nombre del usuario.

## Cómo defenderlo
**Qué hicimos:** implementamos autenticación federada con Google usando Supabase Auth.

**Por qué:** evitamos almacenar contraseñas de Google; el usuario se autentica con un proveedor de identidad externo y GLOCKTA recibe una sesión autorizada.

**Qué protocolo interviene:** OAuth 2.0 / OpenID Connect.

**Qué hace Supabase:** administra la sesión y vincula la identidad autenticada con `auth.users`.

**Cómo protegemos los datos:** `profiles` y `saved_jobs` tienen Row Level Security; cada usuario sólo puede leer o modificar sus propios datos.

**Dónde están las claves sensibles:** las claves privadas y secretos quedan en variables de entorno del backend, no en el navegador. La anon/publishable key sí puede ser utilizada por el cliente cuando RLS está correctamente configurado.

## Frase de defensa
> “Elegí autenticación federada con Google sobre Supabase Auth para reducir fricción de onboarding y evitar gestionar credenciales de terceros. La identidad se vincula a PostgreSQL y las políticas RLS aíslan los datos de cada usuario.”
