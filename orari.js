(function(){
  var names=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  var full=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  var chip={0:'9–17',2:'9–17',3:'9–17',4:'9–17',5:'9–17',6:'9–17'};
  var lng={0:'9:00 – 17:00',2:'9:00 – 17:00',3:'9:00 – 17:00',4:'9:00 – 17:00',5:'9:00 – 17:00',6:'9:00 – 17:00'};
  // ora di Covo (Europe/Rome), indipendente dal fuso di chi visita
  function romeNow(){
    try{
      var p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false})
        .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});
      return {d:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),m:(+p.hour%24)*60+(+p.minute)};
    }catch(e){var n=new Date();return {d:n.getDay(),m:n.getHours()*60+n.getMinutes()}}
  }
  var OPEN=9*60,CLOSE=17*60;
  function closed(n){return n===1}
  var d=romeNow().d;

  // scheda "oggi" in home: aperto/chiuso in base al giorno E all'ora
  var wk=document.getElementById('tdWeek');
  function nextOpen(day){ // primo giorno di apertura dopo "day"
    for(var i=1;i<=7;i++){var n=(day+i)%7;if(!closed(n))return {n:n,i:i}}
  }
  function status(){
    var now=romeNow(),st=document.getElementById('tdState'),tx=document.getElementById('tdText');
    document.getElementById('tdLab').textContent='Oggi · '+full[now.d];
    var html='';
    [1,2,3,4,5,6,0].forEach(function(n){
      html+='<li class="'+(closed(n)?'c':'')+(n===now.d?' now':'')+'">'+names[n]+'<b>'+(closed(n)?'chiuso':chip[n])+'</b></li>';
    });
    wk.innerHTML=html;
    function set(word,cls,text){st.textContent=word;st.className='state x '+cls;tx.textContent=text}
    if(!closed(now.d)&&now.m>=OPEN&&now.m<CLOSE){
      var left=CLOSE-now.m;
      if(left<=60)set('Aperti','soon','Chiude tra '+left+' min, alle 17:00.');
      else set('Aperti','open','Fino alle 17:00. Pioggia o eventi? Guarda Instagram.');
    }else if(!closed(now.d)&&now.m<OPEN){
      set('Chiusi','closed','Apre oggi alle 9:00.');
    }else{
      var nx=nextOpen(now.d);
      set('Chiusi','closed','Riapre '+(nx.i===1?'domani, '+full[nx.n]:full[nx.n])+', alle 9:00.');
    }
  }
  if(wk){status();setInterval(status,30000);}


})();

