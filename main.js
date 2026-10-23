// MERY DRIFT — script condiviso

// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    links.classList.toggle('open', !open);
  });
}

// Pista a 8: calcola la lunghezza dei segni di gomma per l'animazione
document.querySelectorAll('.track .gomma, .track .scia').forEach((p) => {
  p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
});

// Anno nel footer
document.querySelectorAll('[data-anno]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Modulo contatti: apre l'email con i dati già compilati
// (sito statico, nessun server: quando ci sarà un servizio tipo Formspree si può collegare qui)
const form = document.querySelector('#form-contatti');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const msg = document.querySelector('.form-msg');
    if (!d.get('nome') || !d.get('email') || !d.get('messaggio')) {
      msg.textContent = 'Compila nome, email e messaggio per inviare la richiesta.';
      return;
    }
    const corpo =
      `Nome: ${d.get('nome')}\n` +
      `Email: ${d.get('email')}\n` +
      `Telefono: ${d.get('telefono') || '-'}\n` +
      `Interessato a: ${d.get('servizio')}\n` +
      `Data preferita: ${d.get('data') || '-'}\n\n` +
      `${d.get('messaggio')}`;
    const to = form.dataset.email;
    window.location.href =
      `mailto:${to}?subject=${encodeURIComponent('Richiesta dal sito – ' + d.get('servizio'))}` +
      `&body=${encodeURIComponent(corpo)}`;
    msg.textContent = 'Si sta aprendo la tua app email con la richiesta pronta da inviare.';
  });
}
