/* Area riservata Mery Drift: login proprietari, giornate, prenotazioni, export */
(function(){
  var SB_URL='https://dcjqhleaevdjijjdqovs.supabase.co';
  var SB_KEY='sb_publishable_1Fhv9LdqgTjoqqBKdKYGIg_AONI8Flr';
  var sb=window.supabase.createClient(SB_URL,SB_KEY);

  var MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  var MESI_S=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  var GIORNI=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  var ATTIVE=['confermata','pagata','in_attesa'];
  var STATI={confermata:'Confermata',pagata:'Pagata online',in_attesa:'In pagamento',annullata:'Annullata',scaduta:'Scaduta'};

  var $=function(id){return document.getElementById(id);};
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function pad(n){return (n<10?'0':'')+n;}
  function euro(c){return '€'+(c%100?(c/100).toFixed(2).replace('.',','):String(c/100));}
  function parts(s){var p=s.split('-');return {y:+p[0],m:+p[1]-1,d:+p[2]};}
  function lunga(s){var p=parts(s);return GIORNI[new Date(p.y,p.m,p.d).getDay()]+' '+p.d+' '+MESI[p.m]+' '+p.y;}
  function quando(ts){var d=new Date(ts);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
  function oggi(){
    try{var o={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'})
      .formatToParts(new Date()).forEach(function(x){o[x.type]=x.value;});return o.year+'-'+o.month+'-'+o.day;}
    catch(e){var n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate());}
  }
  function attiva(p){return p.stato==='confermata'||p.stato==='pagata'||(p.stato==='in_attesa'&&p.scade_il&&new Date(p.scade_il)>new Date());}
  function occupati(g){return g.prenotazioni.filter(attiva).reduce(function(s,p){return s+p.posti;},0);}
  function centesimi(v){var n=parseFloat(String(v).replace(/\s|€/g,'').replace(',','.'));return isFinite(n)&&n>=0?Math.round(n*100):null;}

  var toastT;
  function toast(msg,ko){var t=$('adToast');t.textContent=msg;t.className='ad-toast'+(ko?' ko':'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},3200);}

  var dati=[],aperte={},TODAY=oggi();

  // ---------- accesso ----------
  function mostra(vista){
    $('adLogin').hidden=vista!=='login';
    $('adApp').hidden=vista!=='app';
    $('adOut').hidden=vista==='login';
  }
  async function entra(session){
    if(!session){mostra('login');$('adWho').textContent='';return;}
    $('adWho').textContent=session.user.email;
    var r=await sb.rpc('sono_admin');
    if(r.error||!r.data){
      await sb.auth.signOut();
      mostra('login');
      var e=$('loginErr');e.textContent='Questo account non ha accesso all\'area riservata.';e.hidden=false;
      return;
    }
    mostra('app');
    carica();
  }

  $('loginForm').addEventListener('submit',async function(ev){
    ev.preventDefault();
    var e=$('loginErr'),b=$('loginBtn');e.hidden=true;
    var email=$('lg-email').value.trim(),pass=$('lg-pass').value;
    if(!email||!pass){e.textContent='Inserisci email e password.';e.hidden=false;return;}
    b.disabled=true;b.textContent='Entro…';
    var r=await sb.auth.signInWithPassword({email:email,password:pass});
    b.disabled=false;b.textContent='Entra';
    if(r.error){e.textContent='Email o password non corretti.';e.hidden=false;return;}
    $('lg-pass').value='';
    entra(r.data.session);
  });
  $('adOut').addEventListener('click',async function(){await sb.auth.signOut();dati=[];$('adDays').textContent='';mostra('login');$('adWho').textContent='';});

  // ---------- dati ----------
  async function carica(){
    $('adMsg').textContent='Carico le prenotazioni…';
    var r=await sb.from('giornate')
      .select('id,data,titolo,posti_totali,prezzo_cent,attiva,prenotazioni(id,nome,email,telefono,posti,stato,scade_il,pagato_in_pista,creata_il)')
      .order('data',{ascending:true});
    if(r.error){$('adMsg').textContent='Non riesco a caricare i dati. Controlla la connessione e premi Aggiorna.';return;}
    dati=r.data||[];
    dati.forEach(function(g){g.prenotazioni.sort(function(a,b){return a.creata_il<b.creata_il?-1:1;});});
    $('adMsg').textContent='';
    disegna();
  }

  function disegna(){
    var past=$('chkPassate').checked;
    var future=dati.filter(function(g){return g.data>=TODAY;});
    var lista=past?dati.slice().reverse():future;

    // riepilogo (solo giornate future e aperte)
    var aperteF=future.filter(function(g){return g.attiva;});
    var pren=0,lib=0,inc=0;
    aperteF.forEach(function(g){
      var o=occupati(g);pren+=o;lib+=Math.max(0,g.posti_totali-o);
      g.prenotazioni.forEach(function(p){if(p.stato==='confermata'&&!p.pagato_in_pista)inc+=p.posti*g.prezzo_cent;});
    });
    $('stGiornate').textContent=aperteF.length;
    $('stPrenotati').textContent=pren;
    $('stLiberi').textContent=lib;
    $('stIncasso').textContent=euro(inc);

    var box=$('adDays');box.textContent='';
    if(!lista.length){
      $('adMsg').textContent=past?'Nessuna giornata inserita.':'Nessuna giornata in programma. Aggiungine una con "+ Nuova giornata".';
      return;
    }
    $('adMsg').textContent='';
    lista.forEach(function(g){box.appendChild(giornata(g));});
  }

  // ---------- una giornata ----------
  function giornata(g){
    var o=occupati(g),liberi=g.posti_totali-o,passata=g.data<TODAY,p=parts(g.data);
    var d=el('details','ad-day'+(g.attiva?'':' off')+(passata?' past':''));
    d.open=!!aperte[g.id];
    d.addEventListener('toggle',function(){aperte[g.id]=d.open;});

    var s=el('summary');
    var dt=el('span','ad-date',p.d);dt.appendChild(el('small',null,MESI_S[p.m]));s.appendChild(dt);
    var info=el('span','ad-info');
    info.appendChild(el('b',null,g.titolo));
    info.appendChild(el('span',null,lunga(g.data)+' · '+euro(g.prezzo_cent)+' a persona'));
    s.appendChild(info);
    var badges=el('span','ad-badges');
    if(!g.attiva)badges.appendChild(el('span','ad-badge off','Chiusa'));
    else if(passata)badges.appendChild(el('span','ad-badge off','Passata'));
    badges.appendChild(el('span','ad-badge'+(liberi<=0?' full':liberi<=5?' few':''),o+'/'+g.posti_totali));
    s.appendChild(badges);
    d.appendChild(s);

    var body=el('div','ad-body');

    // barra posti
    var bar=el('div','ad-meter');bar.setAttribute('aria-hidden','true');
    var fill=el('i');fill.style.width=Math.min(100,g.posti_totali?o/g.posti_totali*100:0)+'%';bar.appendChild(fill);
    body.appendChild(bar);
    body.appendChild(el('p','ad-sub',o+(o===1?' posto prenotato':' posti prenotati')+' · '+Math.max(0,liberi)+(liberi===1?' libero':' liberi')+(liberi<0?' (oltre la capienza di '+(-liberi)+')':'')));

    // prenotazioni
    var attive=g.prenotazioni.filter(function(x){return x.stato!=='annullata'&&x.stato!=='scaduta';});
    var chiuse=g.prenotazioni.filter(function(x){return x.stato==='annullata'||x.stato==='scaduta';});
    if(!g.prenotazioni.length){
      body.appendChild(el('p','ad-empty','Ancora nessuna prenotazione per questa giornata.'));
    }else{
      var ul=el('ul','ad-list');
      attive.concat(chiuse).forEach(function(x){ul.appendChild(riga(g,x));});
      body.appendChild(ul);
    }

    // modifica giornata
    body.appendChild(modifica(g));

    // azioni
    var act=el('div','ad-actions');
    var exp=el('button','btn sm ghost','Esporta Excel');exp.type='button';
    exp.disabled=!g.prenotazioni.length;
    exp.addEventListener('click',function(){esporta(g);});
    act.appendChild(exp);
    var tog=el('button','ad-link',g.attiva?'Chiudi le prenotazioni':'Riapri le prenotazioni');tog.type='button';
    tog.addEventListener('click',function(){salvaGiornata(g,{attiva:!g.attiva},g.attiva?'Prenotazioni chiuse per questa giornata':'Prenotazioni riaperte');});
    act.appendChild(tog);
    if(!g.prenotazioni.length){
      var del=el('button','ad-link danger','Elimina giornata');del.type='button';
      del.addEventListener('click',function(){elimina(g);});
      act.appendChild(del);
    }
    body.appendChild(act);

    d.appendChild(body);
    return d;
  }

  function riga(g,x){
    var li=el('li','ad-row st-'+x.stato);
    var top=el('div','ad-row-top');
    var n=el('b',null,x.nome);top.appendChild(n);
    top.appendChild(el('span','ad-seats',x.posti+(x.posti===1?' posto':' posti')));
    li.appendChild(top);

    var c=el('div','ad-contacts');
    var tel=el('a',null,x.telefono||'');tel.href='tel:'+(x.telefono||'').replace(/[^\d+]/g,'');c.appendChild(tel);
    var em=el('a',null,x.email);em.href='mailto:'+x.email;c.appendChild(em);
    li.appendChild(c);

    var bot=el('div','ad-row-bot');
    bot.appendChild(el('span','ad-state',STATI[x.stato]||x.stato));
    bot.appendChild(el('span','ad-when','Prenotata il '+quando(x.creata_il)));
    li.appendChild(bot);

    if(x.stato==='confermata'||x.stato==='pagata'){
      var act=el('div','ad-row-act');
      if(x.stato==='confermata'){
        var lab=el('label','check'),cb=el('input');cb.type='checkbox';cb.checked=x.pagato_in_pista;
        cb.addEventListener('change',async function(){
          cb.disabled=true;
          var r=await sb.from('prenotazioni').update({pagato_in_pista:cb.checked}).eq('id',x.id);
          cb.disabled=false;
          if(r.error){cb.checked=!cb.checked;toast('Non salvato, riprova.',true);return;}
          x.pagato_in_pista=cb.checked;disegna();toast(cb.checked?'Segnato come pagato':'Tolto il segno di pagamento');
        });
        lab.appendChild(cb);lab.appendChild(document.createTextNode(' '+euro(x.posti*g.prezzo_cent)+' pagato in pista'));
        act.appendChild(lab);
      }else{
        act.appendChild(el('span','ad-paid','✓ '+euro(x.posti*g.prezzo_cent)+' pagato online'));
      }
      var an=el('button','ad-link danger','Annulla');an.type='button';
      an.addEventListener('click',async function(){
        if(!confirm('Annullare la prenotazione di '+x.nome+' ('+x.posti+(x.posti===1?' posto':' posti')+')? I posti tornano liberi.'))return;
        var r=await sb.from('prenotazioni').update({stato:'annullata'}).eq('id',x.id);
        if(r.error){toast('Non riesco ad annullare, riprova.',true);return;}
        x.stato='annullata';disegna();toast('Prenotazione annullata, posti liberati');
      });
      act.appendChild(an);
      li.appendChild(act);
    }
    return li;
  }

  function modifica(g){
    var f=el('form','ad-edit');f.noValidate=true;
    f.appendChild(el('p','eyebrow','Modifica giornata'));
    var grid=el('div','ad-grid3');
    function campo(lab,val,tipo,attrs){
      var w=el('div','field'),id='e-'+g.id+'-'+lab.replace(/\W/g,'');
      var l=el('label',null,lab);l.htmlFor=id;
      var i=el('input');i.id=id;i.type=tipo;i.value=val;
      Object.keys(attrs||{}).forEach(function(k){i.setAttribute(k,attrs[k]);});
      w.appendChild(l);w.appendChild(i);grid.appendChild(w);return i;
    }
    var ti=campo('Titolo',g.titolo,'text',{maxlength:'60'});
    var po=campo('Posti totali',g.posti_totali,'number',{min:'1',max:'500',inputmode:'numeric'});
    var pr=campo('Prezzo (€)',String(g.prezzo_cent/100).replace('.',','),'text',{inputmode:'decimal'});
    f.appendChild(grid);
    var err=el('p','err');err.hidden=true;err.setAttribute('role','alert');f.appendChild(err);
    var sv=el('button','btn sm','Salva modifiche');sv.type='submit';f.appendChild(sv);
    f.addEventListener('submit',function(ev){
      ev.preventDefault();err.hidden=true;
      var t=ti.value.trim(),n=parseInt(po.value,10),c=centesimi(pr.value);
      if(t.length<2){err.textContent='Scrivi un titolo.';err.hidden=false;return;}
      if(!(n>=1)){err.textContent='I posti devono essere almeno 1.';err.hidden=false;return;}
      if(c===null){err.textContent='Controlla il prezzo.';err.hidden=false;return;}
      if(n<occupati(g)&&!confirm('Ci sono già '+occupati(g)+' posti prenotati: con '+n+' posti totali la giornata risulterà oltre la capienza. Salvo lo stesso?'))return;
      salvaGiornata(g,{titolo:t,posti_totali:n,prezzo_cent:c},'Giornata aggiornata');
    });
    return f;
  }

  async function salvaGiornata(g,campi,ok){
    var r=await sb.from('giornate').update(campi).eq('id',g.id);
    if(r.error){toast('Non salvato, riprova.',true);return;}
    Object.keys(campi).forEach(function(k){g[k]=campi[k];});
    disegna();toast(ok);
  }

  async function elimina(g){
    if(!confirm('Eliminare la giornata del '+lunga(g.data)+'?'))return;
    var r=await sb.from('giornate').delete().eq('id',g.id);
    if(r.error){toast('Non riesco a eliminarla: forse ha già delle prenotazioni.',true);carica();return;}
    dati=dati.filter(function(x){return x.id!==g.id;});disegna();toast('Giornata eliminata');
  }

  // ---------- nuova giornata ----------
  $('btnNuova').addEventListener('click',function(){
    var f=$('nuovaForm');f.hidden=false;
    if(!$('ng-data').value){var t=parts(TODAY),d=new Date(t.y,t.m,t.d);d.setDate(d.getDate()+((6-d.getDay()+7)%7||7));$('ng-data').value=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
    $('ng-data').focus();
  });
  $('nuovaAnnulla').addEventListener('click',function(){$('nuovaForm').hidden=true;$('nuovaErr').hidden=true;});
  $('nuovaForm').addEventListener('submit',async function(ev){
    ev.preventDefault();
    var e=$('nuovaErr');e.hidden=true;
    var data=$('ng-data').value,t=$('ng-titolo').value.trim(),n=parseInt($('ng-posti').value,10),c=centesimi($('ng-prezzo').value);
    if(!data){e.textContent='Scegli la data.';e.hidden=false;return;}
    if(data<TODAY){e.textContent='La data è già passata.';e.hidden=false;return;}
    if(t.length<2){e.textContent='Scrivi un titolo.';e.hidden=false;return;}
    if(!(n>=1)){e.textContent='I posti devono essere almeno 1.';e.hidden=false;return;}
    if(c===null){e.textContent='Controlla il prezzo.';e.hidden=false;return;}
    var r=await sb.from('giornate').insert({data:data,titolo:t,posti_totali:n,prezzo_cent:c});
    if(r.error){e.textContent='Non sono riuscito a salvarla, riprova.';e.hidden=false;return;}
    $('nuovaForm').hidden=true;$('ng-data').value='';
    toast('Giornata aggiunta: è già prenotabile sul sito');
    carica();
  });

  // ---------- export ----------
  function esporta(g){
    var righe=[['Data','Giornata','Nome','Telefono','Email','Posti','Stato','Pagato','Importo','Prenotata il']];
    g.prenotazioni.forEach(function(x){
      righe.push([lunga(g.data),g.titolo,x.nome,x.telefono||'',x.email,x.posti,STATI[x.stato]||x.stato,
        x.stato==='pagata'?'Online':x.pagato_in_pista?'In pista':'No',
        (x.posti*g.prezzo_cent/100).toFixed(2).replace('.',','),quando(x.creata_il)]);
    });
    var csv='﻿'+righe.map(function(r){return r.map(function(v){v=String(v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
    var a=el('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download='merydrift-'+g.data+'.csv';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
  }

  $('chkPassate').addEventListener('change',disegna);
  $('btnAggiorna').addEventListener('click',carica);
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&!$('adApp').hidden)carica();});

  // ---------- avvio ----------
  sb.auth.getSession().then(function(r){entra(r.data.session);});
})();
