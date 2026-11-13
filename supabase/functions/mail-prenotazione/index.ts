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
//   MAIL_RISPOSTE     facoltativo, email dove arrivano le risposte dei clienti
//                     (se manca, la prima di MAIL_PROPRIETARI)
//   SITO_URL          facoltativo, indirizzo del sito (serve per logo e link)
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
const RISPOSTE = Deno.env.get("MAIL_RISPOSTE") || PROPRIETARI[0] || "";
const SITO = (Deno.env.get("SITO_URL") || "https://alessandroradulescu03-pixel.github.io/MeryDrift").replace(/\/+$/, "");

// ---------- dati fissi di Mery Drift ----------
const TELEFONO = "340 102 0863";
const TEL_LINK = "tel:+393401020863";
const LUOGO = "Circuito Mxe.45";
const PAESE = "Covo (BG)";
const MAPPA = "https://www.google.com/maps/search/?api=1&query=Circuito+Mxe.45+Covo+BG";
const INSTAGRAM = "https://www.instagram.com/merydrift/";
const ORARI = "9:00 – 17:00";

// ---------- colori (gli stessi del sito) ----------
const NERO = "#0b0b0e", ASFALTO = "#16161b", LINEA = "#2a2a33", FUMO = "#eceae6",
  CENERE = "#9ca1a9", ROSA = "#ec1e8f", BLU = "#1a33d9", BLU_CHIARO = "#5b78ff",
  VERDE = "#5be38f", GIALLO = "#ffc65c";
const DISPLAY = "'Big Shoulders Display','Arial Narrow',Impact,'Helvetica Neue',Arial,sans-serif";
const TESTO = "Barlow,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',Menlo,Consolas,'Courier New',monospace";

// ---------- utilità ----------
type Rec = Record<string, unknown>;
type Giornata = { data: string; titolo: string; prezzo_cent: number; posti_totali: number };

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
  "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MESI_S = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const parti = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y, m, d }; };
