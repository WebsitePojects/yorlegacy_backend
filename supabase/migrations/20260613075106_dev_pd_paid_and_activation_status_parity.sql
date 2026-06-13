-- Dev parity repair for production-mode activation codes.
-- 1. Allow unreleased inventory rows, which the app already uses during admin generation.
-- 2. Normalize PD rows to paid, per owner rule clarified on 2026-06-13:
--    only CD carries paid/unpaid settlement behavior.

alter table if exists public.activation_codes
  drop constraint if exists activation_codes_status_check;

alter table if exists public.activation_codes
  add constraint activation_codes_status_check
  check (status in ('unreleased', 'available', 'assigned', 'used', 'disabled'));

update public.activation_codes
set payment_status = 'paid'
where account_type = 'PD'
  and payment_status = 'unpaid';
