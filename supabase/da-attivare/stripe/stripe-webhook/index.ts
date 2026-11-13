// Mery Drift · stripe-webhook
// Stripe chiama questa funzione quando un pagamento va a buon fine o scade.
// Secrets richiesti: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const firma = req.headers.get("stripe-signature");
  const corpo = await req.text();

  // controlla che la chiamata arrivi davvero da Stripe
  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(
      corpo,
      firma ?? "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      crypto,
    );
  } catch {
    return new Response("firma non valida", { status: 400 });
  }

  const sessione = evento.data.object as Stripe.Checkout.Session;
  const id = sessione.metadata?.prenotazione_id;
  if (!id) return new Response("ok");

  if (evento.type === "checkout.session.completed" && sessione.payment_status === "paid") {
    await supabase.from("prenotazioni").update({ stato: "pagata" }).eq("id", id);
  } else if (evento.type === "checkout.session.expired") {
    await supabase.from("prenotazioni").update({ stato: "scaduta" })
      .eq("id", id).eq("stato", "in_attesa");
  }

  return new Response("ok");
});
