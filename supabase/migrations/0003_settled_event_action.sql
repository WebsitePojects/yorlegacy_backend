-- Allow the 'settled' action (payment settlement) on activation-code events,
-- plus forward-compatible 'revoked'/'restored' used by the office revoke flow.
alter table activation_code_events drop constraint if exists activation_code_events_action_check;
alter table activation_code_events add constraint activation_code_events_action_check
  check (action in ('generated', 'released', 'transferred', 'consumed', 'settled', 'revoked', 'restored'));
