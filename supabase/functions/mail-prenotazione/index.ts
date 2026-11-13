// Mery Drift · mail-prenotazione
// Supabase la chiama (Database Webhook) ogni volta che entra una prenotazione:
// manda la conferma al cliente e l'avviso ai proprietari tramite Resend.
//
// Secrets da impostare in Supabase → Edge Functions → Secrets:
//   RESEND_API_KEY    chiave API di Resend (re_...)
//   WEBHOOK_SECRET    una parola segreta a scelta, uguale a quella messa nel Database Webhook
//   MAIL_PROPRIETARI  email che ricevono gli avvisi, separate da virgola
//   MAIL_MITTENTE     facoltativo, es. "Mery Drift <prenotazioni@merydrift.it>"
//                     (senza dominio verificato resta onboarding@resend.dev)
//   SITO_URL          facoltativo, indirizzo del sito per il link nella mail
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase da solo.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SEGRETO = Deno.env.get("WEBHOOK_SECRET") ?? "";
const MITTENTE = Deno.env.get("MAIL_MITTENTE") || "Mery Drift <onboarding@resend.dev>";
const PROPRIETARI = (Deno.env.get("MAIL_PROPRIETARI") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SITO = (Deno.env.get("SITO_URL") ?? "").replace(/\/+$/, "");

const TELEFONO = "340 102 0863";
const INDIRIZZO = "Circuito Mxe.45 · Covo (BG)";
const MAPPA = "https://www.google.com/maps/search/?api=1&query=Circuito+Mxe.45+Covo";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
  "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const dataIt = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${GIORNI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESI[m - 1]} ${y}`;
};
const euro = (c: number) => "€" + (c % 100 ? (c / 100).toFixed(2).replace(".", ",") : String(c / 100));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// layout comune delle mail: scuro, magenta e blu come il sito
function layout(titolo: string, corpo: string) {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#0b0b0e;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#eceae6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#16161b;border:1px solid #2a2a33">
<tr><td style="height:6px;background:#ec1e8f;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ec1e8f">Mery Drift</p>
<h1 style="margin:0;font-size:30px;line-height:1.1;text-transform:uppercase;font-style:italic;color:#eceae6">${titolo}</h1>
</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:16px;line-height:1.55;color:#eceae6">${corpo}</td></tr>
<tr><td style="height:6px;background:#1a33d9;font-size:0;line-height:0">&nbsp;</td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#9ca1a9;text-align:center">${INDIRIZZO} · Tel. ${TELEFONO}</p>
</body></html>`;
}

const riga = (k: string, v: string) =>
  `<tr><td style="padding:9px 0;border-bottom:1px solid #2a2a33;font-family:'Courier New',monospace;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#9ca1a9">${k}</td>` +
  `<td style="padding:9px 0;border-bottom:1px solid #2a2a33;text-align:right;font-weight:bold">${v}</td></tr>`;

async function invia(to: string[], subject: string, html: string, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MITTENTE, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (!SEGRETO || req.headers.get("x-webhook-secret") !== SEGRETO) {
    return new Response("non autorizzato", { status: 401 });
  }
  let evento: { type?: string; record?: Record<string, unknown>; old_record?: Record<string, unknown> };
  try {
    evento = await req.json();
  } catch {
    return new Response("dati", { status: 400 });
  }

  const p = evento.record;
  if (!p) return new Response("ok");
  // mail solo quando la prenotazione diventa valida:
  // subito se confermata, oppure quando un pagamento online passa a "pagata"
  const diventaValida =
    (evento.type === "INSERT" && (p.stato === "confermata" || p.stato === "pagata")) ||
    (evento.type === "UPDATE" && p.stato === "pagata" && evento.old_record?.stato !== "pagata");
  if (!diventaValida) return new Response("ok");

  const { data: g, error } = await supabase.from("giornate")
    .select("data,titolo,prezzo_cent").eq("id", p.giornata_id).single();
  if (error || !g) {
    console.error("giornata", error);
    return new Response("giornata", { status: 500 });
  }

  const posti = Number(p.posti);
  const totale = euro(posti * g.prezzo_cent);
  const quando = dataIt(g.data);
  const pagata = p.stato === "pagata";

  // 1. conferma al cliente
  const cliente = layout("Ci vediamo in pista",
    `<p style="margin:0 0 18px">Ciao ${esc(p.nome)}, la tua prenotazione è confermata.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
${riga("Giornata", esc(g.titolo))}
${riga("Data", esc(quando))}
${riga("Posti", String(posti))}
${riga(pagata ? "Pagato" : "Totale", totale)}
</table>
<p style="margin:20px 0 0">${pagata ? "Il pagamento è stato ricevuto." : "Il pagamento si fa in pista."} Presentati qualche minuto prima per il briefing di sicurezza.</p>
<p style="margin:16px 0 0"><a href="${MAPPA}" style="color:#ec1e8f;font-weight:bold">${INDIRIZZO} →</a></p>
<p style="margin:16px 0 0;color:#9ca1a9;font-size:14px">Non puoi più venire? Chiamaci al ${TELEFONO} così liberiamo il posto per qualcun altro.</p>`);
  const okCliente = await invia([String(p.email)], `Prenotazione confermata · ${quando}`, cliente);

  // 2. avviso ai proprietari
  let okProp = true;
  if (PROPRIETARI.length) {
    const tel = String(p.telefono ?? "");
    const prop = layout("Nuova prenotazione",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
${riga("Nome", esc(p.nome))}
${riga("Telefono", `<a href="tel:${esc(tel.replace(/[^\d+]/g, ""))}" style="color:#eceae6">${esc(tel)}</a>`)}
${riga("Email", `<a href="mailto:${esc(p.email)}" style="color:#eceae6">${esc(p.email)}</a>`)}
${riga("Giornata", esc(g.titolo))}
${riga("Data", esc(quando))}
${riga("Posti", String(posti))}
${riga(pagata ? "Pagato online" : "Da incassare", totale)}
</table>
${SITO ? `<p style="margin:20px 0 0"><a href="${esc(SITO)}/admin/" style="color:#ec1e8f;font-weight:bold">Apri l'area riservata →</a></p>` : ""}`);
    okProp = await invia(PROPRIETARI, `Nuova prenotazione · ${esc(p.nome)} · ${quando}`, prop, String(p.email));
  }

  return new Response(JSON.stringify({ cliente: okCliente, proprietari: okProp }), {
    headers: { "Content-Type": "application/json" },
  });
});
