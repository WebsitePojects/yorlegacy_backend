-- Yorinternationalprod RLS hardening for public financial/tree tables.
-- Applied after Supabase advisor flagged these tables as public with RLS disabled.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'binary_tree_closure',
    'binary_point_events',
    'pairing_ledger',
    'encashments',
    'rankings',
    'repurchases'
  ]
  loop
    execute format('alter table if exists public.%I enable row level security', target_table);
    execute format('revoke all on table public.%I from anon, authenticated', target_table);
    execute format('grant all on table public.%I to service_role', target_table);

    execute format('drop policy if exists "deny public access" on public.%I', target_table);
    execute format(
      'create policy "deny public access" on public.%I for all to anon, authenticated using (false) with check (false)',
      target_table
    );
  end loop;
end $$;

alter function public.set_row_updated_at() set search_path = public, pg_catalog;
alter function public.yor_next_activation_code_sequence() set search_path = public, pg_catalog;
alter function public.yor_next_member_sequence() set search_path = public, pg_catalog;
