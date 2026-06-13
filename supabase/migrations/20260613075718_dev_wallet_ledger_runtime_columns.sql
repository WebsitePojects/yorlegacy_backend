-- Dev parity repair for production-mode wallet posting.
-- The runtime repository reads and writes wallet_type + status, but this dev
-- database was still missing both columns.

alter table if exists public.wallet_ledger
  add column if not exists wallet_type text not null default 'main',
  add column if not exists status text not null default 'posted';
