-- Mery Drift · blocco dei posti per il pagamento
-- Da lanciare una volta nel SQL Editor di Supabase.
-- Blocca i posti in modo sicuro: se due persone prenotano gli ultimi posti
-- nello stesso istante, una sola ci riesce.

create or replace function blocca_posti(
  p_giornata uuid,
  p_nome text,
  p_email text,
  p_telefono text,
  p_posti int
) returns json
language plpgsql security definer set search_path = public as $$
declare
  g giornate;
  occupati int;
  nuovo uuid;
begin
  -- "for update" mette in fila le prenotazioni sulla stessa giornata
  select * into g from giornate
   where id = p_giornata and attiva and giornate.data >= current_date
   for update;
  if not found then
    raise exception 'giornata_non_trovata';
  end if;

  select coalesce(sum(p.posti), 0) into occupati
    from prenotazioni p
   where p.giornata_id = g.id
     and (p.stato = 'pagata' or (p.stato = 'in_attesa' and p.scade_il > now()));

  if p_posti < 1 or p_posti > g.posti_totali - occupati then
    raise exception 'posti_esauriti';
  end if;

  -- il posto resta bloccato 31 minuti: il pagamento Stripe scade dopo 30
  insert into prenotazioni (giornata_id, nome, email, telefono, posti, scade_il)
  values (g.id, p_nome, p_email, p_telefono, p_posti, now() + interval '31 minutes')
  returning id into nuovo;

  return json_build_object(
    'id', nuovo,
    'titolo', g.titolo,
    'data', g.data,
    'prezzo_cent', g.prezzo_cent
  );
end $$;

-- solo le funzioni del server possono bloccare posti, non il sito direttamente
revoke execute on function blocca_posti(uuid, text, text, text, int) from public, anon, authenticated;