// mappa "Dove siamo" — mappa reale (OpenStreetMap/CARTO) e percorso reale (OSRM)
(function(){
  var btns=[].slice.call(document.querySelectorAll('.cbtn'));
  var el=document.getElementById('map');
  if(!btns.length||!el)return;
  var ro=document.querySelector('.readout');
  var dest=[+el.dataset.lat,+el.dataset.lon];
  var map=null,line=null,startDot=null,cache={},cur=null;

  if(window.L){
    map=L.map(el,{scrollWheelZoom:false,zoomControl:true,attributionControl:true}).setView(dest,10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,className:'mxtiles',
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    var pin=L.divIcon({className:'mxpin',html:'<span class="r"></span><span class="r r2"></span><b></b><i></i>',iconSize:[120,80],iconAnchor:[60,74]});
    L.marker(dest,{icon:pin,zIndexOffset:1000,title:'Mery Drift · MXE.45'}).addTo(map);
    btns.forEach(function(b){
      var ll=b.dataset.ll.split(',').map(Number);
      L.circleMarker(ll,{radius:6,color:'#9aa3b5',weight:3,fillColor:'#141920',fillOpacity:1})
        .addTo(map).bindTooltip(b.querySelector('.cn').textContent,{permanent:true,direction:'top',className:'ctip',offset:[0,-8]})
        .on('click',function(){pick(b.dataset.c)});
    });
  }else{
    el.innerHTML='<p class="nomap">Mappa non disponibile qui. Usa i bottoni del navigatore qui sotto.</p>';
  }

  function draw(coords){
    if(line)map.removeLayer(line);
    line=L.polyline(coords,{color:'#ec1e8f',weight:6,opacity:1,lineCap:'round',className:'mxroute'}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[60,60],animate:false});
    var p=line.getElement&&line.getElement();
    if(p&&p.getTotalLength){
      var L0=p.getTotalLength();p.style.transition='none';p.style.strokeDasharray=L0;p.style.strokeDashoffset=L0;p.getBoundingClientRect();
      p.style.transition='stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';p.style.strokeDashoffset=0;
      setTimeout(function(){p.style.transition='none';p.style.strokeDasharray='';p.style.strokeDashoffset=''},1300);
    }
  }
  // minuti -> "circa 9 ore 30 min" / "circa 1 giorno 3 ore"
  function parts(min){
    min=Math.max(1,Math.round(min));
    if(min<60){return [[min>=20?Math.round(min/5)*5:min,'min']]}
    if(min<24*60){
      var h=Math.floor(min/60),m=Math.round((min%60)/5)*5;
      if(m===60){h++;m=0}
      var out=[[h,h===1?'ora':'ore']];if(m)out.push([m,'min']);return out;
    }
    var d=Math.floor(min/1440),hh=Math.round((min%1440)/60);
    if(hh===24){d++;hh=0}
    var o=[[d,d===1?'giorno':'giorni']];if(hh)o.push([hh,hh===1?'ora':'ore']);return o;
  }
  function setTime(t,txt){
    var el=document.getElementById('roTime');
    if(typeof t==='number'){
      el.innerHTML='<span class="circa">circa</span>'+parts(t).map(function(p){return '<span class="seg"><b>'+p[0]+'</b><u>'+p[1]+'</u></span>'}).join('');
      el.classList.toggle('long',t>=60);
    }else{el.textContent=t;el.classList.remove('long')}
    if(txt)document.getElementById('roText').textContent=txt;
  }

  function flash(){ro.classList.remove('flash');void ro.offsetWidth;ro.classList.add('flash')}
  // calcola e disegna il percorso da "from" [lat,lon] alla pista
  function routeFrom(key,label,from,fallbackT,fallbackD){
    cur=key;
    document.getElementById('roFrom').textContent=label;
    setTime(fallbackT?+fallbackT:'…',fallbackD||'Calcolo il percorso…');
    flash();
    if(!map)return;
    if(startDot)map.removeLayer(startDot);
    startDot=L.circleMarker(from,{radius:8,color:'#fff',weight:3,fillColor:'#ec1e8f',fillOpacity:1}).addTo(map);
    function show(r){
      if(cur!==key)return;
      draw(r.coords);
      setTime(r.min,r.km.toLocaleString('it-IT')+' km in auto, percorso più veloce.');
    }
    if(cache[key])return show(cache[key]);
    var url='https://router.project-osrm.org/route/v1/driving/'+from[1]+','+from[0]+';'+dest[1]+','+dest[0]+'?overview=full&geometries=geojson';
    fetch(url).then(function(r){return r.json()}).then(function(d){
      var rt=d.routes[0],m=Math.round(rt.duration/60);
      cache[key]={coords:rt.geometry.coordinates.map(function(p){return[p[1],p[0]]}),min:rt.duration/60,km:Math.max(1,Math.round(rt.distance/1000))};
      show(cache[key]);
    }).catch(function(){
      if(cur!==key)return;
      draw([from,dest]);
      setTime(fallbackT?+fallbackT:'—',fallbackT?fallbackD:'Non riesco a calcolare il percorso adesso. Usa i bottoni del navigatore qui sotto.');
    });
  }
  function pick(c){
    var b=btns.filter(function(x){return x.dataset.c===c})[0];
    btns.forEach(function(x){x.classList.toggle('on',x===b)});
    routeFrom(c,b.querySelector('.cn').textContent,b.dataset.ll.split(',').map(Number),b.dataset.t,b.dataset.d);
  }
  // casella "da dove parti"
  var form=document.getElementById('fromForm'),inp=document.getElementById('fromInput'),msg=document.getElementById('fromMsg'),geo=document.getElementById('geoBtn');
  function custom(label,ll){
    btns.forEach(function(x){x.classList.remove('on')});
    msg.textContent='';
    routeFrom('q:'+ll.join(','),label,ll);
  }
  if(form)form.addEventListener('submit',function(e){
    e.preventDefault();
    var q=inp.value.trim();if(!q)return;
    msg.textContent='Cerco “'+q+'”…';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&accept-language=it&q='+encodeURIComponent(q))
      .then(function(r){return r.json()}).then(function(res){
        if(!res.length){msg.textContent='Non trovo “'+q+'”. Prova con paese e provincia, es. “Chiari BS”.';return}
        var label=res[0].display_name.split(',')[0];
        custom(label,[+res[0].lat,+res[0].lon]);
      }).catch(function(){msg.textContent='Ricerca non disponibile adesso. Usa i bottoni del navigatore qui sotto.'});
  });
  if(geo){
    if(!navigator.geolocation)geo.hidden=true;
    geo.addEventListener('click',function(){
      msg.textContent='Cerco la tua posizione…';
      navigator.geolocation.getCurrentPosition(function(p){
        custom('La tua posizione',[p.coords.latitude,p.coords.longitude]);
      },function(err){
        var t={
          1:'Hai bloccato la posizione per questo sito. Riattivala dalle impostazioni del browser, oppure scrivi il tuo paese qui sopra.',
          2:'Il dispositivo non riesce a trovare la posizione. Controlla che la localizzazione sia attiva, oppure scrivi il tuo paese qui sopra.',
          3:'Ci sta mettendo troppo a trovare la posizione. Riprova, oppure scrivi il tuo paese qui sopra.'
        };
        msg.textContent=t[err&&err.code]||'Posizione non disponibile. Scrivi il tuo paese qui sopra.';
      },{enableHighAccuracy:false,timeout:20000,maximumAge:300000});
    });
  }
  btns.forEach(function(b){b.addEventListener('click',function(){pick(b.dataset.c)})});
  pick(btns[0].dataset.c);
})();

