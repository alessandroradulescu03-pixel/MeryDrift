/* Area riservata Mery Drift: pensata per essere semplicissima da usare */
(function(){
  var SB_URL='https://dcjqhleaevdjijjdqovs.supabase.co';
  var SB_KEY='sb_publishable_1Fhv9LdqgTjoqqBKdKYGIg_AONI8Flr';
  var sb=window.supabase.createClient(SB_URL,SB_KEY);

  var MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  var GIORNI=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];

  var $=function(id){return document.getElementById(id);};
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function btn(cls,txt,fn){var b=el('button',cls,txt);b.type='button';if(fn)b.addEventListener('click',fn);return b;}
  function pad(n){return (n<10?'0':'')+n;}
  function euro(c){return '€ '+(c%100?(c/100).toFixed(2).replace('.',','):String(c/100));}
  function parts(s){var p=s.split('-');return {y:+p[0],m:+p[1]-1,d:+p[2]};}
  function giorno(s){var p=parts(s);return GIORNI[new Date(p.y,p.m,p.d).getDay()]+' '+p.d+' '+MESI[p.m];}
  function giornoAnno(s){return giorno(s)+' '+parts(s).y;}
  function oggi(){
    try{var o={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(new Date()).forEach(function(x){o[x.type]=x.value;});return o.year+'-'+o.month+'-'+o.day;}
    catch(e){var n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());}
  }
  function valida(p){return p.stato==='confermata'||p.stato==='pagata'||(p.stato==='in_attesa'&&p.scade_il&&new Date(p.scade_il)>new Date());}
  function pagata(p){return p.stato==='pagata'||p.pagato_in_pista;}
  function occupati(g){return g.prenotazioni.filter(valida).reduce(function(s,p){return s+p.posti;},0);}
  function centesimi(v){var n=parseFloat(String(v).replace(/\s|€/g,'').replace(',','.'));return isFinite(n)&&n>=0?Math.round(n*100):null;}
  function posti(n){return n+(n===1?' posto':' posti');}
  function quando(ts){
    if(!ts)return '';
    try{
      var d=new Date(ts),o={timeZone:'Europe/Rome'};
      var g=new Intl.DateTimeFormat('it-IT',Object.assign({weekday:'long',day:'numeric',month:'long'},o)).format(d);
      var h=new Intl.DateTimeFormat('it-IT',Object.assign({hour:'2-digit',minute:'2-digit'},o)).format(d);
      return g+' alle '+h;
    }catch(e){return new Date(ts).toLocaleString('it-IT');}
  }

  var toastT;
  function toast(msg,ko){var t=$('adToast');t.textContent=msg;t.className='ad-toast'+(ko?' ko':'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},3500);}

  var dati=[],passate=false,inModifica={},TODAY=oggi();

  // ---------- accesso ----------
  function mostra(v){$('adLogin').hidden=v!=='login';$('adApp').hidden=v!=='app';$('adOut').hidden=v!=='app';}
  async function entra(session){
    if(!session){mostra('login');return;}
    var r=await sb.rpc('sono_admin');
    if(r.error||!r.data){
      await sb.auth.signOut();mostra('login');
      var e=$('loginErr');e.textContent='Questo account non può entrare qui. Chiedi a chi ha fatto il sito.';e.hidden=false;return;
    }
    mostra('app');carica();
  }
  $('lg-show').addEventListener('change',function(){$('lg-pass').type=this.checked?'text':'password';});
  $('loginForm').addEventListener('submit',async function(ev){
    ev.preventDefault();
    var e=$('loginErr'),b=$('loginBtn');e.hidden=true;
    var email=$('lg-email').value.trim(),pass=$('lg-pass').value;
    if(!email||!pass){e.textContent='Scrivi sia l\'email sia la password.';e.hidden=false;return;}
    b.disabled=true;b.textContent='Attendi…';
    var r=await sb.auth.signInWithPassword({email:email,password:pass});
    b.disabled=false;b.textContent='Entra';
    if(r.error){e.textContent='Email o password sbagliate. Controlla e riprova.';e.hidden=false;return;}
    $('lg-pass').value='';entra(r.data.session);
  });
  $('adOut').addEventListener('click',async function(){
    if(!confirm('Vuoi uscire?'))return;
    await sb.auth.signOut();dati=[];$('adDays').textContent='';mostra('login');
  });

  // ---------- dati ----------
  async function carica(){
    $('adMsg').textContent='Sto caricando le prenotazioni…';
    var r=await sb.from('giornate')
      .select('id,data,titolo,posti_totali,prezzo_cent,attiva,prenotazioni(id,nome,email,telefono,posti,stato,scade_il,pagato_in_pista,creata_il)')
      .order('data',{ascending:true});
    if(r.error){$('adMsg').textContent='Non riesco a caricare. Controlla internet e premi "Aggiorna".';return;}
    dati=r.data||[];
    dati.forEach(function(g){g.prenotazioni.sort(function(a,b){return a.creata_il<b.creata_il?-1:1;});});
    $('adMsg').textContent='';
    disegna();
  }

  function disegna(){
    var lista=passate
      ?dati.filter(function(g){return g.data<TODAY;}).reverse()
      :dati.filter(function(g){return g.data>=TODAY;});
    $('btnPassate').textContent=passate?'← Torna alle prossime giornate':'Vedi le giornate passate';
    var box=$('adDays');box.textContent='';
    if(!lista.length){
      $('adMsg').textContent=passate?'Non ci sono giornate passate.':'Non ci sono giornate in programma. Premi "+ Aggiungi una giornata" per crearne una.';
      return;
    }
    $('adMsg').textContent='';
    lista.forEach(function(g){box.appendChild(scheda(g));});
  }

  // ---------- scheda di una giornata ----------
  function scheda(g){
    var o=occupati(g),liberi=Math.max(0,g.posti_totali-o);
    var card=el('article','ad-day'+(g.attiva?'':' off'));

    // intestazione
    var head=el('header','ad-day-head');
    var t=el('div');
    t.appendChild(el('h2',null,giorno(g.data)));
    t.appendChild(el('p','ad-day-name',g.titolo+' · '+euro(g.prezzo_cent)+' a persona'));
    head.appendChild(t);
    var num=el('div','ad-count');
    var big=el('p','ad-count-big');big.appendChild(el('b',null,o));big.appendChild(document.createTextNode(' su '+g.posti_totali));
    num.appendChild(big);
    num.appendChild(el('p',null,'posti prenotati'));
    num.appendChild(el('p','ad-free'+(liberi===0?' zero':''),liberi===0?'Tutto pieno':'Ne restano '+liberi));
    head.appendChild(num);
    card.appendChild(head);

    if(!g.attiva){
      var chiusa=el('div','ad-closed');
      chiusa.appendChild(el('p',null,'Prenotazioni chiuse: dal sito non si può prenotare questa giornata.'));
      chiusa.appendChild(btn('ad-btn','Riapri le prenotazioni',function(){salvaGiornata(g,{attiva:true},'Prenotazioni riaperte');}));
      card.appendChild(chiusa);
    }

    // persone
    var valide=g.prenotazioni.filter(function(x){return x.stato==='confermata'||x.stato==='pagata';});
    var annullate=g.prenotazioni.filter(function(x){return x.stato==='annullata';});
    if(!valide.length){
      card.appendChild(el('p','ad-empty','Ancora nessuna prenotazione.'));
    }else{
      var ul=el('ul','ad-people');
      valide.forEach(function(x){ul.appendChild(persona(g,x));});
      card.appendChild(ul);
      var daInc=valide.filter(function(x){return !pagata(x);}).reduce(function(s,x){return s+x.posti*g.prezzo_cent;},0);
      var inc=el('p','ad-money');
      inc.appendChild(document.createTextNode(daInc?'Ancora da incassare: ':'Hanno pagato tutti '));
      inc.appendChild(el('b',null,daInc?euro(daInc):'✓'));
      card.appendChild(inc);
    }
    if(annullate.length){
      var dt=el('details','ad-cancelled');
      dt.appendChild(el('summary',null,'Prenotazioni annullate ('+annullate.length+')'));
      var ula=el('ul');
      annullate.forEach(function(x){ula.appendChild(el('li',null,x.nome+' · '+posti(x.posti)+' · '+(x.telefono||'')));});
      dt.appendChild(ula);card.appendChild(dt);
    }

    // pulsanti in fondo
    var foot=el('div','ad-foot');
    if(valide.length){
      foot.appendChild(btn('ad-btn','🖨  Stampa l\'elenco',function(){stampa(g);}));
      foot.appendChild(btn('ad-btn','📥  Scarica in Excel',function(){esporta(g);}));
    }
    foot.appendChild(btn('ad-btn','✏️  Modifica giornata',function(){inModifica[g.id]=!inModifica[g.id];disegna();}));
    card.appendChild(foot);

    if(inModifica[g.id])card.appendChild(modifica(g));
    return card;
  }

  function persona(g,x){
    var li=el('li','ad-person'+(pagata(x)?' paid':''));
    var info=el('div','ad-p-info');
    info.appendChild(el('p','ad-p-name',x.nome));
    info.appendChild(el('p','ad-p-seats',posti(x.posti)+' · '+euro(x.posti*g.prezzo_cent)));
    if(x.creata_il)info.appendChild(el('p','ad-p-when','🕒 Ha prenotato '+quando(x.creata_il)));
    li.appendChild(info);

    var contatti=el('div','ad-p-contact');
    if(x.telefono){var tel=el('a','ad-btn','📞  '+x.telefono);tel.href='tel:'+x.telefono.replace(/[^\d+]/g,'');contatti.appendChild(tel);}
    var em=el('a','ad-btn','✉️  Scrivi email');em.href='mailto:'+x.email;em.title=x.email;contatti.appendChild(em);
    li.appendChild(contatti);

    var pay=el('div','ad-p-pay');
    if(x.stato==='pagata'){
      pay.appendChild(el('p','ad-paid','✓ Ha già pagato online'));
    }else if(x.pagato_in_pista){
      pay.appendChild(el('p','ad-paid','✓ Ha pagato'));
      pay.appendChild(btn('ad-link','Mi sono sbagliato, non ha pagato',function(){segnaPagato(x,false);}));
    }else{
      pay.appendChild(btn('ad-pay','Segna che ha pagato',function(){segnaPagato(x,true);}));
    }
    pay.appendChild(btn('ad-link danger','Annulla prenotazione',function(){annulla(g,x);}));
    li.appendChild(pay);
    return li;
  }

  async function segnaPagato(x,si){
    var r=await sb.from('prenotazioni').update({pagato_in_pista:si}).eq('id',x.id);
    if(r.error){toast('Non sono riuscito a salvare. Riprova.',true);return;}
    x.pagato_in_pista=si;disegna();toast(si?'Fatto: '+x.nome+' ha pagato ✓':'Ok, segnato come non pagato');
  }
  async function annulla(g,x){
    if(!confirm('Vuoi davvero annullare la prenotazione di '+x.nome+' ('+posti(x.posti)+')?\n\nI posti tornano liberi sul sito.'))return;
    var r=await sb.from('prenotazioni').update({stato:'annullata'}).eq('id',x.id);
    if(r.error){toast('Non sono riuscito ad annullare. Riprova.',true);return;}
    x.stato='annullata';disegna();toast('Prenotazione annullata, i posti sono di nuovo liberi');
  }

  // ---------- modifica giornata ----------
  function modifica(g){
    var f=el('form','ad-edit');f.noValidate=true;
    f.appendChild(el('h3',null,'Modifica giornata'));
    var box=el('div','ad-fields');
    function campo(lab,val,tipo,attrs){
      var w=el('div','field'),id='e-'+g.id+'-'+tipo+lab.length;
      var l=el('label',null,lab);l.htmlFor=id;
      var i=el('input');i.id=id;i.type=tipo;i.value=val;
      Object.keys(attrs||{}).forEach(function(k){i.setAttribute(k,attrs[k]);});
      w.appendChild(l);w.appendChild(i);box.appendChild(w);return i;
    }
    var ti=campo('Nome della giornata',g.titolo,'text',{maxlength:'60'});
    var po=campo('Quanti posti in tutto',g.posti_totali,'number',{min:'1',max:'500',inputmode:'numeric'});
    var pr=campo('Prezzo a persona (in euro)',String(g.prezzo_cent/100).replace('.',','),'text',{inputmode:'decimal'});
    f.appendChild(box);
    var err=el('p','ad-err');err.hidden=true;err.setAttribute('role','alert');f.appendChild(err);
    var row=el('div','ad-row-btns');
    var sv=el('button','ad-big','Salva le modifiche');sv.type='submit';row.appendChild(sv);
    row.appendChild(btn('ad-btn','Lascia stare',function(){inModifica[g.id]=false;disegna();}));
    f.appendChild(row);

    var extra=el('div','ad-edit-extra');
    if(g.attiva)extra.appendChild(btn('ad-link','Chiudi le prenotazioni di questa giornata',function(){
      if(!confirm('Chiudere le prenotazioni? Dal sito nessuno potrà più prenotare questa giornata.'))return;
      salvaGiornata(g,{attiva:false},'Prenotazioni chiuse');
    }));
    if(!g.prenotazioni.length)extra.appendChild(btn('ad-link danger','Elimina questa giornata',function(){elimina(g);}));
    f.appendChild(extra);

    f.addEventListener('submit',function(ev){
      ev.preventDefault();err.hidden=true;
      var t=ti.value.trim(),n=parseInt(po.value,10),c=centesimi(pr.value);
      if(t.length<2){err.textContent='Scrivi il nome della giornata.';err.hidden=false;return;}
      if(!(n>=1)){err.textContent='I posti devono essere almeno 1.';err.hidden=false;return;}
      if(c===null){err.textContent='Il prezzo non è scritto bene. Scrivi solo il numero, per esempio 50.';err.hidden=false;return;}
      var o=occupati(g);
      if(n<o){err.textContent='Ci sono già '+o+' posti prenotati: i posti in tutto non possono essere meno di '+o+'.';err.hidden=false;return;}
      inModifica[g.id]=false;
      salvaGiornata(g,{titolo:t,posti_totali:n,prezzo_cent:c},'Modifiche salvate ✓');
    });
    return f;
  }

  async function salvaGiornata(g,campi,ok){
    var r=await sb.from('giornate').update(campi).eq('id',g.id);
    if(r.error){toast('Non sono riuscito a salvare. Riprova.',true);return;}
    Object.keys(campi).forEach(function(k){g[k]=campi[k];});
    disegna();toast(ok);
  }
  async function elimina(g){
    if(!confirm('Vuoi davvero eliminare la giornata di '+giorno(g.data)+'?'))return;
    var r=await sb.from('giornate').delete().eq('id',g.id);
    if(r.error){toast('Non posso eliminarla: qualcuno ha già prenotato.',true);carica();return;}
    dati=dati.filter(function(x){return x.id!==g.id;});disegna();toast('Giornata eliminata');
  }

  // ---------- nuova giornata ----------
  $('btnNuova').addEventListener('click',function(){
    $('nuovaForm').hidden=false;
    if(!$('ng-data').value){var t=parts(TODAY),d=new Date(t.y,t.m,t.d);d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));$('ng-data').value=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
    $('nuovaForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('nuovaAnnulla').addEventListener('click',function(){$('nuovaForm').hidden=true;$('nuovaErr').hidden=true;});
  $('nuovaForm').addEventListener('submit',async function(ev){
    ev.preventDefault();
    var e=$('nuovaErr');e.hidden=true;
    var data=$('ng-data').value,t=$('ng-titolo').value.trim(),n=parseInt($('ng-posti').value,10),c=centesimi($('ng-prezzo').value);
    if(!data){e.textContent='Scegli il giorno.';e.hidden=false;return;}
    if(data<TODAY){e.textContent='Questo giorno è già passato. Scegline uno nel futuro.';e.hidden=false;return;}
    if(t.length<2){e.textContent='Scrivi il nome della giornata.';e.hidden=false;return;}
    if(!(n>=1)){e.textContent='I posti devono essere almeno 1.';e.hidden=false;return;}
    if(c===null){e.textContent='Il prezzo non è scritto bene. Scrivi solo il numero, per esempio 50.';e.hidden=false;return;}
    var r=await sb.from('giornate').insert({data:data,titolo:t,posti_totali:n,prezzo_cent:c});
    if(r.error){e.textContent='Non sono riuscito a salvarla. Riprova.';e.hidden=false;return;}
    $('nuovaForm').hidden=true;$('ng-data').value='';
    toast('Giornata aggiunta: si può già prenotare dal sito ✓');
    passate=false;carica();
  });

  // ---------- stampa ed Excel ----------
  function righe(g){return g.prenotazioni.filter(function(x){return x.stato==='confermata'||x.stato==='pagata';});}
  function stampa(g){
    var s=$('stampa');s.textContent='';
    s.appendChild(el('h1',null,'Mery Drift · '+giornoAnno(g.data)));
    s.appendChild(el('p',null,g.titolo+' · Posti prenotati: '+occupati(g)+' su '+g.posti_totali));
    var tb=el('table'),hr=el('tr');
    ['N.','Nome','Telefono','Posti','Da pagare','Presente'].forEach(function(h){hr.appendChild(el('th',null,h));});
    tb.appendChild(hr);
    righe(g).forEach(function(x,i){
      var tr=el('tr');
      [i+1,x.nome,x.telefono||'',x.posti,pagata(x)?'Pagato':euro(x.posti*g.prezzo_cent),'☐'].forEach(function(v){tr.appendChild(el('td',null,v));});
      tb.appendChild(tr);
    });
    s.appendChild(tb);
    window.print();
  }
  function esporta(g){
    var r=[['Data','Giornata','Nome','Telefono','Email','Posti','Importo','Pagato','Prenotata il']];
    righe(g).forEach(function(x){
      r.push([giornoAnno(g.data),g.titolo,x.nome,x.telefono||'',x.email,x.posti,(x.posti*g.prezzo_cent/100).toFixed(2).replace('.',','),x.stato==='pagata'?'Sì, online':x.pagato_in_pista?'Sì':'No',quando(x.creata_il)]);
    });
    var csv='﻿'+r.map(function(row){return row.map(function(v){v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var a=el('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download='prenotazioni-'+g.data+'.csv';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
    toast('File scaricato: lo trovi nella cartella Download');
  }

  $('btnAggiorna').addEventListener('click',function(){carica().then(function(){toast('Aggiornato ✓');});});
  $('btnPassate').addEventListener('click',function(){passate=!passate;disegna();window.scrollTo({top:0,behavior:'smooth'});});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!$('adApp').hidden)carica();});

  sb.auth.getSession().then(function(r){entra(r.data.session);});
})();
