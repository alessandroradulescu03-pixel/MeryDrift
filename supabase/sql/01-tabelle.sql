-- Prenotazioni · 1/3 · tabelle e calendario
-- Da lanciare una volta, tutto insieme, nel SQL Editor di un progetto Supabase NUOVO.

create table giornate (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  titolo text not null,
  posti_totali int not null check (posti_totali > 0),   -- capienza: non cambia con le prenotazioni
  prezzo_cent int not null check (prezzo_cent >= 0),    -- in centesimi: 5000 = 50 €
  attiva boolean not null default true                   -- false = prenotazioni chiuse
);

create table prenotazioni (
  id uuid primary key default gen_random_uuid(),
  giornata_id uuid not null references giornate(id),
  nome text not null,
  email text not null,
  telefono text,
  posti int not null default 1 check (posti > 0),
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa','pagata','confermata','annullata','scaduta')),
  stripe_session_id text,
  scade_il timestamptz,
  creata_il timestamptz not null default now()
);

alter table giornate enable row level security;
alter table prenotazioni enable row level security;

-- il sito pubblico vede solo le giornate aperte (mai le prenotazioni)
create policy "giornate visibili a tutti" on giornate for select using (attiva);

-- posti liberi calcolati: capienza meno prenotazioni valide
create or replace function disponibilita()
returns table (id uuid, data date, titolo text, prezzo_cent int, posti_liberi int)
language sql security definer set search_path = public as $$
  select g.id, g.data, g.titolo, g.prezzo_cent,
    g.posti_totali - coalesce(sum(p.posti) filter (
      where p.stato in ('pagata','confermata')
         or (p.stato = 'in_attesa' and p.scade_il > now())), 0)::int
  from giornate g
  left join prenotazioni p on p.giornata_id = g.id
  where g.attiva and g.data >= current_date
  group by g.id
  order by g.data;
$$;
grant execute on function disponibilita() to anon, authenticated;
