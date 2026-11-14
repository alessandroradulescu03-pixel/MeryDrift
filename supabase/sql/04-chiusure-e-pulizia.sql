-- Prenotazioni · 4/4 · motivo di chiusura delle giornate + pulizia automatica
-- Da lanciare una volta, tutto insieme, nel SQL Editor dopo 03-area-riservata.sql.

-- 1. motivo della chiusura (es. "Pioggia", "Pista non agibile")
--    giornata chiusa CON motivo  -> sul sito si vede "Chiusa" con il motivo
--    giornata chiusa SENZA motivo -> sul sito non si vede proprio (come prima)
alter table giornate add column if not exists motivo_chiusura text;

-- 2. il calendario pubblico ora riceve anche le giornate chiuse con un motivo
drop function if exists disponibilita();
create function disponibilita()
returns table (id uuid, data date, titolo text, prezzo_cent int, posti_liberi int,
               chiusa boolean, motivo_chiusura text)
language sql security definer set search_path = public as $$
  select g.id, g.data, g.titolo, g.prezzo_cent,
    case when g.attiva then
      g.posti_totali - coalesce(sum(p.posti) filter (
        where p.stato in ('pagata','confermata')
           or (p.stato = 'in_attesa' and p.scade_il > now())), 0)::int
    else 0 end,
    not g.attiva,
    case when g.attiva then null else g.motivo_chiusura end
  from giornate g
  left join prenotazioni p on p.giornata_id = g.id
  where g.data >= current_date
    and (g.attiva or coalesce(trim(g.motivo_chiusura), '') <> '')
  group by g.id
  order by g.data;
$$;
grant execute on function disponibilita() to anon, authenticated;
-- (prenota_posti accetta già solo le giornate aperte: niente da cambiare)

-- 3. privacy: le prenotazioni si cancellano da sole 12 mesi dopo la giornata
create or replace function pulisci_prenotazioni_vecchie() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from prenotazioni p
   using giornate g
   where p.giornata_id = g.id
     and g.data < current_date - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function pulisci_prenotazioni_vecchie() from public, anon, authenticated;

-- la pulizia gira da sola ogni notte alle 3:30
create extension if not exists pg_cron;
select cron.unschedule('pulizia-prenotazioni')
 where exists (select 1 from cron.job where jobname = 'pulizia-prenotazioni');
select cron.schedule('pulizia-prenotazioni', '30 3 * * *',
  $$select public.pulisci_prenotazioni_vecchie()$$);
