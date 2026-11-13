-- Prenotazioni · 2/3 · salvataggio della prenotazione dal sito
-- Da lanciare una volta, tutto insieme, dopo 01-tabelle.sql.

create or replace function prenota_posti(
  p_giornata uuid, p_nome text, p_email text, p_telefono text, p_posti int
) returns json
language plpgsql security definer set search_path = public as $$
declare
  g giornate;
  occupati int;
  nuovo uuid;
begin
  -- "for update" mette in fila due prenotazioni sulla stessa giornata:
  -- se arrivano insieme sugli ultimi posti, ne passa una sola
  select * into g from giornate
   where giornate.id = p_giornata and attiva and giornate.data >= current_date
   for update;
  if not found then raise exception 'giornata_non_trovata'; end if;

  if length(trim(p_nome)) < 3 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
     or length(regexp_replace(p_telefono, '\D', '', 'g')) < 8 then
    raise exception 'dati_non_validi';
  end if;

  select coalesce(sum(p.posti), 0) into occupati from prenotazioni p
   where p.giornata_id = g.id
     and (p.stato in ('pagata','confermata')
          or (p.stato = 'in_attesa' and p.scade_il > now()));

  if p_posti < 1 or p_posti > g.posti_totali - occupati then
    raise exception 'posti_esauriti';
  end if;

  insert into prenotazioni (giornata_id, nome, email, telefono, posti, stato)
  values (g.id, left(trim(p_nome), 80), left(trim(p_email), 120),
          left(trim(p_telefono), 20), p_posti, 'confermata')
  returning prenotazioni.id into nuovo;

  return json_build_object('id', nuovo);
end $$;

grant execute on function prenota_posti(uuid, text, text, text, int) to anon, authenticated;

-- facoltativo: riepilogo posti visibile solo dal pannello Supabase (Table Editor)
create or replace view riepilogo_giornate as
select g.data, g.titolo, g.posti_totali,
  coalesce(sum(p.posti) filter (where p.stato in ('pagata','confermata')), 0)::int as prenotati,
  g.posti_totali - coalesce(sum(p.posti) filter (where p.stato in ('pagata','confermata')), 0)::int as liberi
from giornate g
left join prenotazioni p on p.giornata_id = g.id
group by g.id
order by g.data;
revoke all on riepilogo_giornate from anon, authenticated;
