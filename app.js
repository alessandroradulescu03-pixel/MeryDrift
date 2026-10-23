(function(){
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- menu mobile ----------
  var btn=document.getElementById('menuBtn'),menu=document.getElementById('menu');
  function closeMenu(){menu.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='MENU';}
  btn.addEventListener('click',function(){var o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o);btn.textContent=o?'CHIUDI':'MENU';});
  menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',closeMenu);});

  // ---------- form (solo pagina Prenota) ----------
  var f=document.getElementById('bookForm');
  if(f){
    var $=function(id){return document.getElementById(id);};
    var SV=['corso','noleggio','accesso','pista'],NAMES={corso:'Corso',noleggio:'Noleggio auto',accesso:'Accesso in pista',pista:'Pista in esclusiva'};
    var daysEl=$('days');
    function fmt(d){return d.toISOString().slice(0,10);}
    function addDay(val){
      var row=document.createElement('div');row.className='day';var n=daysEl.children.length+1,id='giorno-'+Date.now()+n;
      row.innerHTML='<b></b><input type="date" aria-label="Giorno"><button type="button" aria-label="Togli giorno">✕</button>';
      var inp=row.querySelector('input');inp.id=id;inp.value=val;
      row.querySelector('button').addEventListener('click',function(){if(daysEl.children.length>1){row.remove();renum();update();}});
      inp.addEventListener('change',update);daysEl.appendChild(row);renum();
    }
    function renum(){Array.prototype.forEach.call(daysEl.children,function(r,i){r.querySelector('b').textContent=i+1;r.querySelector('button').hidden=daysEl.children.length<2;});}
    var d0=new Date();d0.setDate(d0.getDate()+((6-d0.getDay()+7)%7||7));addDay(fmt(d0));
    $('addDay').addEventListener('click',function(){var ins=daysEl.querySelectorAll('input'),last=ins[ins.length-1].value,nd=last?new Date(last):new Date();nd.setDate(nd.getDate()+1);addDay(fmt(nd));update();});
    // preselezione dai link (#noleggio, #pista, #corso-intermedio...)
    var hs=location.hash.slice(1);
    if(hs.indexOf('corso')===0){$('s-corso').checked=true;var lv=hs.split('-')[1];if(lv)$('livello').value=lv;}
    else if(SV.indexOf(hs)>-1)$('s-'+hs).checked=true;
    else $('s-noleggio').checked=true;
    function price(sel){return +sel.options[sel.selectedIndex].dataset.p||0;}
    function chosen(){return SV.filter(function(s){return $('s-'+s).checked;});}
    function update(){
      var c=chosen();SV.forEach(function(s){$('sub-'+s).hidden=c.indexOf(s)<0;});
      var n=daysEl.querySelectorAll('input').length,list=[],tot=0,quote=false;
      if(c.indexOf('corso')>-1){var p=price($('livello'));list.push(['Corso '+$('livello').value,'€'+p+' × '+n]);tot+=p*n;}
      if(c.indexOf('noleggio')>-1){var p2=price($('auto'));list.push([$('auto').value.split(' · ')[0],'€'+p2+' × '+n]);tot+=p2*n;}
      if(c.indexOf('accesso')>-1){var p3=price($('turni'));list.push([$('turni').value+' turni','€'+p3+' × '+n]);tot+=p3*n;}
      if(c.indexOf('pista')>-1){list.push(['Pista in esclusiva · '+$('formula').value,'preventivo']);quote=true;}
      if(!list.length)list.push(['Scegli almeno un servizio','']);
      $('sumList').innerHTML='';list.forEach(function(l){var li=document.createElement('li');li.innerHTML='<span></span><span></span>';li.children[0].textContent=l[0];li.children[1].textContent=l[1];$('sumList').appendChild(li);});
      $('sumDays').textContent=n+(n>1?' giorni':' giorno');
      $('sumTotal').textContent=(tot?'€'+tot:'€0')+(quote?' + preventivo':'');
    }
    f.addEventListener('change',update);update();
    var err=$('err'),ok=$('ok');
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var nome=f.nome.value.trim(),tel=f.tel.value.trim(),mail=f.email.value.trim(),m=[];
      var days=Array.prototype.map.call(daysEl.querySelectorAll('input'),function(i){return i.value;}).filter(Boolean);
      if(!chosen().length)m.push('almeno un servizio');
      if(!days.length)m.push('almeno un giorno');
      if(!nome)m.push('il nome');
      if(!tel&&!mail)m.push('un telefono o una email');
      if(mail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))m.push('una email valida');
      if(!f.privacy.checked)m.push('il consenso privacy');
      if(m.length){err.textContent='Manca '+m.join(', ')+'.';err.hidden=false;return;}
      err.hidden=true;
      var cosa=chosen().map(function(s){return NAMES[s];}).join(' + ');
      var gg=days.map(function(v){var p=v.split('-');return p[2]+'/'+p[1];}).join(', ');
      $('okText').textContent='Grazie '+nome.split(' ')[0]+'! Abbiamo ricevuto la richiesta per '+cosa+' nei giorni '+gg+'. Ti ricontattiamo entro 24 ore per confermare.';
      f.hidden=true;ok.hidden=false;ok.scrollIntoView({block:'center'});
    });
    $('again').addEventListener('click',function(){ok.hidden=true;f.hidden=false;});
  }

  // ---------- card che entrano (visibili a riposo) ----------
  if('IntersectionObserver' in window && !RM){
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.remove('pre');io.unobserve(x.target);}});},{threshold:.15});
    document.querySelectorAll('.reveal').forEach(function(el){if(el.getBoundingClientRect().top>innerHeight){el.classList.add('pre');io.observe(el);}});
  }

  // ---------- fasce scorrevoli: accelerano con lo scroll ----------
  if(!RM && document.getAnimations){
    var anims=[],lastY=scrollY,boost=0;
    setTimeout(function(){document.querySelectorAll('.mq-track').forEach(function(el){anims=anims.concat(el.getAnimations());});},300);
    addEventListener('scroll',function(){boost=Math.min(6,boost+Math.abs(scrollY-lastY)/40);lastY=scrollY;},{passive:true});
    (function tick(){boost*=.92;anims.forEach(function(a){a.playbackRate=1+boost;});requestAnimationFrame(tick);})();
  }

  // ---------- motore pista a 8 ----------
  var PINK='#ec1e8f',SMOKE='#eceae6',TW=.17;
  function sprite(rgb){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba('+rgb+',1)');g.addColorStop(.45,'rgba('+rgb+',.45)');g.addColorStop(1,'rgba('+rgb+',0)');x.fillStyle=g;x.fillRect(0,0,64,64);return c;}
  var SPR_W=sprite('236,234,230'),SPR_P=sprite('236,30,143');

  function pos(t){return[Math.sin(t),Math.sin(t)*Math.cos(t)];}
  function der(t){return[Math.cos(t),Math.cos(2*t)];}
  function curv(t){var a=der(t);return a[0]*(-2*Math.sin(2*t))-a[1]*(-Math.sin(t));}
  function angDiff(a,b){var d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;}

  function Scene(cv,o){
    this.cv=cv;this.ctx=cv.getContext('2d');this.o=o;
    this.t=-0.3;this.drift=0;this.heading=0;this.marks=[];this.parts=[];this.prev=null;this.spin=0;this.sign=1;
    this.resize();var self=this;
    addEventListener('resize',function(){self.resize();});
  }
  Scene.prototype.resize=function(){
    var dpr=Math.min(devicePixelRatio||1,2),W=this.cv.clientWidth,H=this.cv.clientHeight;if(!W||!H)return;
    this.W=W;this.H=H;this.cv.width=W*dpr;this.cv.height=H*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);
    if(this.o.persp){this.k=Math.min(W*.45,H/.6);this.cy=H*.5-.03*this.k;}
    else{this.k=Math.min(W*.42,H*.74);this.cy=H*.5+(this.o.hudPad||0);}
    this.cx=W/2;this.bg=this.renderBg();
  };
  Scene.prototype.P=function(x,z,h){var p=this.o.persp?2.2/(2.2-z):1;return[this.cx+x*p*this.k,this.cy+z*p*this.k*(this.o.persp?.5:1)-(h||0)*p*this.k,p];};
  Scene.prototype.renderBg=function(){
    var c=document.createElement('canvas'),dpr=Math.min(devicePixelRatio||1,2);c.width=this.W*dpr;c.height=this.H*dpr;
    var x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);var s=this;
    // piazzale
    var q=[[-1.4,-.82],[1.4,-.82],[1.4,.82],[-1.4,.82]].map(function(v){return s.P(v[0],v[1]);});
    var g=x.createLinearGradient(0,q[0][1],0,q[2][1]);g.addColorStop(0,'#101015');g.addColorStop(1,'#18181f');
    x.fillStyle=g;x.beginPath();q.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);});x.closePath();x.fill();
    // righe del parcheggio sul fondo
    x.strokeStyle='rgba(236,234,230,.08)';x.lineWidth=1;
    for(var i=-12;i<=12;i++){var a=s.P(i*.11,-.82),b=s.P(i*.11,-.68);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();}
    // fari del piazzale
    if(this.o.persp){[[.12,.06],[.5,.02],[.88,.06]].forEach(function(l){var gx=x.createRadialGradient(s.W*l[0],s.H*l[1],0,s.W*l[0],s.H*l[1],s.W*.35);gx.addColorStop(0,'rgba(236,234,230,.10)');gx.addColorStop(1,'rgba(236,234,230,0)');x.fillStyle=gx;x.fillRect(0,0,s.W,s.H);});}
    // tracciato
    var N=300,pts=[];for(i=0;i<=N;i++){var w=pos(i/N*Math.PI*2);pts.push(s.P(w[0],w[1]));}
    function pass(wid,col,alt,dash){for(var i=0;i<N;i++){if(dash&&i%dash[0]>=dash[1])continue;var a=pts[i],b=pts[i+1];x.lineWidth=wid*a[2]*s.k;x.strokeStyle=alt&&(i%6<3)?alt:col;x.lineCap=dash?'butt':'round';x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();}}
    pass(TW+.03,SMOKE,PINK);
    pass(TW,'#22222a');
    pass(.004,'rgba(236,234,230,.35)',null,[5,2]);
    return c;
  };
  // avanza la simulazione; target = angolo di derapata desiderato (rad)
  Scene.prototype.step=function(dt,target,speed){
    var d=der(this.t),m=Math.hypot(d[0],d[1]);this.t+=speed*dt/m;
    var cs=Math.sign(curv(this.t))||this.sign,flip=cs!==this.sign;this.sign=cs;
    var travel=Math.atan2(d[1],d[0]);
    this.drift=target;
    var want=travel+this.sign*this.drift;
    if(this.spin>0){this.spin-=dt;this.heading+=dt*9;}
    else this.heading+=angDiff(this.heading,want)*(1-Math.exp(-dt*9));
    // ruote posteriori: scie e fumo
    var w=pos(this.t),h=this.heading,fx=Math.cos(h),fz=Math.sin(h),nx=-fz,nz=fx,L=.13,Wd=.07;
    var rear=[[w[0]-fx*L*.35+nx*Wd*.45,w[1]-fz*L*.35+nz*Wd*.45],[w[0]-fx*L*.35-nx*Wd*.45,w[1]-fz*L*.35-nz*Wd*.45]];
    var slide=Math.abs(angDiff(travel,h));
    if(this.prev&&slide>.18){for(var i=0;i<2;i++)this.marks.push({a:this.prev[i],b:rear[i],life:1});}
    if(this.marks.length>900)this.marks.splice(0,this.marks.length-900);
    for(i=0;i<this.marks.length;i++)this.marks[i].life-=dt*.09;
    while(this.marks.length&&this.marks[0].life<=0)this.marks.shift();
    this.prev=rear;
    var rate=slide>.18?Math.min(3,slide*3.2):0;
    for(i=0;i<2;i++){for(var n=0;n<rate;n++){if(Math.random()>.7)continue;this.parts.push({x:rear[i][0],z:rear[i][1],h:.01,vx:(Math.random()-.5)*.12-fx*.08,vz:(Math.random()-.5)*.12-fz*.08,vh:.05+Math.random()*.06,r:.03+Math.random()*.02,life:0,max:1.4+Math.random()*1.2,pink:Math.random()<.15});}}
    for(i=this.parts.length-1;i>=0;i--){var p=this.parts[i];p.life+=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.h+=p.vh*dt;p.r+=dt*.09;p.vx*=.985;p.vz*=.985;if(p.life>p.max)this.parts.splice(i,1);}
    if(this.parts.length>260)this.parts.splice(0,this.parts.length-260);
    return {flip:flip,slide:slide};
  };
  Scene.prototype.poly=function(pts,h,fill,stroke){var x=this.ctx,s=this;x.beginPath();pts.forEach(function(v,i){var p=s.P(v[0],v[1],h);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]);});x.closePath();if(fill){x.fillStyle=fill;x.fill();}if(stroke){x.strokeStyle=stroke;x.lineWidth=1;x.stroke();}};
  Scene.prototype.box=function(c,f,n,l0,l1,w){return[[c[0]+f[0]*l1+n[0]*w,c[1]+f[1]*l1+n[1]*w],[c[0]+f[0]*l1-n[0]*w,c[1]+f[1]*l1-n[1]*w],[c[0]+f[0]*l0-n[0]*w,c[1]+f[1]*l0-n[1]*w],[c[0]+f[0]*l0+n[0]*w,c[1]+f[1]*l0+n[1]*w]];};
  Scene.prototype.draw=function(){
    var x=this.ctx,s=this;x.clearRect(0,0,this.W,this.H);x.drawImage(this.bg,0,0,this.W,this.H);
    // scie di gomma
    x.lineCap='round';
    this.marks.forEach(function(m){var a=s.P(m.a[0],m.a[1]),b=s.P(m.b[0],m.b[1]);x.strokeStyle='rgba(236,30,143,'+(.42*m.life).toFixed(3)+')';x.lineWidth=.012*a[2]*s.k;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();});
    // auto
    var w=pos(this.t),h=this.heading,f=[Math.cos(h),Math.sin(h)],n=[-f[1],f[0]],L=.13,Wd=.07;
    // fari a terra
    x.save();x.globalCompositeOperation='lighter';
    this.poly([[w[0]+f[0]*L*.5+n[0]*Wd*.4,w[1]+f[1]*L*.5+n[1]*Wd*.4],[w[0]+f[0]*L*2.6+n[0]*Wd*1.6,w[1]+f[1]*L*2.6+n[1]*Wd*1.6],[w[0]+f[0]*L*2.6-n[0]*Wd*1.6,w[1]+f[1]*L*2.6-n[1]*Wd*1.6],[w[0]+f[0]*L*.5-n[0]*Wd*.4,w[1]+f[1]*L*.5-n[1]*Wd*.4]],0,'rgba(236,234,230,.07)');
    x.restore();
    this.poly(this.box(w,f,n,-L*.56,L*.56,Wd*.62),0,'rgba(0,0,0,.55)');
    [[-.3,.5],[-.3,-.5],[.3,.5],[.3,-.5]].forEach(function(o){var c=[w[0]+f[0]*L*o[0]+n[0]*Wd*o[1],w[1]+f[1]*L*o[0]+n[1]*Wd*o[1]];s.poly(s.box(c,f,n,-.018,.018,.01),0,'#050506');});
    var body=this.box(w,f,n,-L*.5,L*.5,Wd*.5);
    // fianchi
    for(var i=0;i<4;i++){var a=body[i],b=body[(i+1)%4];var pa=s.P(a[0],a[1],0),pb=s.P(b[0],b[1],0),qa=s.P(a[0],a[1],.035),qb=s.P(b[0],b[1],.035);x.fillStyle='#9d1460';x.beginPath();x.moveTo(pa[0],pa[1]);x.lineTo(pb[0],pb[1]);x.lineTo(qb[0],qb[1]);x.lineTo(qa[0],qa[1]);x.closePath();x.fill();}
    this.poly(body,.035,PINK);
    this.poly(this.box(w,f,n,-L*.28,L*.18,Wd*.4),.06,'#141418','rgba(236,234,230,.25)');
    // luci
    [[.5,.32],[.5,-.32]].forEach(function(o){var p=s.P(w[0]+f[0]*L*o[0]+n[0]*Wd*o[1],w[1]+f[1]*L*o[0]+n[1]*Wd*o[1],.03);x.fillStyle='#fff';x.beginPath();x.arc(p[0],p[1],Math.max(1.2,.008*p[2]*s.k),0,7);x.fill();});
    [[-.5,.32],[-.5,-.32]].forEach(function(o){var p=s.P(w[0]+f[0]*L*o[0]+n[0]*Wd*o[1],w[1]+f[1]*L*o[0]+n[1]*Wd*o[1],.03);x.drawImage(SPR_P,p[0]-8,p[1]-8,16,16);});
    // fumo
    this.parts.forEach(function(p){var q=s.P(p.x,p.z,s.o.persp?p.h:0),r=p.r*q[2]*s.k*1.8,a=Math.sin(Math.PI*p.life/p.max)*(p.pink?.35:.26);x.globalAlpha=a;x.drawImage(p.pink?SPR_P:SPR_W,q[0]-r/2,q[1]-r/2,r,r);});
    x.globalAlpha=1;
  };

  // ---------- hero: drift automatico ----------
  var hc=document.getElementById('heroTrack');
  if(hc){
    var hero=new Scene(hc,{persp:true}),phase=0;
    function heroTarget(dt){phase+=dt;return .62+.12*Math.sin(phase*1.7);}
    for(var i=0;i<260;i++)hero.step(1/60,heroTarget(1/60),1.05);
    hero.draw();
    if(!RM){
      var vis=true,last=performance.now();
      if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting;},{threshold:0}).observe(hc);
      (function loop(now){var dt=Math.min(.05,(now-last)/1000);last=now;if(vis){hero.step(dt,heroTarget(dt),1.05);hero.draw();}requestAnimationFrame(loop);})(last);
    }
  }

  // ---------- gioco: Sfida l'8 ----------
  var gc=document.getElementById('game');
  if(gc){
    var G=new Scene(gc,{persp:false,hudPad:18}),box=document.getElementById('gameBox');
    var el={score:document.getElementById('gScore'),combo:document.getElementById('gCombo'),time:document.getElementById('gTime'),best:document.getElementById('gBest'),over:document.getElementById('gOver'),title:document.getElementById('gTitle'),text:document.getElementById('gText'),eye:document.getElementById('gEyebrow'),start:document.getElementById('gStart'),flash:document.getElementById('gFlash')};
    var best=0;try{best=+localStorage.getItem('merydrift-best')||0;}catch(e){}
    el.best.textContent=best;
    var st={run:false,hold:false,ang:0,score:0,zone:0,out:0,combo:1,time:30};
    var LO=22,HI=52,SPIN=64,flashT;
    function flash(t){el.flash.textContent=t;el.flash.classList.add('show');clearTimeout(flashT);flashT=setTimeout(function(){el.flash.classList.remove('show');},700);}
    function gauge(){
      var x=G.ctx,cx=G.W/2,cy=G.H-14,r=Math.min(78,G.W*.16);
      function arc(a0,a1,col,w){x.strokeStyle=col;x.lineWidth=w;x.beginPath();x.arc(cx,cy,r,Math.PI+a0/90*Math.PI,Math.PI+a1/90*Math.PI);x.stroke();}
      x.lineCap='butt';arc(0,90,'rgba(236,234,230,.12)',10);arc(LO,HI,PINK,10);arc(SPIN,90,'rgba(255,255,255,.35)',10);
      var a=Math.PI+Math.min(st.ang,90)/90*Math.PI;x.strokeStyle=SMOKE;x.lineWidth=3;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8));x.stroke();
      x.fillStyle=SMOKE;x.font='800 22px "Big Shoulders Display", Impact, sans-serif';x.textAlign='center';x.fillText(Math.round(st.ang)+'°',cx,cy-r*.38);
    }
    function render(){G.draw();gauge();}
    function start(){st={run:true,hold:false,ang:0,score:0,zone:0,out:0,combo:1,time:30};G.marks=[];G.parts=[];G.spin=0;el.over.hidden=true;el.combo.textContent='x1';flash('Via!');}
    function end(){
      st.run=false;st.hold=false;var sc=Math.round(st.score),rec=sc>best;
      if(rec){best=sc;try{localStorage.setItem('merydrift-best',best);}catch(e){}el.best.textContent=best;}
      el.eye.textContent=rec?'Nuovo record':'Tempo scaduto';
      el.title.textContent=sc+' punti';
      el.text.textContent=sc<1500?'Serve un po\' di scuola. Tieni la lancetta nella zona rosa più a lungo.':sc<4000?'Niente male! Con un istruttore ex campione arrivi al tandem.':'Sei pronto per la pista vera. Ti aspettiamo a Covo.';
      el.start.textContent='Riprova';el.over.hidden=false;
    }
    el.start.addEventListener('click',start);
    function down(e){if(!st.run)return;st.hold=true;if(e.cancelable)e.preventDefault();}
    function up(){st.hold=false;}
    box.addEventListener('pointerdown',function(e){if(e.target.closest('.g-over'))return;down(e);});
    addEventListener('pointerup',up);addEventListener('pointercancel',up);
    box.addEventListener('contextmenu',function(e){e.preventDefault();});
    addEventListener('keydown',function(e){if(e.code==='Space'&&st.run){e.preventDefault();st.hold=true;}});
    addEventListener('keyup',function(e){if(e.code==='Space')st.hold=false;});
    // stato iniziale: auto in derapata ferma nel frame
    for(var j=0;j<180;j++)G.step(1/60,.7,.95);
    render();
    var gvis=false,gl=performance.now();
    if('IntersectionObserver' in window)new IntersectionObserver(function(e){gvis=e[0].isIntersecting;},{threshold:0}).observe(gc);else gvis=true;
    (function gloop(now){
      var dt=Math.min(.05,(now-gl)/1000);gl=now;
      if(gvis&&(st.run||!RM)){
        if(st.run){
          st.time-=dt;if(st.time<=0){st.time=0;end();}
          if(G.spin<=0){st.ang+=(st.hold?78:-96)*dt;st.ang=Math.max(0,Math.min(90,st.ang));}
          if(st.ang>SPIN&&G.spin<=0){G.spin=.8;st.ang=0;st.zone=0;st.combo=1;flash('Testacoda!');}
          var r=G.step(dt,st.ang*Math.PI/180,G.spin>0?.45:.95);
          if(r.flip&&st.ang>10){st.ang*=.35;if(st.combo>1)flash('Cambio!');}
          if(st.ang>=LO&&st.ang<=HI&&G.spin<=0){st.zone+=dt;st.out=0;var c=Math.min(8,1+Math.floor(st.zone/1.4));if(c>st.combo)flash('Combo x'+c);st.combo=c;st.score+=st.ang*st.combo*dt*2.2;}
          else{st.out+=dt;if(st.out>.6){st.zone=0;st.combo=1;}}
          el.score.textContent=Math.round(st.score);el.combo.textContent='x'+st.combo;el.time.textContent=Math.ceil(st.time);
        } else G.step(dt,.62+.1*Math.sin(now/600),.8);
        render();
      }
      requestAnimationFrame(gloop);
    })(gl);
  }
})();
