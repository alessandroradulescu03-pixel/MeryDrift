// Mery Drift · crea-prenotazione
// Riceve i dati dal form di prenota.html, blocca i posti e crea il pagamento Stripe.
// Secrets richiesti: STRIPE_SECRET_KEY, SITO_URL
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase da solo)
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const SITO = (Deno.env.get("SITO_URL") ?? "").replace(/\/+$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const risposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
  "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const dataIt = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MESI[m - 1]} ${y}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return risposta({ errore: "metodo" }, 405);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return risposta({ errore: "dati" }, 400);
  }

  const giornata = String(b.giornata_id ?? "");
  const nome = String(b.nome ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().slice(0, 120);
  const telefono = String(b.telefono ?? "").trim().slice(0, 20);
  const posti = Number(b.posti);

  if (
    !/^[0-9a-f-]{36}$/i.test(giornata) ||
    nome.length < 3 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
    telefono.replace(/\D/g, "").length < 8 ||
    !Number.isInteger(posti) || posti < 1 || posti > 20
  ) {
    return risposta({ errore: "dati" }, 400);
  }

  // 1. blocca i posti nel database
  const { data: p, error } = await supabase.rpc("blocca_posti", {
    p_giornata: giornata,
    p_nome: nome,
    p_email: email,
    p_telefono: telefono,
    p_posti: posti,
  });
  if (error) {
    if (error.message.includes("posti_esauriti")) return risposta({ errore: "posti_esauriti" }, 409);
    if (error.message.includes("giornata_non_trovata")) return risposta({ errore: "giornata" }, 410);
    console.error(error);
    return risposta({ errore: "db" }, 500);
  }

  // 2. crea il pagamento Stripe
  try {
    const sessione = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "it",
      customer_email: email,
      line_items: [{
        quantity: posti,
        price_data: {
          currency: "eur",
          unit_amount: p.prezzo_cent,
          product_data: { name: `${p.titolo} · ${dataIt(p.data)}` },
        },
      }],
      metadata: { prenotazione_id: p.id },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${SITO}/prenota.html?esito=ok`,
      cancel_url: `${SITO}/prenota.html?esito=annullato`,
    });

    await supabase.from("prenotazioni")
      .update({ stripe_session_id: sessione.id })
      .eq("id", p.id);

    return risposta({ url: sessione.url });
  } catch (e) {
    // Stripe non ha risposto: libero subito i posti
    console.error(e);
    await supabase.from("prenotazioni").update({ stato: "scaduta" }).eq("id", p.id);
    return risposta({ errore: "stripe" }, 502);
  }
});
