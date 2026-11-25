-- Stato pista MXE.45 · aperture, chiusure e avvisi del giorno
-- Da lanciare una volta, tutto insieme, nel SQL Editor dopo 04-chiusure-e-pulizia.sql.
--
-- Come funziona: l'orario normale (lunedì chiuso, gli altri giorni 9-17) è scritto nel sito.
-- Qui si salvano SOLO le eccezioni, un giorno per riga:
--   aperto = false            -> quel giorno chiuso, con il motivo (es. "Pioggia", "Gara")
--   aperto = true + apre/chiude -> orario diverso (o aperto in un giorno di solito chiuso)
--   avviso                     -> una riga di testo che il sito mostra sotto lo stato
-- Se la riga non c'è, vale l'orario normale.
--
-- ⚠️ Per ora sta nel progetto di Mery Drift. Quando MXE avrà il suo progetto Supabase
--    basta lanciare questo stesso file là (cambiando la parte "chi può modificare")
--    e cambiare SB_URL / SB_KEY in cima a main.js e admin.js di MXE.

create table if not exists stato_pista (
  data date primary key,
  aperto boolean not null,
  apre time,
  chiude time,
  motivo text check (motivo is null or char_length(motivo) <= 80),
  avviso text check (avviso is null or char_length(avviso) <= 160),
  aggiornato_il timestamptz not null default now(),
  check (apre is null or chiude is null or apre < chiude)
);

alter table stato_pista enable row level security;

-- il sito pubblico legge lo stato (non c'è niente di privato)
drop policy if exists "stato pista visibile a tutti" on stato_pista;
create policy "stato pista visibile a tutti" on stato_pista
  for select to anon, authenticated using (true);

-- solo i proprietari (tabella amministratori: login di /admin su MXE.45) possono cambiarlo
drop policy if exists "admin gestisce stato pista" on stato_pista;
create policy "admin gestisce stato pista" on stato_pista
  for all to authenticated using (sono_admin()) with check (sono_admin());

grant select on stato_pista to anon, authenticated;
grant insert, update, delete on stato_pista to authenticated;

-- data dell'ultima modifica sempre aggiornata
create or replace function stato_pista_aggiornato() returns trigger
language plpgsql as $$ begin new.aggiornato_il = now(); return new; end $$;
drop trigger if exists stato_pista_aggiornato on stato_pista;
create trigger stato_pista_aggiornato before update on stato_pista
  for each row execute function stato_pista_aggiornato();

-- pulizia: le righe dei giorni passati da più di 30 giorni si cancellano da sole (ogni notte alle 3:40)
select cron.unschedule('pulizia-stato-pista')
 where exists (select 1 from cron.job where jobname = 'pulizia-stato-pista');
select cron.schedule('pulizia-stato-pista', '40 3 * * *',
  $$delete from public.stato_pista where data < current_date - 30$$);
