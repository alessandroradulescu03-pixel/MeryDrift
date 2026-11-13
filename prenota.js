/* Pagina Prenota: legge le giornate da Supabase, disegna il calendario e salva le prenotazioni */
(function(){
  // ---------- configurazione ----------
  var SB_URL='https://dcjqhleaevdjijjdqovs.supabase.co';
  var SB_KEY='sb_publishable_1Fhv9LdqgTjoqqBKdKYGIg_AONI8Flr'; // chiave pubblica: può stare nel sito
  var POCHI=5; // sotto questa soglia il giorno diventa "ultimi posti"

  var MESI=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var MESI_S=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  var GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  var $=function(id){return document.getElementById(id);};
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function pad(n){return (n<10?'0':'')+n;}
  function euro(c){return '€'+(c%100?(c/100).toFixed(2).replace('.',','):String(c/100));}
  function parts(s){var p=s.split('-');return {y:+p[0],m:+p[1]-1,d:+p[2]};}
  function dow(s){var p=parts(s);return new Date(p.y,p.m,p.d).getDay();}
  function lunga(s){var p=parts(s);return GIORNI[dow(s)]+' '+p.d+' '+MESI[p.m].toLowerCase();}
  // "oggi" a Covo, indipendente dal fuso di chi visita
  function oggi(){
    try{
      var o={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'})
        .formatToParts(new Date()).forEach(function(x){o[x.type]=x.value;});
      return o.year+'-'+o.month+'-'+o.day;
    }catch(e){var n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());}
  }

  var giornate=[],perData={},sel=null,posti=1,vista=null,minV=null,maxV=null;
  var TODAY=oggi();

  // ---------- esito del pagamento (ritorno da Stripe) ----------
  (function(){
    var q=new URLSearchParams(location.search).get('esito'),box=$('esito');
    if(q!=='ok'&&q!=='annullato')return;
    box.className=q==='ok'?'ok':'ok ko';
    box.appendChild(el('p','eyebrow',q==='ok'?'Prenotazione confermata':'Pagamento annullato'));
    box.appendChild(el('h3',null,q==='ok'?'Ci vediamo in pista':'Nessun addebito'));
    box.appendChild(el('p',null,q==='ok'
      ?'Pagamento ricevuto: il tuo posto è confermato. Per qualsiasi cosa scrivici su Instagram o chiamaci.'
      :'Non è stato addebitato nulla. Puoi scegliere di nuovo una data qui sotto quando vuoi.'));
    box.hidden=false;
    try{history.replaceState(null,'',location.pathname);}catch(e){}
  })();

  // ---------- dati ----------
  function carica(){
    var cal=$('cal'),st=$('calState');
    cal.setAttribute('aria-busy','true');st.textContent='Carico il calendario…';
    return fetch(SB_URL+'/rest/v1/rpc/disponibilita',{
      method:'POST',
      headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
      body:'{}'
    }).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(rows){
      giornate=(rows||[]).filter(function(g){return g.data>=TODAY;})
        .sort(function(a,b){return a.data<b.data?-1:a.data>b.data?1:0;});
      perData={};
      giornate.forEach(function(g){(perData[g.data]=perData[g.data]||[]).push(g);});
      var t=parts(TODAY);minV={y:t.y,m:t.m};maxV={y:t.y,m:t.m};
      if(giornate.length){var l=parts(giornate[giornate.length-1].data);maxV={y:l.y,m:l.m};}
      if(!vista){
        var primo=giornate.filter(function(g){return g.posti_liberi>0;})[0]||giornate[0];
        var p=primo?parts(primo.data):t;vista={y:p.y,m:p.m};
      }
      if(sel){sel=giornate.filter(function(g){return g.id===sel.id;})[0]||null;}
      cal.setAttribute('aria-busy','false');
      st.textContent=giornate.length?'':'Al momento non ci sono giornate in programma. Seguici su Instagram per le prossime date.';
      disegna();elenco();pannello();
    }).catch(function(){
      cal.setAttribute('aria-busy','false');
      st.textContent='Non riesco a caricare il calendario. ';
      var b=el('button',null,'Riprova');b.type='button';b.addEventListener('click',carica);st.appendChild(b);
      disegna();
    });
  }

  // ---------- calendario ----------
  function cmp(a,b){return a.y!==b.y?a.y-b.y:a.m-b.m;}
  function disegna(){
    var t=parts(TODAY);
    if(!vista)vista={y:t.y,m:t.m};
    if(!minV){minV={y:t.y,m:t.m};maxV={y:t.y,m:t.m};}
    $('calMonth').textContent=MESI[vista.m]+' '+vista.y;
    $('calPrev').disabled=cmp(vista,minV)<=0;
    $('calNext').disabled=cmp(vista,maxV)>=0;
    var box=$('calDays');box.textContent='';
    var vuoti=(new Date(vista.y,vista.m,1).getDay()+6)%7,tot=new Date(vista.y,vista.m+1,0).getDate();
    for(var i=0;i<vuoti;i++)box.appendChild(el('span','cd'));
    for(var d=1;d<=tot;d++){
      var ds=vista.y+'-'+pad(vista.m+1)+'-'+pad(d),gs=perData[ds],c;
      if(gs){
        var liberi=gs.reduce(function(s,g){return s+Math.max(0,g.posti_liberi);},0);
        c=el('button','cd'+(liberi<=0?' full':liberi<=POCHI?' few':''));c.type='button';
        c.appendChild(el('b',null,d));
        var lab=el('i');
        if(liberi<=0)lab.textContent='Pieno';
        else{lab.textContent=liberi;lab.appendChild(el('span','w',liberi===1?' posto':' posti'));}
        c.appendChild(lab);
        c.setAttribute('aria-label',lunga(ds)+', '+gs[0].titolo+', '+(liberi<=0?'completo':liberi+(liberi===1?' posto libero':' posti liberi')));
        if(sel&&sel.data===ds){c.classList.add('sel');c.setAttribute('aria-pressed','true');}
        (function(ds){c.addEventListener('click',function(){scegliData(ds,true);});})(ds);
      }else{
        c=el('span','cd'+(ds<TODAY?' past':''));c.appendChild(el('b',null,d));
      }
      if(ds===TODAY)c.classList.add('today');
      box.appendChild(c);
    }
  }
  function sposta(n){
    var m=vista.m+n,y=vista.y;if(m<0){m=11;y--;}else if(m>11){m=0;y++;}
    var v={y:y,m:m};if(cmp(v,minV)<0||cmp(v,maxV)>0)return;
    vista=v;disegna();
  }
  $('calPrev').addEventListener('click',function(){sposta(-1);});
  $('calNext').addEventListener('click',function(){sposta(1);});

  // ---------- elenco prossime date ----------
  function elenco(){
    var ul=$('calList');ul.textContent='';
    $('calNextWrap').hidden=!giornate.length;
    giornate.slice(0,8).forEach(function(g){
      var p=parts(g.data),li=el('li'),b=el('button',g.posti_liberi<=0?'full':null);b.type='button';
      if(sel&&sel.id===g.id)b.classList.add('sel');
      var d=el('span','d',p.d);d.appendChild(el('small',null,MESI_S[p.m]));
      b.appendChild(d);
      b.appendChild(el('span','t',g.titolo));
      b.appendChild(el('span','m',euro(g.prezzo_cent)+' · '+(g.posti_liberi<=0?'completo':g.posti_liberi+(g.posti_liberi===1?' posto':' posti'))));
      b.addEventListener('click',function(){scegli(g,true);});
      li.appendChild(b);ul.appendChild(li);
    });
  }

  // ---------- scelta ----------
  function scegliData(ds,scroll){
    var gs=perData[ds]||[];
    scegli(gs.filter(function(g){return g.posti_liberi>0;})[0]||gs[0],scroll);
  }
  function scegli(g,scroll){
    if(!g)return;
    sel=g;posti=1;
    var p=parts(g.data);vista={y:p.y,m:p.m};
    $('prenErr').hidden=true;
    disegna();elenco();pannello();
    if(scroll&&matchMedia('(max-width:900px)').matches){
      var box=sel.posti_liberi>0?$('prenForm'):$('pickEmpty');
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }

  // ---------- pannello e form ----------
  function pannello(){
    var f=$('prenForm'),vuoto=$('pickEmpty');
    if(!sel||sel.posti_liberi<=0){
      f.hidden=true;vuoto.hidden=false;
      vuoto.querySelector('h3').textContent=sel?'Giornata completa':'Tocca una data';
      vuoto.querySelector('p:last-child').textContent=sel
        ?'Per '+lunga(sel.data)+' i posti sono finiti. Scegli un\'altra data dal calendario.'
        :'Le giornate prenotabili sono evidenziate nel calendario. Scegline una per vedere prezzo e posti liberi.';
      return;
    }
    vuoto.hidden=true;f.hidden=false;
    var h=$('pkDate');h.textContent=lunga(sel.data);h.appendChild(el('small',null,sel.titolo));
    $('pkPrice').textContent=euro(sel.prezzo_cent);
    $('pkSeats').textContent=sel.posti_liberi;
    // più turni nello stesso giorno: si sceglie qui
    var gs=perData[sel.data]||[],fs=$('pkTurni'),row=$('pkTurniRow');
    row.textContent='';fs.hidden=gs.length<2;
    if(gs.length>1)gs.forEach(function(g){
      var l=el('label','chip'),i=el('input');i.type='radio';i.name='turno';i.checked=g.id===sel.id;i.disabled=g.posti_liberi<=0;
      i.addEventListener('change',function(){scegli(g,false);});
      l.appendChild(i);l.appendChild(el('span',null,g.titolo+(g.posti_liberi<=0?' (completo)':'')));row.appendChild(l);
    });
    conti();
  }
  function conti(){
    posti=Math.max(1,Math.min(posti,sel.posti_liberi));
    $('postiVal').textContent=posti;
    $('postiMeno').disabled=posti<=1;
    $('postiPiu').disabled=posti>=sel.posti_liberi;
    $('sumCalc').textContent=posti+' × '+euro(sel.prezzo_cent);
    $('sumTot').textContent=euro(sel.prezzo_cent*posti);
  }
  $('postiMeno').addEventListener('click',function(){posti--;conti();});
  $('postiPiu').addEventListener('click',function(){posti++;conti();});

  function errore(msg){var e=$('prenErr');e.textContent=msg;e.hidden=false;}
  $('prenForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    if(!sel)return;
    var nome=$('f-nome').value.trim(),email=$('f-email').value.trim(),tel=$('f-tel').value.trim();
    $('prenErr').hidden=true;
    if(nome.length<3){errore('Scrivi nome e cognome.');$('f-nome').focus();return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){errore('Controlla l\'indirizzo email.');$('f-email').focus();return;}
    if(tel.replace(/\D/g,'').length<8){errore('Controlla il numero di telefono.');$('f-tel').focus();return;}
    var btn=$('prenBtn'),testo=btn.textContent;
    btn.disabled=true;btn.textContent='Un attimo…';
    function fine(){btn.disabled=false;btn.textContent=testo;}
    var scelta=sel;
    fetch(SB_URL+'/rest/v1/rpc/prenota_posti',{
      method:'POST',
      headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_giornata:scelta.id,p_nome:nome,p_email:email,p_telefono:tel,p_posti:posti})
    }).then(function(r){
      return r.json().catch(function(){return {};}).then(function(j){return {ok:r.ok,j:j};});
    }).then(function(x){
      fine();
      var msg=(x.j&&x.j.message)||'';
      if(x.ok){
        confermata(scelta,posti,nome);
        $('prenForm').reset();sel=null;posti=1;
        carica();return;
      }
      if(msg.indexOf('posti_esauriti')>-1){errore('Qualcuno ha appena preso gli ultimi posti. Ho aggiornato il calendario: controlla quanti ne restano.');carica();return;}
      if(msg.indexOf('giornata_non_trovata')>-1){errore('Questa giornata non è più prenotabile. Ho aggiornato il calendario.');carica();return;}
      errore('Non sono riuscito a salvare la prenotazione. Riprova tra poco.');
    }).catch(function(){
      fine();errore('Il servizio non risponde in questo momento. Riprova tra poco, oppure chiamaci al 340 102 0863.');
    });
  });

  function confermata(g,n,nome){
    var box=$('esito');box.textContent='';box.className='ok';
    box.appendChild(el('p','eyebrow','Prenotazione confermata'));
    box.appendChild(el('h3',null,'Ci vediamo in pista'));
    box.appendChild(el('p',null,nome+', abbiamo salvato '+n+(n===1?' posto':' posti')+' per '+lunga(g.data)+' ('+g.titolo+').'));
    box.hidden=false;
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }

  disegna();
  carica();
})();