// meteo live a Covo (Open-Meteo, gratuito, senza chiave) — oggi + previsioni fino a 14 giorni
(function(){
  var boxes=[].slice.call(document.querySelectorAll('[data-meteo]'));
  if(!boxes.length)return;
  var LAT=45.5039,LON=9.7911,PER=5,DATA=null;
  var I={
    sun:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="9" fill="#ffc65c"/><g stroke="#ffc65c" stroke-width="3" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2"/></g></svg>',
    moon:'<svg viewBox="0 0 48 48"><path d="M30 8a16 16 0 1 0 10 28A14 14 0 0 1 30 8z" fill="#c9cfdb"/></svg>',
    part:'<svg viewBox="0 0 48 48"><circle cx="17" cy="17" r="8" fill="#ffc65c"/><path d="M15 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-1 13z" fill="#c9cfdb"/></svg>',
    cloud:'<svg viewBox="0 0 48 48"><path d="M13 38h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3.5A7.3 7.3 0 0 0 13 38z" fill="#9aa3b5"/></svg>',
    fog:'<svg viewBox="0 0 48 48"><path d="M13 28h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3.5A7.3 7.3 0 0 0 13 28z" fill="#9aa3b5"/><g stroke="#9aa3b5" stroke-width="3" stroke-linecap="round"><path d="M8 34h32M12 40h24"/></g></svg>',
    rain:'<svg viewBox="0 0 48 48"><path d="M13 30h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3.5A7.3 7.3 0 0 0 13 30z" fill="#9aa3b5"/><g stroke="#7aa2ff" stroke-width="3" stroke-linecap="round"><path d="M16 35l-2 6M25 35l-2 6M34 35l-2 6"/></g></svg>',
    snow:'<svg viewBox="0 0 48 48"><path d="M13 30h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3.5A7.3 7.3 0 0 0 13 30z" fill="#9aa3b5"/><g fill="#fff"><circle cx="16" cy="38" r="2.2"/><circle cx="25" cy="41" r="2.2"/><circle cx="34" cy="38" r="2.2"/></g></svg>',
    storm:'<svg viewBox="0 0 48 48"><path d="M13 28h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3.5A7.3 7.3 0 0 0 13 28z" fill="#7a8292"/><path d="M26 28l-6 10h6l-4 8 10-12h-6l4-6z" fill="#ffc65c"/></svg>'
  };
  function info(c,day){
    if(c===0)return[day?'sun':'moon','Sereno'];
    if(c===1)return[day?'sun':'moon','Poco nuvoloso'];
    if(c===2)return['part','Parzialmente nuvoloso'];
    if(c===3)return['cloud','Nuvoloso'];
    if(c===45||c===48)return['fog','Nebbia'];
    if(c>=51&&c<=57)return['rain','Pioviggine'];
    if(c>=61&&c<=67)return['rain',c>=65?'Pioggia forte':'Pioggia'];
    if(c>=71&&c<=77)return['snow','Neve'];
    if(c>=80&&c<=82)return['rain','Rovesci'];
    if(c>=85&&c<=86)return['snow','Rovesci di neve'];
    if(c>=95)return['storm','Temporale'];
    return['cloud','—'];
  }
  var dn=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],mn=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  function fmt(n){return (Math.round(n*10)/10).toString().replace('.',',')}
  function dt(s){return new Date(s+'T12:00:00')}
  function dlabel(x){return x.getDate()+' '+mn[x.getMonth()]}
  function days(b){
    if(!DATA)return;
    var dl=DATA.daily,tot=Math.min(15,dl.time.length-1),pages=Math.ceil(tot/PER),pg=+(b.dataset.page||0);
    var from=1+pg*PER,to=Math.min(dl.time.length-1,from+PER-1),h='';
    for(var i=from;i<=to;i++){
      var x=dt(dl.time[i]),k=info(dl.weather_code[i],true),mon=x.getDay()===1;
      h+='<li class="'+(i===1?'is-today ':'')+(mon?'off':'')+'"><span class="lab">'+(i===1?'Oggi':dn[x.getDay()]+' '+x.getDate())+'</span>'+I[k[0]]+
        '<b class="x">'+Math.round(dl.temperature_2m_max[i])+'°<small> / '+Math.round(dl.temperature_2m_min[i])+'°</small></b>'+
        '<span class="m-p">💧 '+(dl.precipitation_probability_max[i]||0)+'%</span>'+(mon?'<span class="m-off">pista chiusa</span>':'')+'</li>';
    }
    b.querySelector('[data-m="days"]').innerHTML=h;
    b.querySelector('[data-m="range"]').textContent=(pg===0?'Prossimi giorni · ':'')+dlabel(dt(dl.time[from]))+' – '+dlabel(dt(dl.time[to]));
    b.querySelector('[data-m="prev"]').disabled=pg===0;
    b.querySelector('[data-m="next"]').disabled=pg>=pages-1;
  }
  function render(d){
    DATA=d;
    var c=d.current,dl=d.daily,k=info(c.weather_code,c.is_day===1);
    var rainY=dl.precipitation_sum[0]||0,track;
    if(c.precipitation>0.2||[51,53,55,61,63,65,80,81,82,95,96,99].indexOf(c.weather_code)>=0)track='🌧️ Sta piovendo: pista probabilmente chiusa o fangosa. Controlla Instagram.';
    else if(rainY>=5)track='💧 Ieri è piovuto parecchio: fondo probabilmente bagnato.';
    else if(rainY>0)track='Ieri qualche goccia: fondo leggermente umido.';
    else track='☀️ Niente pioggia ieri: fondo asciutto.';
    var t=new Date();
    boxes.forEach(function(b){
      function s(n,v,html){var e=b.querySelector('[data-m="'+n+'"]');if(e){if(html)e.innerHTML=v;else e.textContent=v}}
      s('ico',I[k[0]],1);s('temp',Math.round(c.temperature_2m)+'°');s('desc',k[1]);
      s('feel',Math.round(c.apparent_temperature)+'°');s('wind',Math.round(c.wind_speed_10m)+' km/h');s('rainy',fmt(rainY)+' mm');
      s('track',track);s('upd',('0'+t.getHours()).slice(-2)+':'+('0'+t.getMinutes()).slice(-2));
      days(b);b.classList.add('ok');
    });
  }
  boxes.forEach(function(b){
    b.dataset.page=0;
    b.querySelector('[data-m="prev"]').addEventListener('click',function(){b.dataset.page=Math.max(0,+b.dataset.page-1);days(b)});
    b.querySelector('[data-m="next"]').addEventListener('click',function(){b.dataset.page=+b.dataset.page+1;days(b)});
  });
  function load(){
    var u='https://api.open-meteo.com/v1/forecast?latitude='+LAT+'&longitude='+LON+
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day'+
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum'+
      '&past_days=1&forecast_days=15&timezone=Europe%2FRome';
    fetch(u).then(function(r){return r.json()}).then(render).catch(function(){
      boxes.forEach(function(b){var e=b.querySelector('[data-m="desc"]');if(e&&!b.classList.contains('ok'))e.textContent='Meteo non disponibile adesso'});
    });
  }
  load();setInterval(load,10*60*1000);
})();