const giornoSett = (s: string) => { const { y, m, d } = parti(s); return GIORNI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
const dataLunga = (s: string) => { const { m, d } = parti(s); return `${giornoSett(s)} ${d} ${MESI[m - 1]}`; };
const euro = (c: number) => "€" + (c % 100 ? (c / 100).toFixed(2).replace(".", ",") : String(c / 100));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nomeProprio = (n: string) => esc(String(n).trim().split(/\s+/)[0] || n);
const oraRoma = (ts: string) => {
  try {
    return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch { return ""; }
};
const linkCalendario = (data: string, titolo: string, posti: number) => {
  const { y, m, d } = parti(data);
  const f = (dt: Date) => dt.toISOString().slice(0, 10).replace(/-/g, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Mery Drift · ${titolo}`,
    dates: `${f(new Date(Date.UTC(y, m - 1, d)))}/${f(new Date(Date.UTC(y, m - 1, d + 1)))}`,
    details: `${posti} ${posti === 1 ? "posto prenotato" : "posti prenotati"}. Info: ${TELEFONO}`,
    location: `${LUOGO}, ${PAESE}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

// ---------- mattoncini grafici (tabelle: le uniche che tutti i programmi di posta capiscono) ----------
const cordolo = () => {
  const celle = Array.from({ length: 12 }, (_, i) =>
    `<td style="height:8px;background:${i % 2 ? FUMO : (i % 4 === 0 ? ROSA : BLU)};font-size:0;line-height:0">&nbsp;</td>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${celle}</tr></table>`;
};

const pulsante = (testo: string, link: string, sfondo: string, colore = "#ffffff", bordo = sfondo) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${sfondo}" style="background:${sfondo};border:2px solid ${bordo}">
<a href="${link}" target="_blank" style="display:block;padding:15px 14px;font-family:${TESTO};font-size:17px;font-weight:700;color:${colore};text-decoration:none">${testo}</a>
</td></tr></table>`;

const riga = (k: string, v: string, ultima = false) =>
  `<tr><td style="padding:12px 0;${ultima ? "" : `border-bottom:1px solid ${LINEA};`}font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${CENERE};vertical-align:middle">${k}</td>
<td align="right" style="padding:12px 0 12px 12px;${ultima ? "" : `border-bottom:1px solid ${LINEA};`}font-family:${TESTO};font-size:16px;font-weight:700;color:${FUMO};word-break:break-word">${v}</td></tr>`;

const dueBottoni = (a: string, b: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="col" width="50%" valign="top" style="padding:0 5px 0 0">${a}</td>
<td class="col col2" width="50%" valign="top" style="padding:0 0 0 5px">${b}</td>
</tr></table>`;

function guscio(preheader: string, contenuto: string, piede: string) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>Mery Drift</title>
<style>
  @media (max-width:600px){
    .px{padding-left:20px!important;padding-right:20px!important}
    .h1{font-size:34px!important;line-height:36px!important}
    .col{display:block!important;width:100%!important;padding:0!important}
    .col2{padding-top:10px!important}
    .textcol{display:block!important;width:auto!important;padding:16px 18px 18px!important}
    .datecol{display:block!important;width:auto!important;border-right:0!important;border-bottom:1px solid ${LINEA}!important;padding:16px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${NERO}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${NERO}">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${NERO}" style="background:${NERO}">
<tr><td align="center" style="padding:24px 10px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${ASFALTO};border:1px solid ${LINEA}">
<tr><td>${cordolo()}</td></tr>
<tr><td align="center" bgcolor="${NERO}" style="background:${NERO};padding:26px 20px 18px">
<a href="${SITO}/" target="_blank"><img src="${SITO}/img/email/logo-mail.png" width="230" alt="MERY DRIFT" style="display:block;width:230px;max-width:70%;height:auto;border:0;font-family:${DISPLAY};font-size:34px;font-weight:900;font-style:italic;color:${ROSA}"></a>
</td></tr>
${contenuto}
<tr><td>${cordolo()}</td></tr>
</table>
${piede}
</td></tr></table>
</body></html>`;
}

const piedePubblico = () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" style="padding:22px 16px 0;font-family:${TESTO};font-size:13px;line-height:20px;color:${CENERE}">
<strong style="color:${FUMO}">Mery Drift</strong> · ${LUOGO} · ${PAESE}<br>
<a href="${TEL_LINK}" style="color:${CENERE};text-decoration:none">Tel. ${TELEFONO}</a> · <a href="${INSTAGRAM}" style="color:${ROSA};text-decoration:none">Instagram @merydrift</a><br>
<span style="font-size:12px">Ricevi questa mail perché hai prenotato sul sito di Mery Drift.</span>
</td></tr></table>`;

// ---------- MAIL AL CLIENTE ----------
export function mailCliente(p: Rec, g: Giornata) {
  const posti = Number(p.posti), pagata = p.stato === "pagata";
  const { d, m } = parti(g.data);
  const totale = euro(posti * g.prezzo_cent);
  const contenuto = `
<tr><td class="px" style="padding:30px 36px 6px">
<p style="margin:0 0 8px;font-family:${MONO};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${ROSA}">✓ Prenotazione confermata</p>
<h1 class="h1" style="margin:0;font-family:${DISPLAY};font-size:42px;line-height:44px;font-weight:900;font-style:italic;text-transform:uppercase;color:${FUMO}">Ci vediamo<br>in pista, <span style="color:${BLU_CHIARO}">${nomeProprio(String(p.nome))}</span>!</h1>
<p style="margin:16px 0 0;font-family:${TESTO};font-size:17px;line-height:26px;color:#c9ccd2">Il tuo posto è riservato. Qui sotto trovi tutto quello che ti serve per la giornata.</p>
</td></tr>

<tr><td class="px" style="padding:24px 36px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NERO};border:1px solid ${LINEA};border-left:6px solid ${ROSA}">
<tr>
<td width="118" align="center" valign="middle" class="datecol" style="padding:20px 10px;border-right:1px solid ${LINEA}">
<div style="font-family:${DISPLAY};font-size:72px;line-height:66px;font-weight:900;font-style:italic;color:${ROSA}">${d}</div>
<div style="font-family:${MONO};font-size:13px;letter-spacing:3px;color:${CENERE};margin-top:6px">${MESI_S[m - 1]}</div>
</td>
<td valign="middle" class="textcol" style="padding:18px 22px">
<div style="font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${CENERE}">${esc(giornoSett(g.data))}</div>
<div style="font-family:${DISPLAY};font-size:30px;line-height:32px;font-weight:800;text-transform:uppercase;color:${FUMO};margin:4px 0 8px">${esc(g.titolo)}</div>
<div style="font-family:${TESTO};font-size:16px;line-height:22px;color:#c9ccd2">Orari pista ${ORARI}<br>${LUOGO} · ${PAESE}</div>
</td>
</tr></table>
</td></tr>

<tr><td class="px" style="padding:10px 36px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${riga("Prenotato da", esc(p.nome))}
${riga("Posti", `${posti}`)}
${riga("Prezzo a persona", euro(g.prezzo_cent))}
${riga(pagata ? "Pagato online" : "Totale", `<span style="font-family:${DISPLAY};font-size:26px;font-weight:900;color:${pagata ? VERDE : FUMO}">${totale}</span>`, true)}
</table>
<p style="margin:6px 0 0;font-family:${TESTO};font-size:15px;line-height:22px;color:${pagata ? VERDE : GIALLO}">${pagata ? "✓ Pagamento ricevuto, sei a posto." : "Il pagamento si fa direttamente in pista."}</p>
</td></tr>

<tr><td class="px" style="padding:26px 36px 6px">
${dueBottoni(pulsante("📅&nbsp; Aggiungi al calendario", linkCalendario(g.data, g.titolo, posti), ROSA),
    pulsante("📍&nbsp; Come arrivare", MAPPA, NERO, FUMO, FUMO))}
</td></tr>

<tr><td class="px" style="padding:24px 36px 8px">
<p style="margin:0 0 12px;font-family:${DISPLAY};font-size:24px;font-weight:800;font-style:italic;text-transform:uppercase;color:${FUMO}">Prima di <span style="color:${BLU_CHIARO}">entrare</span></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${TESTO};font-size:16px;line-height:24px;color:#c9ccd2">
<tr><td width="34" valign="top" style="font-family:${DISPLAY};font-size:20px;font-weight:900;font-style:italic;color:${ROSA}">01</td><td style="padding-bottom:10px">Arriva qualche minuto prima: si parte con il <strong style="color:${FUMO}">briefing di sicurezza</strong>.</td></tr>
<tr><td width="34" valign="top" style="font-family:${DISPLAY};font-size:20px;font-weight:900;font-style:italic;color:${ROSA}">02</td><td>Amici e parenti che vogliono guardare entrano <strong style="color:${FUMO}">gratis</strong>.</td></tr>
</table>
</td></tr>

<tr><td class="px" style="padding:20px 36px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141a3a;border:1px solid ${BLU}">
<tr><td style="padding:16px 18px;font-family:${TESTO};font-size:15px;line-height:22px;color:#c9ccd2">
<strong style="color:${FUMO}">Non puoi più venire?</strong> Chiamaci al <a href="${TEL_LINK}" style="color:${BLU_CHIARO};font-weight:700;text-decoration:none">${TELEFONO}</a> così liberiamo il posto per qualcun altro. Per qualsiasi domanda puoi anche rispondere a questa mail.
</td></tr></table>
</td></tr>`;
  const html = guscio(`${posti} ${posti === 1 ? "posto confermato" : "posti confermati"} per ${dataLunga(g.data)} · ${g.titolo}`, contenuto, piedePubblico());
  const testo = `PRENOTAZIONE CONFERMATA · MERY DRIFT

Ciao ${String(p.nome).trim()}, ci vediamo in pista!

Giornata: ${g.titolo}
Data: ${dataLunga(g.data)} (orari pista ${ORARI})
Posti: ${posti}
${pagata ? "Pagato online" : "Totale"}: ${totale}
${pagata ? "Pagamento ricevuto." : "Il pagamento si fa direttamente in pista."}

Dove: ${LUOGO}, ${PAESE}
Mappa: ${MAPPA}

Arriva qualche minuto prima per il briefing di sicurezza.
Non puoi più venire? Chiamaci al ${TELEFONO}.

Mery Drift · Instagram @merydrift`;
  return { html, testo, oggetto: `✓ Prenotazione confermata · ${dataLunga(g.data)}` };
}

// ---------- MAIL AI PROPRIETARI ----------
export function mailProprietari(p: Rec, g: Giornata, occupati: number) {
  const posti = Number(p.posti), pagata = p.stato === "pagata";
  const tel = String(p.telefono ?? "");
  const telLink = "tel:" + tel.replace(/[^\d+]/g, "");
  const liberi = Math.max(0, g.posti_totali - occupati);
  const perc = Math.max(3, Math.min(100, Math.round((occupati / Math.max(1, g.posti_totali)) * 100)));
  const nome = esc(String(p.nome).trim());
  const contenuto = `
<tr><td class="px" style="padding:28px 36px 4px">
<p style="margin:0 0 8px;font-family:${MONO};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${ROSA}">● Nuova prenotazione</p>
<h1 class="h1" style="margin:0;font-family:${DISPLAY};font-size:42px;line-height:44px;font-weight:900;font-style:italic;text-transform:uppercase;color:${FUMO}">${nome}</h1>
<p style="margin:10px 0 0;font-family:${TESTO};font-size:19px;line-height:28px;color:#c9ccd2">ha prenotato <strong style="color:${FUMO}">${posti} ${posti === 1 ? "posto" : "posti"}</strong> per <strong style="color:${FUMO}">${esc(dataLunga(g.data))}</strong></p>
</td></tr>

<tr><td class="px" style="padding:22px 36px 4px">
${dueBottoni(tel ? pulsante(`📞&nbsp; Chiama ${nomeProprio(String(p.nome))}`, telLink, ROSA) : "",
    pulsante("✉️&nbsp; Scrivi una mail", `mailto:${esc(p.email)}`, NERO, FUMO, FUMO))}
</td></tr>

<tr><td class="px" style="padding:18px 36px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${riga("Telefono", tel ? `<a href="${telLink}" style="color:${FUMO};text-decoration:none">${esc(tel)}</a>` : "—")}
${riga("Email", `<a href="mailto:${esc(p.email)}" style="color:${FUMO};text-decoration:none">${esc(p.email)}</a>`)}
${riga("Giornata", esc(g.titolo))}
${riga("Data", esc(dataLunga(g.data)))}
${riga("Posti", `${posti}`)}
${riga(pagata ? "Pagato online" : "Da incassare", `<span style="font-family:${DISPLAY};font-size:26px;font-weight:900;color:${pagata ? VERDE : GIALLO}">${euro(posti * g.prezzo_cent)}</span>`)}
${riga("Arrivata il", esc(oraRoma(String(p.creata_il ?? new Date().toISOString()))), true)}
</table>
</td></tr>

<tr><td class="px" style="padding:22px 36px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NERO};border:1px solid ${LINEA}">
<tr><td style="padding:18px 20px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${CENERE}">La giornata</td>
<td align="right" style="font-family:${TESTO};font-size:16px;font-weight:700;color:${liberi === 0 ? GIALLO : VERDE}">${liberi === 0 ? "Tutto pieno!" : `Ne restano ${liberi}`}</td>
</tr></table>
<div style="font-family:${DISPLAY};font-size:40px;line-height:44px;font-weight:900;font-style:italic;color:${FUMO};margin-top:6px">${occupati} <span style="font-size:22px;color:${CENERE}">su ${g.posti_totali} posti prenotati</span></div>
</td></tr>
<tr><td style="padding:4px 20px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LINEA}"><tr>
<td width="${perc}%" style="height:12px;background:${ROSA};font-size:0;line-height:0">&nbsp;</td>
${perc < 100 ? `<td style="height:12px;font-size:0;line-height:0">&nbsp;</td>` : ""}
</tr></table>
</td></tr></table>
</td></tr>

<tr><td class="px" align="center" style="padding:26px 36px 34px">
${pulsante("Apri tutte le prenotazioni →", `${SITO}/admin/`, BLU)}
<p style="margin:12px 0 0;font-family:${TESTO};font-size:14px;line-height:20px;color:${CENERE}">Se rispondi a questa mail, la risposta arriva direttamente a ${nome}.</p>
</td></tr>`;
  const piede = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" style="padding:20px 16px 0;font-family:${TESTO};font-size:12px;color:${CENERE}">Avviso automatico del sito Mery Drift</td></tr></table>`;
  const html = guscio(`${String(p.nome).trim()} · ${posti} ${posti === 1 ? "posto" : "posti"} · ${dataLunga(g.data)} · ne restano ${liberi}`, contenuto, piede);
  const testo = `NUOVA PRENOTAZIONE · MERY DRIFT

${String(p.nome).trim()} ha prenotato ${posti} ${posti === 1 ? "posto" : "posti"} per ${dataLunga(g.data)}.

Telefono: ${tel || "—"}
Email: ${p.email}
Giornata: ${g.titolo}
${pagata ? "Pagato online" : "Da incassare"}: ${euro(posti * g.prezzo_cent)}

La giornata: ${occupati} su ${g.posti_totali} posti prenotati, ne restano ${liberi}.
Tutte le prenotazioni: ${SITO}/admin/`;
  return { html, testo, oggetto: `🏁 ${String(p.nome).trim()} · ${posti} ${posti === 1 ? "posto" : "posti"} · ${dataLunga(g.data)}` };
}

// ---------- invio ----------
async function invia(to: string[], m: { html: string; testo: string; oggetto: string }, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MITTENTE, to, subject: m.oggetto, html: m.html, text: m.testo, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) console.error("Resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (!SEGRETO || req.headers.get("x-webhook-secret") !== SEGRETO) {
    return new Response("non autorizzato", { status: 401 });
  }
  let evento: { type?: string; record?: Rec; old_record?: Rec };
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
    .select("data,titolo,prezzo_cent,posti_totali").eq("id", p.giornata_id).single();
  if (error || !g) {
    console.error("giornata", error);
    return new Response("giornata", { status: 500 });
  }

  // posti già occupati nella giornata (per la mail ai proprietari)
  let occupati = Number(p.posti) || 0;
  const { data: altre } = await supabase.from("prenotazioni")
    .select("posti,stato,scade_il").eq("giornata_id", p.giornata_id);
  if (altre) {
    const ora = Date.now();
    occupati = altre.filter((x: Rec) => x.stato === "confermata" || x.stato === "pagata" ||
      (x.stato === "in_attesa" && x.scade_il && new Date(String(x.scade_il)).getTime() > ora))
      .reduce((s: number, x: Rec) => s + Number(x.posti), 0);
  }

  const okCliente = await invia([String(p.email)], mailCliente(p, g as Giornata), RISPOSTE || undefined);
  let okProp = true;
  if (PROPRIETARI.length) {
    okProp = await invia(PROPRIETARI, mailProprietari(p, g as Giornata, occupati), String(p.email));
  }

  return new Response(JSON.stringify({ cliente: okCliente, proprietari: okProp }), {
    headers: { "Content-Type": "application/json" },
  });
});
