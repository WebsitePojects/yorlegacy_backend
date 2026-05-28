create extension if not exists pgcrypto;

create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  eyebrow text,
  strapline text,
  summary text not null,
  stats jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_href text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists page_sections (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references site_pages(slug) on delete cascade,
  section_key text not null,
  heading text not null,
  body text not null,
  sort_order integer not null default 0
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists member_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  referral_code text unique,
  sponsor_code text,
  package_tier text,
  account_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  access_scope text not null default 'platform',
  office_title text not null default 'Operations Admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
