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
