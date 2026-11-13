-- Prenotazioni · 3/3 · area riservata per i proprietari
-- Da lanciare una volta, tutto insieme, dopo 02-prenota.sql.
-- ⚠️ Prima di Run cambia TUA-EMAIL@esempio.it in fondo con l'email
--    dell'account che userai per entrare in /admin.

-- 1. chi può entrare nell'area riservata
create table if not exists amministratori (email text primary key);
alter table amministratori enable row level security;
-- nessuna policy: dal sito questa tabella non si legge

create or replace function sono_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from amministratori
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function sono_admin() from public, anon;
grant execute on function sono_admin() to authenticated;

-- 2. nuove informazioni sulle prenotazioni
alter table prenotazioni add column if not exists pagato_in_pista boolean not null default false;
alter table prenotazioni drop constraint if exists prenotazioni_stato_check;
alter table prenotazioni add constraint prenotazioni_stato_check
  check (stato in ('in_attesa','pagata','confermata','annullata','scaduta'));
-- (le prenotazioni "annullata" non contano più come posti occupati)

-- 3. i proprietari vedono e gestiscono tutto, gli altri niente
drop policy if exists "admin gestisce giornate" on giornate;
create policy "admin gestisce giornate" on giornate
  for all to authenticated using (sono_admin()) with check (sono_admin());

drop policy if exists "admin gestisce prenotazioni" on prenotazioni;
create policy "admin gestisce prenotazioni" on prenotazioni
  for all to authenticated using (sono_admin()) with check (sono_admin());

-- 4. il primo amministratore (aggiungine altri con altre righe uguali)
insert into amministratori (email) values ('TUA-EMAIL@esempio.it')
on conflict do nothing;
