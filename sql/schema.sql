-- GLOCKTA MVP - Supabase/PostgreSQL schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  professional_goal text,
  skills text[] default '{}',
  languages text[] default '{}',
  accessibility_preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_job_id text not null,
  title text not null,
  company text,
  job_url text,
  match_score integer check (match_score between 0 and 100),
  status text not null default 'saved' check (status in ('saved','applied','interview','closed')),
  created_at timestamptz default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null,
  user_email text not null,
  reason text not null,
  scheduled_at timestamptz,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  service text not null,
  message text,
  status text not null default 'new',
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_type text not null check (product_type in ('ebook','course','guide','service')),
  description text,
  price numeric(12,2),
  currency text default 'ARS',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  total numeric(12,2) not null default 0,
  currency text default 'ARS',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz default now()
);
create index if not exists orders_mp_preference_idx on public.orders (mp_preference_id);
create index if not exists orders_mp_payment_idx on public.orders (mp_payment_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null default 0,
  quantity integer not null default 1
);

create table if not exists public.training_signups (
  id uuid primary key default gen_random_uuid(),
  training_name text not null,
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Progreso del curso gratuito y capacitaciones/microcursos: una fila por lección completada.
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null default 'curso-gratis',
  lesson_id text not null,
  completed_at timestamptz default now(),
  unique (user_id, course_id, lesson_id)
);

-- Certificados emitidos al completar un curso (queda un registro verificable).
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  full_name text not null,
  issued_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.course_progress enable row level security;
alter table public.certificates enable row level security;

create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users manage own saved jobs" on public.saved_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own course progress" on public.course_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own certificates" on public.certificates for select using (auth.uid() = user_id);
create policy "users insert own certificates" on public.certificates for insert with check (auth.uid() = user_id);

-- Seed inicial de catálogo (ebooks, guías, cursos y capacitaciones gratuitas)
insert into public.products (name, product_type, description, price, currency) values
  ('CV que abre puertas', 'ebook', 'Guía práctica para transformar experiencia en valor profesional.', 4900, 'ARS'),
  ('Entrevistas con estrategia', 'guide', 'Preguntas, estructura y preparación para entrevistas reales.', 3900, 'ARS'),
  ('LinkedIn que consigue entrevistas', 'course', 'Microcurso para optimizar tu perfil y tu red en 7 días.', 6900, 'ARS'),
  ('Checklist de empleabilidad', 'guide', 'Primer diagnóstico rápido para ordenar tu búsqueda laboral.', 0, 'ARS'),
  ('Reconversión laboral sin miedo', 'ebook', 'Guía para cambiar de rubro o volver al mercado laboral después de una pausa, a cualquier edad.', 5200, 'ARS'),
  ('Negociá tu sueldo', 'ebook', 'Estrategias concretas para negociar una oferta laboral sin subestimarte.', 4500, 'ARS'),
  ('Trabajo remoto accesible', 'course', 'Curso corto sobre herramientas y ajustes para trabajar cómodo con cualquier necesidad de accesibilidad.', 7900, 'ARS'),
  ('Cómo armar tu CV sin experiencia', 'course', 'Capacitación en vivo gratuita, 60 minutos + preguntas.', 0, 'ARS'),
  ('Accesibilidad digital para pymes', 'course', 'Capacitación en vivo gratuita sobre WCAG aplicado a sitios reales.', 0, 'ARS')
on conflict do nothing;
