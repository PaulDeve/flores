/* ======================================================================
   EL JARDÍN SECRETO — script.js
   Vanilla JS puro. Sin librerías.
   Índice:
     1. Utilidades
     2. Cursor personalizado + spotlight
     3. Audio (Web Audio API, generado — sin archivos externos)
     4. Sistema de partículas (pétalos, luciérnagas, fuegos artificiales)
     5. Intro cinemática
     6. Fondo vivo (estrellas, nubes, hierba)
     7. Flores SVG (fábrica + jardín interactivo + galería + bouquet)
     8. Scroll reveals + nav + parallax
     9. Botones magnéticos + ripple
     10. Finale + reinicio
====================================================================== */

(() => {
  'use strict';

  /* ============================ 1. UTILIDADES ============================ */
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==================== 2. CURSOR PERSONALIZADO + SPOTLIGHT =================== */
  const cursorDot  = $('.cursor-dot');
  const cursorRing = $('.cursor-ring');
  const spotlight  = $('#spotlight');
  let mouseX = window.innerWidth/2, mouseY = window.innerHeight/2;
  let ringX = mouseX, ringY = mouseY;

  window.addEventListener('pointermove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (cursorDot) cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%,-50%)`;
    document.documentElement.style.setProperty('--mx', `${mouseX}px`);
    document.documentElement.style.setProperty('--my', `${mouseY}px`);
  });

  function tickCursor(){
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    if (cursorRing) cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
    requestAnimationFrame(tickCursor);
  }
  if (!prefersReducedMotion) requestAnimationFrame(tickCursor);

  document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, .ig-flower, .flower-card, .moment-card')) {
      cursorRing && cursorRing.classList.add('hover');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('a, button, .ig-flower, .flower-card, .moment-card')) {
      cursorRing && cursorRing.classList.remove('hover');
    }
  });

  /* ============ 3. AUDIO — generado con Web Audio API ============
     No se cargan archivos externos: se sintetiza un pad ambiental suave
     y pequeños "chimes" para las interacciones. Si prefieres música real,
     reemplaza toggleAmbient() por un <audio src="tu-cancion.mp3"> y
     enlázalo al mismo botón #sound-toggle.
  =================================================================== */
  let actx = null, ambientNodes = null, soundOn = false;

  function ensureAudioContext(){
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }

  function startAmbient(){
    const ctx = ensureAudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);

    const notes = [261.63, 329.63, 392.0, 523.25]; // C E G C — acorde cálido
    const oscs = notes.map((freq,i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5 / notes.length;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i*0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.connect(g); g.connect(master);
      osc.start(); lfo.start();
      return {osc, lfo, g};
    });
    ambientNodes = { master, oscs };
  }

  function stopAmbient(){
    if (!ambientNodes) return;
    const { master, oscs } = ambientNodes;
    master.gain.linearRampToValueAtTime(0, actx.currentTime + 1);
    setTimeout(() => { oscs.forEach(o => { o.osc.stop(); o.lfo.stop(); }); }, 1100);
    ambientNodes = null;
  }

  function playChime(freq = 660, duration = 0.6, type='sine', vol=0.15){
    if (!soundOn) return;
    const ctx = ensureAudioContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  }
  function playBloomSound(){ playChime(rand(500,700), 0.7, 'sine', 0.12); playChime(rand(800,1000), 0.5, 'triangle', 0.08); }
  function playClickSound(){ playChime(rand(300,420), 0.25, 'sine', 0.1); }

  const soundToggle = $('#sound-toggle');
  soundToggle && soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) startAmbient(); else stopAmbient();
  });

  /* ==================== 4. SISTEMA DE PARTÍCULAS ==================== */
  class ParticleField{
    constructor(canvas, opts={}){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts;
      this.particles = [];
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
    resize(){
      const dpr = Math.min(window.devicePixelRatio||1, 2);
      this.w = this.canvas.offsetWidth; this.h = this.canvas.offsetHeight;
      this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    add(p){ this.particles.push(p); }
    step(){
      const {ctx,w,h} = this;
      ctx.clearRect(0,0,w,h);
      this.particles = this.particles.filter(p => p.life === undefined || p.life > 0);
      for (const p of this.particles){ p.update(w,h); p.draw(ctx); }
    }
  }

  // --- pétalo que cae suavemente con balanceo ---
  function makePetal(w,h,startAtTop=true){
    const hue = rand(0,1) > .5 ? 'rgba(238,159,192,' : 'rgba(220,205,243,';
    return {
      x: rand(0,w), y: startAtTop ? rand(-h,0) : rand(0,h),
      size: rand(6,13), rot: rand(0,360), rotSpeed: rand(-30,30),
      vy: rand(14,28), swing: rand(20,60), swingSpeed: rand(.4,.9), t: rand(0,10),
      color: hue,
      update(w,h){
        this.t += 0.016 * this.swingSpeed;
        this.y += this.vy * 0.016;
        this.x += Math.sin(this.t) * this.swing * 0.016;
        this.rot += this.rotSpeed * 0.016;
        if (this.y > h + 20){ this.y = -20; this.x = rand(0,w); }
      },
      draw(ctx){
        ctx.save();
        ctx.translate(this.x,this.y); ctx.rotate(this.rot*Math.PI/180);
        ctx.fillStyle = this.color + '0.85)';
        ctx.beginPath();
        ctx.ellipse(0,0,this.size,this.size*0.6,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    };
  }

  // --- luciérnaga: punto luminoso que flota ---
  function makeFirefly(w,h){
    return {
      x: rand(0,w), y: rand(h*0.3,h), r: rand(1.5,3),
      baseX: 0, baseY: 0, t: rand(0,10), speed: rand(.2,.5),
      phase: rand(0,6.28),
      update(w,h){ this.t += 0.016*this.speed; this.x += Math.sin(this.t*1.3+this.phase)*0.4; this.y += Math.cos(this.t)*0.3; if(this.x<0)this.x=w; if(this.x>w)this.x=0; if(this.y<h*0.2)this.y=h*0.2; if(this.y>h)this.y=h; },
      draw(ctx){
        const glow = (Math.sin(this.t*3+this.phase)+1)/2;
        ctx.save();
        ctx.globalAlpha = 0.3 + glow*0.7;
        const grad = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*6);
        grad.addColorStop(0,'rgba(255,241,168,0.9)');
        grad.addColorStop(1,'rgba(255,241,168,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x,this.y,this.r*6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff6d0';
        ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    };
  }

  // --- partícula de estallido (burst) para clics / finale ---
  function makeBurstParticle(x,y,color){
    const angle = rand(0,Math.PI*2), speed = rand(60,220);
    return {
      x,y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 60,
      life: 1, decay: rand(0.6,1.1), size: rand(3,7), color, grav: rand(120,220),
      update(){ this.vy += this.grav*0.016; this.x += this.vx*0.016; this.y += this.vy*0.016; this.life -= this.decay*0.016; },
      draw(ctx){
        ctx.save(); ctx.globalAlpha = clamp(this.life,0,1);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
    };
  }

  // ---- fondo: pétalos ----
  const petalsCanvas = $('#petals-canvas');
  let petalsField;
  if (petalsCanvas){
    petalsField = new ParticleField(petalsCanvas);
    const count = window.innerWidth < 700 ? 16 : 30;
    for (let i=0;i<count;i++) petalsField.add(makePetal(petalsField.w, petalsField.h, false));
  }

  // ---- fondo: luciérnagas ----
  const firefliesCanvas = $('#fireflies-canvas');
  let firefliesField;
  if (firefliesCanvas){
    firefliesField = new ParticleField(firefliesCanvas);
    const count = window.innerWidth < 700 ? 10 : 22;
    for (let i=0;i<count;i++) firefliesField.add(makeFirefly(firefliesField.w, firefliesField.h));
  }

  function bgLoop(){
    petalsField && petalsField.step();
    firefliesField && firefliesField.step();
    requestAnimationFrame(bgLoop);
  }
  requestAnimationFrame(bgLoop);

  // ---- capa de estallidos flotante para clics de flores ----
  const burstCanvas = document.createElement('canvas');
  burstCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:150;';
  document.body.appendChild(burstCanvas);
  const burstField = new ParticleField(burstCanvas);
  burstCanvas.width = window.innerWidth; burstCanvas.height = window.innerHeight;
  burstField.w = window.innerWidth; burstField.h = window.innerHeight;
  window.addEventListener('resize', () => { burstField.resize(); });
  function burstAt(x,y,palette){
    for (let i=0;i<26;i++) burstField.add(makeBurstParticle(x,y, palette[Math.floor(rand(0,palette.length))]));
  }
  (function burstLoop(){ burstField.step(); requestAnimationFrame(burstLoop); })();

  const BLOOM_COLORS = ['#ee9fc0','#f9d8e4','#dccdf3','#e8b86d','#fff'];

  /* ==================== 5. INTRO CINEMÁTICA ==================== */
  const intro = $('#intro');
  const introCanvas = $('#intro-canvas');
  const introText = $('#intro-text');
  const introSkip = $('#intro-skip');
  const countdownOverlay = $('#countdown-overlay');
  const countdownDays = $('#cd-days');
  const countdownHours = $('#cd-hours');
  const countdownMinutes = $('#cd-minutes');
  const countdownSeconds = $('#cd-seconds');
  const countdownLabel = $('#countdown-label');
  const previewCountdownNow = true; // activa la experiencia inmediatamente para ver cómo queda

  function getNextNoonTarget(){
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(12, 0, 0, 0);
    return target;
  }

  function activateExperience(){
    document.body.classList.remove('countdown-active');
    countdownOverlay && countdownOverlay.remove();
    runIntro();
  }

  function startCountdown(){
    if (previewCountdownNow){
      activateExperience();
      return;
    }

    document.body.classList.add('countdown-active');
    const targetDate = getNextNoonTarget();

    function updateCountdown(){
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0){
        clearInterval(countdownTimer);
        activateExperience();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      countdownDays && (countdownDays.textContent = String(days).padStart(2, '0'));
      countdownHours && (countdownHours.textContent = String(hours).padStart(2, '0'));
      countdownMinutes && (countdownMinutes.textContent = String(minutes).padStart(2, '0'));
      countdownSeconds && (countdownSeconds.textContent = String(seconds).padStart(2, '0'));
      countdownLabel && (countdownLabel.textContent = targetDate.toLocaleString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }));
    }

    updateCountdown();
    const countdownTimer = setInterval(updateCountdown, 1000);
  }

  function runIntro(){
    if (!intro) return;
    const ctx = introCanvas.getContext('2d');
    const resizeIntro = () => { introCanvas.width = window.innerWidth; introCanvas.height = window.innerHeight; };
    resizeIntro(); window.addEventListener('resize', resizeIntro);

    // partículas doradas ascendiendo
    const sparkles = Array.from({length:70}, () => ({
      x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
      r: rand(0.6,2.2), vy: rand(6,18), tw: rand(0,6.28)
    }));
    // pétalos cayendo lentamente
    const introPetals = Array.from({length: prefersReducedMotion?0:26}, () => makePetal(window.innerWidth, window.innerHeight, true));

    let t0 = performance.now();
    let running = true;
    function frame(now){
      if (!running) return;
      const dt = Math.min((now - t0)/1000, 0.05); t0 = now;
      ctx.clearRect(0,0,introCanvas.width, introCanvas.height);
      // partículas
      sparkles.forEach(s => {
        s.tw += dt*2; s.y -= s.vy*dt;
        if (s.y < -10) s.y = introCanvas.height + 10;
        const a = (Math.sin(s.tw)+1)/2;
        ctx.fillStyle = `rgba(255,241,200,${0.15+a*0.6})`;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });
      introPetals.forEach(p => { p.update(introCanvas.width, introCanvas.height); p.draw(ctx); });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const fullMessage = 'Para ti; Lii, mi mejor amiga ❤️';
    function typewrite(){
      let i = 0;
      const speed = 55;
      const int = setInterval(() => {
        introText.textContent = fullMessage.slice(0,i+1);
        i++;
        if (i >= fullMessage.length){
          clearInterval(int);
          introText.classList.add('done');
          setTimeout(finishIntro, 1600);
        }
      }, speed);
    }

    function finishIntro(){
      running = false;
      intro.classList.add('hide');
      document.body.style.cursor = '';
      setTimeout(() => { intro.remove(); }, 1700);
    }

    // secuencia: negro → glow (css) → texto tipo máquina de escribir
    setTimeout(typewrite, prefersReducedMotion ? 200 : 1800);
    introSkip.addEventListener('click', finishIntro);

    if (prefersReducedMotion){ setTimeout(finishIntro, 2600); }
  }
  startCountdown();

  /* ==================== 6. FONDO VIVO: detalle ==================== */
  // estrellas
  const starsWrap = $('#stars');
  if (starsWrap){
    for (let i=0;i<70;i++){
      const s = document.createElement('div');
      s.className = 'star';
      s.style.left = rand(0,100)+'%';
      s.style.top = rand(0,100)+'%';
      s.style.animationDelay = rand(0,3)+'s';
      starsWrap.appendChild(s);
    }
  }
  // nubes
  const cloudsWrap = $('#clouds');
  if (cloudsWrap){
    for (let i=0;i<5;i++){
      const c = document.createElement('div');
      c.className = 'cloud';
      const size = rand(50,110);
      c.style.width = size+'px'; c.style.height = size*0.4+'px';
      c.style.top = rand(4,30)+'%';
      c.style.animationDuration = rand(50,100)+'s';
      c.style.animationDelay = '-'+rand(0,60)+'s';
      cloudsWrap.appendChild(c);
    }
  }
  // hierba
  const grassWrap = $('#grass');
  if (grassWrap){
    const n = window.innerWidth < 700 ? 60 : 140;
    for (let i=0;i<n;i++){
      const b = document.createElement('div');
      b.className = 'blade';
      b.style.left = (i/n*100)+'%';
      b.style.height = rand(14,34)+'px';
      b.style.animationDelay = '-'+rand(0,4)+'s';
      b.style.background = Math.random()>0.5 ? '#6f9a6c' : '#82a878';
      grassWrap.appendChild(b);
    }
  }

  /* ==================== 7. FLORES SVG ==================== */
  const FLOWER_TYPES = [
    { id:'rosa',      name:'Rosa',        color:'#ee9fc0', center:'#c9678f', petals:5,  shape:'round',   meaning:'porque eres el motivo de siempre.' },
    { id:'tulipan',   name:'Tulipán',     color:'#f2a5a0', center:'#d16a63', petals:3,  shape:'pointed', meaning:'por tu forma tan tuya de amar.' },
    { id:'peonia',    name:'Peonía',      color:'#f6c9de', center:'#e08bb0', petals:8,  shape:'round',   meaning:'por lo abundante que es tu cariño.' },
    { id:'lavanda',   name:'Lavanda',     color:'#b49ce3', center:'#8a6bc9', petals:6,  shape:'spike',   meaning:'por la calma que me das.' },
    { id:'margarita', name:'Margarita',   color:'#ffffff', center:'#e8b86d', petals:10, shape:'thin',    meaning:'por lo simple y honesto de nosotros.' },
    { id:'lirio',     name:'Lirio',       color:'#dccdf3', center:'#8a6bc9', petals:6,  shape:'pointed', meaning:'por tu elegancia sin esfuerzo.' },
    { id:'girasol',   name:'Girasol',     color:'#f3d9a8', center:'#8a5a2b', petals:12, shape:'thin',    meaning:'porque contigo todo se siente luz.' },
    { id:'orquidea',  name:'Orquídea',    color:'#e0b3e8', center:'#a15bc2', petals:5,  shape:'round',   meaning:'por lo única que eres.' },
    { id:'cerezo',    name:'Flor de cerezo', color:'#fbdce6', center:'#ee9fc0', petals:5, shape:'round', meaning:'porque florecemos en cada temporada.' },
  ];

  function petalPath(shape, r){
    switch(shape){
      case 'pointed': return `M0,0 C ${r*0.55},-${r*0.3} ${r*0.55},-${r*0.9} 0,-${r} C -${r*0.55},-${r*0.9} -${r*0.55},-${r*0.3} 0,0 Z`;
      case 'spike':   return `M0,0 C ${r*0.28},-${r*0.5} ${r*0.2},-${r*0.9} 0,-${r} C -${r*0.2},-${r*0.9} -${r*0.28},-${r*0.5} 0,0 Z`;
      case 'thin':    return `M0,0 C ${r*0.22},-${r*0.4} ${r*0.16},-${r*0.95} 0,-${r} C -${r*0.16},-${r*0.95} -${r*0.22},-${r*0.4} 0,0 Z`;
      default:        return `M0,0 C ${r*0.75},-${r*0.15} ${r*0.7},-${r*0.85} 0,-${r*0.98} C -${r*0.7},-${r*0.85} -${r*0.75},-${r*0.15} 0,0 Z`;
    }
  }

  function flowerSVG(type, size=100){
    const r = size*0.34;
    let petalsMarkup = '';
    for (let i=0;i<type.petals;i++){
      const angle = (360/type.petals)*i;
      petalsMarkup += `<path d="${petalPath(type.shape, r)}" fill="${type.color}" opacity="0.96" transform="rotate(${angle})"/>`;
    }
    const stemH = size*0.55;
    return `
    <svg viewBox="-${size/2} -${size*0.72} ${size} ${size*0.72+stemH}" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,${size*0.02} C ${size*0.05},${stemH*0.4} -${size*0.05},${stemH*0.7} 0,${stemH}" stroke="#7a9d72" stroke-width="${size*0.035}" fill="none" stroke-linecap="round"/>
      <path d="M0,${stemH*0.45} C ${size*0.18},${stemH*0.4} ${size*0.26},${stemH*0.55} ${size*0.16},${stemH*0.7}" stroke="#7a9d72" stroke-width="${size*0.025}" fill="none" stroke-linecap="round"/>
      <g class="petals">${petalsMarkup}</g>
      <circle cx="0" cy="0" r="${size*0.09}" fill="${type.center}"/>
    </svg>`;
  }

  // ---- 7a. flores decorativas del hero ----
  const heroFlowers = $('#hero-flowers');
  if (heroFlowers){
    const n = window.innerWidth < 700 ? 5 : 9;
    for (let i=0;i<n;i++){
      const type = FLOWER_TYPES[i % FLOWER_TYPES.length];
      const el = document.createElement('div');
      const size = rand(40,90);
      el.style.cssText = `position:absolute; width:${size}px; height:${size*1.5}px; left:${rand(2,92)}%; top:${rand(58,92)}%; opacity:${rand(0.5,0.9)}; animation: floatSlow ${rand(6,11)}s ease-in-out infinite; animation-delay:-${rand(0,6)}s;`;
      el.innerHTML = flowerSVG(type, size);
      heroFlowers.appendChild(el);
    }
  }

  // ---- 7b. jardín interactivo ----
  const igWrap = $('#interactive-garden');
  if (igWrap){
    const n = window.innerWidth < 700 ? 12 : 22;
    for (let i=0;i<n;i++){
      const type = FLOWER_TYPES[i % FLOWER_TYPES.length];
      const size = rand(46,84);
      const el = document.createElement('div');
      el.className = 'ig-flower';
      el.style.left = rand(0,92)+'%';
      el.style.top = rand(4,86)+'%';
      el.style.width = size+'px';
      el.style.height = (size*1.5)+'px';
      el.style.setProperty('--tilt', rand(-14,14)+'deg');
      el.innerHTML = flowerSVG(type, size) + '<span class="ig-heart-pop">❤</span>';
      el.dataset.bloomed = '0';

      el.addEventListener('mouseenter', () => el.classList.add('tilt'));
      el.addEventListener('mouseleave', () => el.classList.remove('tilt'));
      el.addEventListener('click', () => {
        el.classList.add('bloom');
        playBloomSound();
        const rect = el.getBoundingClientRect();
        burstAt(rect.left+rect.width/2, rect.top+rect.height*0.25, BLOOM_COLORS);
        const heart = el.querySelector('.ig-heart-pop');
        heart.classList.remove('go'); void heart.offsetWidth; heart.classList.add('go');
        setTimeout(() => el.classList.remove('bloom'), 900);
      });
      igWrap.appendChild(el);
    }
  }

  // ---- 7c. galería con tilt 3D ----
  const galleryWrap = $('#flower-gallery');
  if (galleryWrap){
    FLOWER_TYPES.forEach(type => {
      const card = document.createElement('div');
      card.className = 'flower-card';
      card.innerHTML = `${flowerSVG(type,64)}<h3>${type.name}</h3><p>${type.meaning}</p>`;
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left)/rect.width - 0.5;
        const py = (e.clientY - rect.top)/rect.height - 0.5;
        card.style.transform = `rotateY(${px*14}deg) rotateX(${-py*14}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      card.addEventListener('click', () => {
        playClickSound();
        const rect = card.getBoundingClientRect();
        burstAt(rect.left+rect.width/2, rect.top+20, BLOOM_COLORS);
      });
      galleryWrap.appendChild(card);
    });
  }

  // ---- 7d. bouquet gigante ----
  const bouquetStage = $('#bouquet-stage');
  if (bouquetStage){
    const positions = [
      {x:50,y:92,rot:0}, {x:30,y:80,rot:-18}, {x:70,y:80,rot:18},
      {x:14,y:60,rot:-30}, {x:86,y:60,rot:30}, {x:38,y:52,rot:-8},
      {x:62,y:52,rot:8}, {x:50,y:36,rot:0}, {x:22,y:38,rot:-22},
      {x:78,y:38,rot:22}
    ];
    positions.forEach((pos,i) => {
      const type = FLOWER_TYPES[i % FLOWER_TYPES.length];
      const size = rand(70,120);
      const el = document.createElement('div');
      el.className = 'bq-flower';
      el.style.left = pos.x+'%'; el.style.top = pos.y+'%';
      el.style.width = size+'px'; el.style.height = (size*1.5)+'px';
      el.style.setProperty('--rot', pos.rot+'deg');
      el.style.setProperty('--bd', (i*0.09)+'s');
      el.style.transform = `translate(-50%,0) rotate(${pos.rot}deg)`;
      el.innerHTML = flowerSVG(type, size);
      bouquetStage.appendChild(el);
    });
  }

  /* ==================== 8. SCROLL REVEALS + NAV + PARALLAX ==================== */
  const revealTargets = $$('.reveal-blur, .reveal-up, .reveal-word, .bq-flower');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in-view');
        if (entry.target.id === 'final') triggerFinale();
      }
    });
  }, { threshold: 0.25 });
  revealTargets.forEach(t => io.observe(t));

  const finalSection = $('#final');
  if (finalSection) io.observe(finalSection);

  // nav de puntos
  const navDots = $$('.dot-nav .dot');
  const navSections = $$('.section');
  if (navDots.length){
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          navDots.forEach(d => d.classList.remove('active'));
          const match = navDots.find(d => d.getAttribute('href') === '#'+entry.target.id);
          match && match.classList.add('active');
        }
      });
    }, { threshold: 0.5 });
    navSections.forEach(s => navIO.observe(s));
  }

  // parallax suave del fondo según scroll
  const celestial = $('#celestial');
  const hills = $('.hills');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (celestial) celestial.style.transform = `translateY(${y*0.08}px)`;
    if (hills) hills.style.transform = `translateY(${-y*0.03}px)`;
  }, { passive:true });

  /* ==================== 9. BOTONES MAGNÉTICOS + RIPPLE ==================== */
  $$('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width/2;
      const my = e.clientY - rect.top - rect.height/2;
      btn.style.transform = `translate(${mx*0.25}px, ${my*0.25}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    btn.addEventListener('click', e => {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size+'px';
      ripple.style.left = (e.clientX - rect.left - size/2)+'px';
      ripple.style.top = (e.clientY - rect.top - size/2)+'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
      playClickSound();
    });
  });

  /* ==================== 10. FINALE + REINICIO ==================== */
  let finaleTriggered = false;
  const finaleCanvas = $('#finale-canvas');
  const finaleHeart = $('#finale-heart');

  function triggerFinale(){
    if (finaleTriggered) return;
    finaleTriggered = true;
    finaleHeart && finaleHeart.classList.add('go');

    if (!finaleCanvas) return;
    const field = new ParticleField(finaleCanvas);
    let last = performance.now();

    function launchFirework(){
      const x = rand(field.w*0.15, field.w*0.85);
      const y = rand(field.h*0.2, field.h*0.55);
      for (let i=0;i<40;i++) field.add(makeBurstParticle(x,y, BLOOM_COLORS));
    }
    const fireworkInterval = setInterval(launchFirework, 900);
    launchFirework();

    (function loop(now){
      field.step();
      requestAnimationFrame(loop);
    })(last);

    // detener nuevos lanzamientos tras un rato para no saturar (las partículas existentes se consumen solas)
    setTimeout(() => clearInterval(fireworkInterval), 12000);
  }

  const replayBtn = $('#replay-btn');
  replayBtn && replayBtn.addEventListener('click', () => {
    finaleTriggered = false;
    finaleHeart && finaleHeart.classList.remove('go');
    $$('.reveal-blur, .reveal-up, .reveal-word, .bq-flower').forEach(el => el.classList.remove('in-view'));
    window.scrollTo({ top:0, behavior:'smooth' });
    setTimeout(() => {
      $$('.reveal-blur, .reveal-up, .reveal-word').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add('in-view');
      });
    }, 900);
  });

})();
