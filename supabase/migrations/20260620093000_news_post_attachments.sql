alter table if exists public.news_posts
  add column if not exists attachments jsonb not null default '[]'::jsonb;
