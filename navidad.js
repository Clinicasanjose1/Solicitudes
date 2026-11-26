/* Intro navideña — Clínica San José de Cúcuta
   Se muestra al abrir la app solo durante la temporada navideña.
   Para cambiar las fechas edite DESDE y HASTA (mes, día).
   Pruebas: agregue ?navidad=1 a la dirección para verla en cualquier fecha, o ?navidad=0 para ocultarla. */
(function () {
  'use strict';
  var DESDE = [11, 25];  // 25 de noviembre
  var HASTA = [1, 6];    // 6 de enero (Reyes)
  var DURACION = 5300;   // milisegundos

  var q = location.search;
  var forzar = /[?&]navidad=1/.test(q);
  if (/[?&]navidad=0/.test(q)) return;
  if (!forzar) {
    var hoy = new Date(), md = (hoy.getMonth() + 1) * 100 + hoy.getDate();
    var d = DESDE[0] * 100 + DESDE[1], h = HASTA[0] * 100 + HASTA[1];
    var enTemporada = d <= h ? (md >= d && md <= h) : (md >= d || md <= h);
    if (!enTemporada) return;
    // Si la app se abrió desde una notificación, ir directo a la solicitud
    if (location.hash.indexOf('#/solicitud/') === 0) return;
  }

  var css = [
    '#nv{position:fixed;inset:0;z-index:99999;overflow:hidden;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;',
    'background:radial-gradient(120% 80% at 50% 62%,#1b6fc0 0%,#0d4f97 32%,#0a3a74 60%,#05214a 100%);transition:opacity .6s ease}',
    '#nv.nv-fuera{opacity:0}',
    '#nv .nv-foto-fondo{position:absolute;inset:0;background:url(fondo-clinica.jpg) center/cover;opacity:.10;mix-blend-mode:screen}',
    '#nv canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '#nv .nv-estrellas i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.2;animation:nvTitila 1.8s ease-in-out infinite}',
    '@keyframes nvTitila{50%{opacity:1;transform:scale(1.6)}}',
    /* guirnalda */
    '#nv .nv-guirnalda{position:absolute;left:-2%;right:-2%;top:0;height:86px;transform:translateY(-100%);transition:transform .7s cubic-bezier(.2,1.4,.4,1)}',
    '#nv.nv-run .nv-guirnalda,#nv.nv-espera .nv-guirnalda{transform:none}',
    '#nv .nv-guirnalda svg{width:100%;height:100%;overflow:visible}',
    '#nv .nv-foco{animation:nvFoco 1.1s ease-in-out infinite alternate}',
    '@keyframes nvFoco{from{opacity:.35}to{opacity:1}}',
    /* escena */
    '#nv .nv-escena{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}',
    '#nv .nv-textos{position:absolute;left:0;right:0;top:max(92px,11vh);text-align:center;padding:0 18px;z-index:3}',
    '#nv .nv-titulo{margin:0;font-weight:900;font-size:clamp(40px,11vw,92px);line-height:1;letter-spacing:-.5px;',
    'background:linear-gradient(100deg,#fff 0%,#fff 38%,#ffe6a3 46%,#ffc94d 50%,#ffe6a3 54%,#fff 62%,#fff 100%);background-size:250% 100%;',
    '-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 18px rgba(0,0,0,.35));',
    'opacity:0;transform:scale(.6)}',
    '#nv.nv-run .nv-titulo{animation:nvPop .8s .9s cubic-bezier(.2,1.5,.4,1) forwards,nvBrillo 2.2s 1.5s ease-in-out infinite}',
    '@keyframes nvPop{to{opacity:1;transform:none}}',
    '@keyframes nvBrillo{from{background-position:100% 0}to{background-position:-60% 0}}',
    '#nv .nv-sub{margin:10px 0 0;font-size:clamp(16px,4.4vw,26px);font-weight:600;opacity:0;transform:translateY(12px)}',
    '#nv .nv-clinica{margin:14px auto 0;display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:999px;',
    'background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);font-size:clamp(12px,3.3vw,15px);font-weight:600;opacity:0;transform:translateY(12px);backdrop-filter:blur(4px)}',
    '#nv .nv-clinica img{width:26px;height:26px;border-radius:50%;background:#fff}',
    '#nv.nv-run .nv-sub{animation:nvSube .6s 1.6s ease-out forwards}',
    '#nv.nv-run .nv-clinica{animation:nvSube .6s 2.1s ease-out forwards}',
    '@keyframes nvSube{to{opacity:1;transform:none}}',
    /* foto */
    '#nv .nv-persona{position:relative;height:min(60vh,calc(92vw * 1.71));max-height:640px;z-index:2;opacity:0;transform:translateY(40px) scale(.92)}',
    '#nv.nv-run .nv-persona{animation:nvEntra 1s .25s cubic-bezier(.2,1.1,.3,1) forwards}',
    '@keyframes nvEntra{to{opacity:1;transform:none}}',
    '#nv .nv-persona img{height:100%;width:auto;display:block;position:relative;z-index:2;filter:drop-shadow(0 0 22px rgba(255,255,255,.28))}',
    '#nv .nv-halo{position:absolute;left:50%;top:42%;width:150%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;z-index:1;',
    'background:radial-gradient(circle,rgba(255,236,180,.55) 0%,rgba(120,190,255,.28) 35%,rgba(255,255,255,0) 68%)}',
    '#nv .nv-rayos{position:absolute;left:50%;top:42%;width:190%;aspect-ratio:1;transform:translate(-50%,-50%);z-index:0;opacity:.35;',
    'background:repeating-conic-gradient(rgba(255,255,255,.22) 0 6deg,rgba(255,255,255,0) 6deg 18deg);',
    '-webkit-mask:radial-gradient(circle,#000 0%,transparent 62%);mask:radial-gradient(circle,#000 0%,transparent 62%);animation:nvGira 14s linear infinite}',
    '@keyframes nvGira{to{transform:translate(-50%,-50%) rotate(360deg)}}',
    /* destellos */
    '#nv .nv-chispa{position:absolute;z-index:4;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;opacity:0}',
    '#nv .nv-chispa:before,#nv .nv-chispa:after{content:"";position:absolute;left:50%;top:0;width:3px;height:100%;margin-left:-1.5px;border-radius:2px;background:linear-gradient(#fff0,#fff,#fff0)}',
    '#nv .nv-chispa:after{transform:rotate(90deg)}',
    '#nv .nv-chispa.nv-on{animation:nvChispa 1.1s ease-out forwards}',
    '@keyframes nvChispa{0%{opacity:0;transform:scale(.2) rotate(0)}30%{opacity:1;transform:scale(1.25) rotate(45deg)}100%{opacity:0;transform:scale(.4) rotate(120deg)}}',
    /* botones */
    '#nv .nv-saltar{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:6;',
    'border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.18);color:#fff;font:600 14px/1 inherit;padding:10px 16px;border-radius:999px;cursor:pointer;backdrop-filter:blur(4px)}',
    '#nv .nv-puerta{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:24px}',
    '#nv.nv-espera .nv-puerta{display:flex}',
    '#nv.nv-espera .nv-escena{display:none}',
    '#nv .nv-puerta img{width:84px;height:84px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.15),0 10px 30px rgba(0,0,0,.3)}',
    '#nv .nv-puerta p{margin:0;font-size:18px;font-weight:600;opacity:.92}',
    '#nv .nv-entrar{border:0;border-radius:999px;padding:16px 30px;font:800 18px/1 inherit;color:#0a3a74;cursor:pointer;',
    'background:linear-gradient(180deg,#fff,#ffe9ad);box-shadow:0 10px 30px rgba(0,0,0,.3);animation:nvLate 1.4s ease-in-out infinite}',
    '@keyframes nvLate{50%{transform:scale(1.06)}}',
    /* pantallas anchas: foto a la izquierda, textos a la derecha */
    '@media (min-aspect-ratio:5/4){',
    '#nv .nv-escena{flex-direction:row;justify-content:center;align-items:flex-end;gap:4vw}',
    '#nv .nv-textos{position:relative;top:auto;order:2;align-self:center;text-align:left;max-width:46vw;padding:0}',
    '#nv .nv-persona{order:1;height:84vh;max-height:none}',
    '#nv .nv-titulo{font-size:clamp(48px,7vw,110px)}}',
    '@media (prefers-reduced-motion:reduce){#nv .nv-rayos{animation:none}}'
  ].join('\n');

  var est = document.createElement('style');
  est.textContent = css;
  document.head.appendChild(est);

  // Guirnalda de luces
  function guirnalda() {
    var colores = ['#ff4d5a', '#ffd34d', '#4dd68a', '#7fc8ff', '#ff9a3c'];
    var n = 15, s = '<svg viewBox="0 0 1000 86" preserveAspectRatio="none"><defs><filter id="nvG" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter></defs>';
    s += '<path d="M0 8 Q 83 62 166 14 T 333 14 T 500 14 T 666 14 T 833 14 T 1000 14" fill="none" stroke="#0f2c4d" stroke-width="3"/>';
    for (var i = 0; i < n; i++) {
      var x = 20 + i * (960 / (n - 1));
      var fase = ((x % 166.6) / 166.6);
      var y = 14 + Math.sin(fase * Math.PI) * 30;
      var c = colores[i % colores.length];
      var dl = (i % 3) * 0.37 + (i % 2) * 0.2;
      s += '<g class="nv-foco" style="animation-delay:' + dl + 's">' +
        '<circle cx="' + x + '" cy="' + (y + 14) + '" r="13" fill="' + c + '" filter="url(#nvG)"/>' +
        '<rect x="' + (x - 4) + '" y="' + (y - 1) + '" width="8" height="7" rx="1.5" fill="#33495f"/>' +
        '<ellipse cx="' + x + '" cy="' + (y + 14) + '" rx="6" ry="9" fill="' + c + '"/>' +
        '<ellipse cx="' + (x - 2) + '" cy="' + (y + 10) + '" rx="1.8" ry="3" fill="#fff" opacity=".7"/></g>';
    }
    return s + '</svg>';
  }

  var estrellas = '';
  for (var k = 0; k < 26; k++) {
    estrellas += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 60).toFixed(1) +
      '%;animation-delay:' + (Math.random() * 1.8).toFixed(2) + 's"></i>';
  }

  var nv = document.createElement('div');
  nv.id = 'nv';
  nv.setAttribute('role', 'dialog');
  nv.setAttribute('aria-label', 'Feliz Navidad');
  nv.innerHTML =
    '<div class="nv-foto-fondo"></div><div class="nv-estrellas">' + estrellas + '</div><canvas></canvas>' +
    '<div class="nv-guirnalda">' + guirnalda() + '</div>' +
    '<div class="nv-escena">' +
      '<div class="nv-textos"><h1 class="nv-titulo">¡Feliz Navidad!</h1>' +
      '<p class="nv-sub">y un próspero Año Nuevo</p>' +
      '<div class="nv-clinica"><img src="icon-192.png" alt="">Clínica San José de Cúcuta</div></div>' +
      '<div class="nv-persona"><div class="nv-rayos"></div><div class="nv-halo"></div><img src="santa-navidad.webp" alt=""></div>' +
    '</div>' +
    '<div class="nv-puerta"><img src="icon-192.png" alt=""><p>Clínica San José de Cúcuta</p>' +
      '<button class="nv-entrar" type="button">🎄 Toca para entrar</button></div>' +
    '<button class="nv-saltar" type="button">Saltar ›</button>';
  document.body.appendChild(nv);
  var overflowAntes = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  // Nieve
  var cv = nv.querySelector('canvas'), cx = cv.getContext('2d'), copos = [], W = 0, H = 0, dpr = 1, vivo = true, viento = 0;
  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = nv.clientWidth; H = nv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var total = Math.min(170, Math.round(W * H / 7000));
    while (copos.length < total) copos.push(nuevoCopo(true));
    copos.length = total;
  }
  function nuevoCopo(cualquierAltura) {
    var r = Math.random() < 0.15 ? 2.5 + Math.random() * 2.5 : 0.8 + Math.random() * 1.8;
    return { x: Math.random() * W, y: cualquierAltura ? Math.random() * H : -10, r: r,
      v: 0.4 + r * 0.35 + Math.random() * 0.4, f: Math.random() * 6.28, a: 0.5 + Math.random() * 0.5 };
  }
  function nevar(t) {
    if (!vivo) return;
    cx.clearRect(0, 0, W, H);
    viento = Math.sin(t / 1800) * 0.5;
    for (var i = 0; i < copos.length; i++) {
      var c = copos[i];
      c.y += c.v; c.f += 0.02; c.x += Math.sin(c.f) * 0.5 + viento;
      if (c.y > H + 10 || c.x < -20 || c.x > W + 20) { copos[i] = nuevoCopo(false); continue; }
      cx.globalAlpha = c.a;
      cx.beginPath();
      if (c.r > 2.4) { cx.shadowBlur = 8; cx.shadowColor = '#fff'; } else cx.shadowBlur = 0;
      cx.arc(c.x, c.y, c.r, 0, 6.283); cx.fillStyle = '#fff'; cx.fill();
    }
    requestAnimationFrame(nevar);
  }
  medir();
  window.addEventListener('resize', medir);
  requestAnimationFrame(nevar);

  // Destellos dorados alrededor de la foto
  function destellos(cuantos) {
    var p = nv.querySelector('.nv-persona').getBoundingClientRect();
    for (var i = 0; i < cuantos; i++) {
      (function (i) {
        setTimeout(function () {
          if (!vivo) return;
          var e = document.createElement('i');
          e.className = 'nv-chispa';
          var ang = Math.random() * 6.283, rad = 0.35 + Math.random() * 0.4;
          e.style.left = (p.left + p.width / 2 + Math.cos(ang) * p.width * rad) + 'px';
          e.style.top = (p.top + p.height * 0.38 + Math.sin(ang) * p.height * rad * 0.6) + 'px';
          var tam = 10 + Math.random() * 18;
          e.style.width = e.style.height = tam + 'px';
          e.style.margin = (-tam / 2) + 'px 0 0 ' + (-tam / 2) + 'px';
          if (Math.random() < 0.5) e.style.filter = 'drop-shadow(0 0 6px #ffd34d)';
          nv.appendChild(e);
          requestAnimationFrame(function () { e.classList.add('nv-on'); });
          setTimeout(function () { e.remove(); }, 1200);
        }, i * 70);
      })(i);
    }
  }

  // Música
  var audio = new Audio('intro-navidad.mp3');
  audio.preload = 'auto';
  audio.volume = 0.9;

  var cerrado = false, tCierre = null;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(tCierre);
    var vol = audio.volume, bajar = setInterval(function () {
      vol = Math.max(0, vol - 0.12); audio.volume = vol;
      if (vol <= 0) { clearInterval(bajar); audio.pause(); }
    }, 50);
    nv.classList.add('nv-fuera');
    setTimeout(function () {
      vivo = false;
      window.removeEventListener('resize', medir);
      nv.remove(); est.remove();
      document.documentElement.style.overflow = overflowAntes;
    }, 650);
  }

  function arrancar() {
    nv.classList.remove('nv-espera');
    nv.classList.add('nv-run');
    setTimeout(function () { destellos(10); }, 1300);
    setTimeout(function () { destellos(22); }, 3500);
    tCierre = setTimeout(cerrar, DURACION - 600);
  }

  nv.querySelector('.nv-saltar').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  nv.querySelector('.nv-entrar').addEventListener('click', function () {
    audio.currentTime = 0;
    var p = audio.play(); if (p && p.catch) p.catch(function () {});
    arrancar();
  });

  // Esperar la foto y la música (máximo 2,5 s) y luego empezar
  var img = nv.querySelector('.nv-persona img');
  var listaFoto = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  var listaAudio = new Promise(function (ok) {
    if (audio.readyState >= 3) return ok();
    audio.addEventListener('canplaythrough', ok, { once: true });
    audio.addEventListener('error', ok, { once: true });
  });
  var limite = new Promise(function (ok) { setTimeout(ok, 2500); });
  Promise.race([Promise.all([listaFoto, listaAudio]), limite]).then(function () {
    if (cerrado) return;
    var p;
    try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.then) {
      p.then(arrancar, function () {
        // El navegador no deja sonar música sin un toque: se pide un toque para entrar
        nv.classList.add('nv-espera');
      });
    } else arrancar();
  });
})();
