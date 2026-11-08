/*
 * App de Solicitudes — Clínica San José de Cúcuta
 * Interfaz web instalable (PWA). Habla con el servidor de Apps Script
 * y recibe notificaciones push con Firebase Cloud Messaging.
 * No es necesario editar este archivo: la configuración va en config.js.
 */
const CFG = self.APP_CONFIG || {};
const FIREBASE_VERSION = '10.12.2';
const ESTADOS_ABIERTOS = ['Pendiente', 'Reabierta', 'Asignada', 'En proceso', 'Por confirmar'];
const CLASE_ESTADO = {
  'Pendiente': 'e-pendiente', 'Reabierta': 'e-reabierta', 'Asignada': 'e-asignada', 'En proceso': 'e-proceso',
  'Por confirmar': 'e-confirmar', 'Cerrada': 'e-cerrada', 'Cancelada': 'e-cancelada'
};
const ORDEN_PRIORIDAD = { 'Urgente': 0, 'Alta': 1, 'Media': 2, 'Normal': 2, 'Baja': 3 };
const CLASE_PRIORIDAD = { 'Urgente': 'p-urgente', 'Alta': 'p-alta', 'Media': 'p-media', 'Normal': 'p-media', 'Baja': 'p-baja' };

const E = {
  token: leer('token'),
  usuario: leer('usuario'),
  config: leer('config'),
  contadores: {},
  noLeidas: 0,
  filtroModulo: 'Todos',
  instalador: null
};

// ----------------------------- utilidades -----------------------------
function leer(k) { try { return JSON.parse(localStorage.getItem('csj_' + k)); } catch (e) { return null; } }
function guardar(k, v) { try { localStorage.setItem('csj_' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
function borrar(k) { try { localStorage.removeItem('csj_' + k); } catch (e) { /* nada */ } }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function hace(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}
const esAdmin = () => E.usuario && (E.usuario.rol === 'Admin' || E.usuario.rol === 'Coordinador');
const esLider = () => E.usuario && E.usuario.rol === 'Líder';
const esPersonal = () => E.usuario && E.usuario.rol !== 'Área';
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esInstalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ------------------------------- servidor -------------------------------
async function api(accion, datos) {
  if (!CFG.API_URL || /PEGUE/.test(CFG.API_URL)) throw new Error('Falta configurar API_URL en config.js');
  let r;
  try {
    // Sin cabeceras extra para que el navegador no haga una petición previa (CORS) que Apps Script no acepta.
    r = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ accion, token: E.token, datos: datos || {} }) });
  } catch (e) {
    throw new Error('Sin conexión con el servidor. Revise el internet e intente de nuevo.');
  }
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('Respuesta inválida del servidor'); }
  if (!j.ok) {
    if (j.error === 'SESION_VENCIDA') { cerrarSesionLocal(); throw new Error('Su sesión venció. Inicie sesión de nuevo.'); }
    throw new Error(j.error || 'Error desconocido');
  }
  return j.datos;
}

// ------------------------------ interfaz base ------------------------------
function toast(mensaje, opciones) {
  const o = opciones || {};
  const t = document.createElement('div');
  t.className = 'toast' + (o.error ? ' toast-error' : '');
  t.innerHTML = '<span>' + esc(mensaje) + '</span>' + (o.accion ? '<button type="button">Ver</button>' : '');
  if (o.accion) $('button', t).addEventListener('click', () => { o.accion(); t.remove(); });
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('saliendo'), o.duracion || 4500);
  setTimeout(() => t.remove(), (o.duracion || 4500) + 400);
}
const mostrarError = (m) => toast(m, { error: true, duracion: 6000 });

function abrirModal(html) {
  const m = $('#modal');
  m.innerHTML = '<div class="modal-fondo"></div><div class="modal-caja" role="dialog" aria-modal="true">' + html + '</div>';
  m.hidden = false;
  $('.modal-fondo', m).addEventListener('click', cerrarModal);
  return m;
}
function cerrarModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

/** Pide un texto en una ventana. Devuelve el texto o null si cancela. */
function pedirTexto(o) {
  return new Promise((resolver) => {
    const m = abrirModal(
      '<h3>' + esc(o.titulo) + '</h3>' + (o.mensaje ? '<p class="suave">' + esc(o.mensaje) + '</p>' : '') +
      '<textarea id="modal-texto" rows="3" maxlength="500" placeholder="' + esc(o.placeholder || '') + '"></textarea>' +
      '<div class="modal-botones"><button type="button" class="btn btn-sec" id="modal-no">Volver</button>' +
      '<button type="button" class="btn ' + (o.peligro ? 'btn-peligro' : 'btn-pri') + '" id="modal-si">' + esc(o.boton || 'Aceptar') + '</button></div>');
    $('#modal-texto', m).focus();
    $('#modal-no', m).addEventListener('click', () => { cerrarModal(); resolver(null); });
    $('#modal-si', m).addEventListener('click', () => {
      const v = $('#modal-texto', m).value.trim();
      if (o.requerido && !v) { $('#modal-texto', m).classList.add('invalido'); return; }
      cerrarModal(); resolver(v);
    });
  });
}
function confirmar(o) {
  return new Promise((resolver) => {
    const m = abrirModal('<h3>' + esc(o.titulo) + '</h3><p class="suave">' + esc(o.mensaje) + '</p>' +
      '<div class="modal-botones"><button type="button" class="btn btn-sec" id="modal-no">Volver</button>' +
      '<button type="button" class="btn ' + (o.peligro ? 'btn-peligro' : 'btn-pri') + '" id="modal-si">' + esc(o.boton || 'Aceptar') + '</button></div>');
    $('#modal-no', m).addEventListener('click', () => { cerrarModal(); resolver(false); });
    $('#modal-si', m).addEventListener('click', () => { cerrarModal(); resolver(true); });
  });
}

/** Ejecuta una acción mostrando el botón ocupado. */
async function conBoton(boton, textoOcupado, fn) {
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.innerHTML = '<span class="girando"></span>' + esc(textoOcupado);
  try { return await fn(); } finally { boton.disabled = false; boton.innerHTML = original; }
}

function pintar(html) { $('#app').innerHTML = html; window.scrollTo(0, 0); }
function cargando() { $('#app').innerHTML = '<div class="cargando"><span class="girando grande"></span>Cargando…</div>'; }

function chipEstado(e) { return '<span class="chip ' + (CLASE_ESTADO[e] || '') + '">' + esc(e) + '</span>'; }
function chipPrioridad(p) { return p ? '<span class="chip ' + (CLASE_PRIORIDAD[p] || '') + '">' + esc(p === 'Normal' ? 'Media' : p) + '</span>' : ''; }

function tarjeta(s, opciones) {
  const o = opciones || {};
  return '<a class="tarjeta" href="#/solicitud/' + encodeURIComponent(s.id) + '">' +
    '<div class="tarjeta-arriba"><span class="tarjeta-id">' + esc(s.id) + '</span>' + chipPrioridad(s.prioridad) + chipEstado(s.estado) + '</div>' +
    '<div class="tarjeta-titulo">' + esc(s.tipo) + '</div>' +
    '<div class="tarjeta-linea">' + esc(o.mostrarArea === false ? s.modulo : s.area + ' · ' + s.modulo) + '</div>' +
    '<div class="tarjeta-linea">' + (s.servicio ? esc(s.servicio) + ' · ' : '') + 'Piso ' + esc(s.piso) + ' · ' + esc(s.ubicacion) + '</div>' +
    '<div class="tarjeta-pie"><span>' + esc(hace(s.fecha)) + '</span>' +
    (s.tecnicoNombre ? '<span>' + esc(s.tecnicoNombre) + '</span>' : '') + '</div></a>';
}

function vacio(texto) { return '<div class="vacio">' + esc(texto) + '</div>'; }

function pestanas(lista, activa) {
  return '<nav class="pestanas">' + lista.map((p) =>
    '<a href="' + p.href + '" class="' + (p.id === activa ? 'activa' : '') + '">' + esc(p.texto) +
    (p.n ? ' <span class="mini">' + p.n + '</span>' : '') + '</a>').join('') + '</nav>';
}

function ponerBarra(titulo, conAtras) {
  $('#barra').hidden = false;
  $('#barra-titulo').textContent = titulo;
  $('#btn-atras').hidden = !conAtras;
}

function actualizarContador() {
  const c = $('#contador-notif');
  c.textContent = E.noLeidas > 99 ? '99+' : String(E.noLeidas);
  c.hidden = !E.noLeidas;
}

async function refrescarResumen() {
  if (!E.token) return;
  try {
    const r = await api('inicio');
    E.usuario = r.usuario; E.config = r.config; E.contadores = r.contadores; E.noLeidas = r.noLeidas;
    guardar('usuario', E.usuario); guardar('config', E.config);
    actualizarContador();
  } catch (e) { /* silencioso */ }
}

// -------------------------------- rutas --------------------------------
const RUTAS = [
  [/^#\/login$/, vistaLogin],
  [/^#\/?$/, vistaInicio],
  [/^#\/reportar$/, vistaReportar],
  [/^#\/mis-reportes$/, vistaMisReportes],
  [/^#\/administrar(?:\/([a-z-]+))?$/, vistaAdministrar],
  [/^#\/solicitud\/(.+)$/, vistaDetalle],
  [/^#\/notificaciones$/, vistaNotificaciones],
  [/^#\/dashboard(?:\/([a-z]+))?$/, vistaDashboard]
];

const PILA = []; // pantallas visitadas, para el botón Atrás

async function enrutar() {
  cerrarModal();
  document.body.classList.remove('en-login', 'en-inicio');
  const h = location.hash || '#/';
  if (PILA[PILA.length - 1] !== h) {
    if (PILA[PILA.length - 2] === h) PILA.pop(); else PILA.push(h);
  }
  if (!E.token && h !== '#/login') {
    if (h.indexOf('#/solicitud/') === 0) guardar('despuesLogin', h);
    location.replace('#/login');
    return;
  }
  if (E.token && h === '#/login') { location.replace('#/'); return; }
  for (const [patron, vista] of RUTAS) {
    const m = h.match(patron);
    if (m) {
      try { await vista(m[1] ? decodeURIComponent(m[1]) : undefined); } catch (e) {
        pintar('<div class="error-caja"><p>' + esc(e.message) + '</p><button class="btn btn-pri" id="reintentar">Reintentar</button></div>');
        $('#reintentar').addEventListener('click', enrutar);
      }
      return;
    }
  }
  location.replace('#/');
}

// -------------------------------- login --------------------------------
const SVG_USUARIO = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SVG_CANDADO = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/></svg>';
const SVG_OJO = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const SVG_OJO_NO = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 12s3.6-7 10-7c2 0 3.7.7 5.1 1.6M22 12s-3.6 7-10 7c-2 0-3.7-.7-5.1-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 21L21 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const SVG_ENTRAR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

async function vistaLogin() {
  $('#barra').hidden = true;
  document.body.classList.add('en-login');
  pintar(
    '<div class="login-escena" aria-hidden="true">' +
    '<div class="login-foto"></div>' +
    '<svg class="login-curva curva-arriba" viewBox="0 0 600 300" preserveAspectRatio="none"><path d="M0 0H600C430 30 250 90 120 190 70 228 30 262 0 300Z" fill="#00335a"/><path d="M0 300C40 240 120 170 260 110 360 66 470 36 600 20" fill="none" stroke="#2f74d0" stroke-opacity=".55" stroke-width="10"/></svg>' +
    '<svg class="login-curva curva-abajo" viewBox="0 0 600 300" preserveAspectRatio="none"><path d="M600 300H0C170 280 350 220 480 120 530 82 570 40 600 0Z" fill="#00335a"/><path d="M600 0C560 60 480 130 340 190 240 232 130 262 0 280" fill="none" stroke="#2f74d0" stroke-opacity=".55" stroke-width="10"/></svg>' +
    '<svg class="login-cruz cruz-1" viewBox="0 0 100 100"><path d="M36 6h28v30h30v28H64v30H36V64H6V36h30z" fill="none" stroke="#9ab8e0" stroke-width="3" stroke-linejoin="round"/></svg>' +
    '<svg class="login-cruz cruz-2" viewBox="0 0 100 100"><path d="M36 6h28v30h30v28H64v30H36V64H6V36h30z" fill="#cddcf2"/></svg>' +
    '</div>' +
    '<div class="login">' +
    '<img src="icon-512.png" alt="Clínica San José de Cúcuta" class="login-logo">' +
    '<h1>' + esc(CFG.NOMBRE_APP || 'Solicitudes') + '</h1>' +
    '<p class="login-clinica">' + esc(CFG.NOMBRE_CLINICA || '') + '</p>' +
    '<div class="login-divisor"><svg viewBox="0 0 40 20" width="32" height="16" aria-hidden="true"><path d="M0 10h11l3-7 5 14 4-10 3 3h14" fill="none" stroke="#00436e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg></div>' +
    '<form id="form-login" class="login-tarjeta" autocomplete="on">' +
    '<div class="login-campo"><span class="login-icono">' + SVG_USUARIO + '</span><label>Usuario<input name="usuario" autocomplete="username" autocapitalize="none" required placeholder="Ej: urgencias"></label></div>' +
    '<div class="login-campo"><span class="login-icono">' + SVG_CANDADO + '</span><label>PIN<span class="con-ojo"><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required placeholder="Ingrese su PIN">' +
    '<button type="button" class="ver-pin" aria-label="Mostrar PIN">' + SVG_OJO_NO + '</button></span></label></div>' +
    '<button class="btn btn-pri btn-ancho btn-entrar" type="submit">' + SVG_ENTRAR + 'Entrar</button>' +
    '</form>' +
    '<div class="login-divisor info"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#00436e" stroke-width="1.6"/><path d="M12 11v6M12 7.5v.5" stroke="#00436e" stroke-width="2" stroke-linecap="round"/></svg></div>' +
    '<p class="login-ayuda">¿No tiene usuario? Pídalo al líder de Mantenimiento e Infraestructura, Sistemas o Equipos Biomédicos.</p>' +
    '</div>');
  const verPin = $('.ver-pin');
  verPin.addEventListener('click', () => {
    const campo = $('#form-login').pin;
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    verPin.innerHTML = mostrar ? SVG_OJO : SVG_OJO_NO;
    verPin.setAttribute('aria-label', mostrar ? 'Ocultar PIN' : 'Mostrar PIN');
  });
  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    await conBoton($('button[type=submit]', f), 'Entrando…', async () => {
      try {
        const r = await api('login', { usuario: f.usuario.value, pin: f.pin.value });
        E.token = r.token; E.usuario = r.usuario; E.config = r.config;
        guardar('token', E.token); guardar('usuario', E.usuario); guardar('config', E.config);
        if (estadoPush() === 'activo' || (window.Notification && Notification.permission === 'granted')) activarPush(true);
        const destino = leer('despuesLogin'); borrar('despuesLogin');
        location.hash = destino || '#/';
      } catch (e) { mostrarError(e.message); }
    });
  });
}

function cerrarSesionLocal() {
  E.token = null; E.usuario = null; E.noLeidas = 0;
  borrar('token'); borrar('usuario');
  actualizarContador();
  location.hash = '#/login';
}

async function cerrarSesion() {
  const tokenPush = leer('tokenPush');
  try { await api('cerrarSesion', { tokenPush }); } catch (e) { /* igual se cierra */ }
  borrar('tokenPush');
  cerrarSesionLocal();
}

// -------------------------------- inicio --------------------------------
/** Nombre completo de la persona; vacío si en "Nombre" quedó un cargo (ej. "Líder de Sistemas"). */
function nombreSaludo(u) {
  if (!u || u.rol === 'Área') return '';
  const n = String(u.nombre || '').trim();
  if (!n || /^(l[ií]der|t[eé]cnico|auxiliar|admin|coordinador|jefe)\b/i.test(n)) return '';
  return n.replace(/\s+/g, ' ');
}

function heroInicio(u, c) {
  const nombre = nombreSaludo(u);
  let cargo;
  if (u.rol === 'Área') cargo = 'Cuenta de ' + u.nombre;
  else if (esAdmin()) cargo = 'Administración · ' + (CFG.NOMBRE_CLINICA || 'Clínica');
  else cargo = u.rol + ' de ' + u.modulo;
  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  let cifras = [];
  if (esLider()) cifras = [[c.pendientes, 'Por asignar'], [c.enCurso, 'En curso'], [c.porConfirmar, 'Por confirmar']];
  else if (esPersonal() && !esAdmin()) cifras = [[c.activas, 'Por hacer'], [c.abiertos, 'Mis reportes en trámite']];
  else cifras = [[c.abiertos, 'Reportes en trámite']];
  return '<section class="hero">' +
    '<svg class="hero-cruz" viewBox="0 0 100 100" aria-hidden="true"><path d="M36 6h28v30h30v28H64v30H36V64H6V36h30z" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="3"/></svg>' +
    '<div class="hero-interior">' +
    '<div class="hero-fecha">' + esc(hoy.charAt(0).toUpperCase() + hoy.slice(1)) + '</div>' +
    '<h2 class="' + (nombre.length > 22 ? 'nombre-largo' : '') + '">Hola' + (nombre ? ', ' + esc(nombre) : '') + '</h2>' +
    '<div class="hero-cargo">' + esc(cargo) + '</div>' +
    '<div class="hero-cifras">' + cifras.map(([n, t]) => '<div class="hero-cifra"><strong>' + (n || 0) + '</strong><span>' + esc(t) + '</span></div>').join('') + '</div>' +
    '</div></section>';
}

async function vistaInicio() {
  ponerBarra(CFG.NOMBRE_APP || 'Solicitudes', false);
  document.body.classList.add('en-inicio');
  if (!E.usuario) cargando();
  await refrescarResumen();
  const u = E.usuario;
  if (!u) throw new Error('No se pudo cargar su información. Revise la conexión.');
  const c = E.contadores || {};
  let html = '';
  html = heroInicio(u, c);
  html += avisoPush();
  html += '<div class="opciones">';
  html += '<a class="opcion" href="#/reportar"><div class="opcion-icono i-reportar">' + ICONO_REPORTAR + '</div>' +
    '<div><div class="opcion-titulo">Reportar actividades</div><div class="opcion-texto">Reporta un daño o una necesidad a Mantenimiento e infraestructura, Sistemas o Equipos Biomédicos y sigue su estado.</div>' +
    '</div>' + FLECHA + '</a>';
  if (esPersonal() && !esAdmin()) {
    let detalle = '';
    if (esLider()) detalle = (c.pendientes || 0) + ' por asignar · ' + (c.enCurso || 0) + ' en curso · ' + (c.porConfirmar || 0) + ' por confirmar';
    else detalle = (c.activas || 0) + ' actividades por hacer';
    html += '<a class="opcion" href="#/administrar"><div class="opcion-icono i-administrar">' + ICONO_ADMIN + '</div>' +
      '<div><div class="opcion-titulo">Administrar actividades</div><div class="opcion-texto">' +
      esc(esLider() ? 'Asigna y sigue las actividades de ' + (esAdmin() ? 'los tres módulos' : u.modulo) + '.' : 'Tus actividades asignadas: inícialas y termínalas con evidencia.') +
      '</div></div>' + FLECHA + '</a>';
  }
  if (esAdmin()) {
    html += '<a class="opcion" href="#/dashboard"><div class="opcion-icono i-dashboard">' + ICONO_DASHBOARD + '</div>' +
      '<div><div class="opcion-titulo">Historial</div><div class="opcion-texto">Efectividad de cada módulo y reportes por área, servicio y persona.</div></div>' + FLECHA + '</a>';
  }
  html += '</div>';
  pintar(html);
  conectarAvisoPush();
}

const FLECHA = '<svg class="opcion-flecha" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_DASHBOARD = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const ICONO_REPORTAR = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M9 4h6l1 2h3v14H5V6h3l1-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v6M9 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICONO_ADMIN = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

// ------------------------------ reportar ------------------------------
function pestanasReportar(activa) {
  return pestanas([
    { id: 'nuevo', texto: 'Nuevo reporte', href: '#/reportar' },
    { id: 'mios', texto: 'Mis reportes', href: '#/mis-reportes' }
  ], activa);
}

async function vistaReportar() {
  ponerBarra('Reportar actividades', true);
  if (!E.config || !E.config.torres) await refrescarResumen();
  const cfg = E.config;
  const opcionesAreas = (esLider() || esAdmin()) ?
    '<fieldset class="caja-lider"><legend>Reportar a nombre de un área (opcional)</legend>' +
    '<label>Área<select name="cuentaArea"><option value="">— No, lo reporto yo —</option>' +
    cfg.areas.map((a) => '<option value="' + esc(a.usuario) + '">' + esc(a.nombre) + '</option>').join('') + '</select></label>' +
    '</fieldset>' : '';
  pintar(pestanasReportar('nuevo') +
    '<form id="form-reporte" class="formulario" novalidate>' +
    opcionesAreas +
    '<div class="campo"><span class="etiqueta">¿A quién va dirigido?</span><div class="modulos">' +
    cfg.modulos.map((m, i) => '<label class="modulo-op"><input type="radio" name="modulo" value="' + esc(m) + '"' + (i === 0 ? '' : '') + ' required><span>' + esc(m) + '</span></label>').join('') +
    '</div></div>' +
    '<label>Tipo de solicitud<select name="tipo" required disabled><option value="">Primero elija a quién va dirigido</option></select></label>' +
    '<div class="campo"><span class="etiqueta">Ubicación del servicio</span><div class="modulos torres">' +
    cfg.torres.map((t) => '<label class="modulo-op"><input type="radio" name="torre" value="' + esc(t) + '" required><span>' + esc(t) + '</span></label>').join('') +
    '</div></div>' +
    '<label id="campo-servicio" hidden><span id="etiqueta-servicio">Servicio</span><select name="servicio" required></select></label>' +
    '<div class="fila2"><label>Piso<select name="piso" required><option value="">Elija</option>' +
    cfg.pisos.map((p) => '<option>' + esc(p) + '</option>').join('') + '</select></label>' +
    '<label>Ubicación exacta<input name="ubicacion" required maxlength="120" placeholder="Ej: Habitación 304"></label></div>' +
    '<label>Descripción<textarea name="descripcion" rows="4" required maxlength="1500" placeholder="¿Qué pasa? Sea lo más claro posible."></textarea></label>' +
    '<div class="campo"><span class="etiqueta">Prioridad</span><div class="prioridades">' +
    cfg.prioridades.map((p) => '<label class="prio-op ' + (CLASE_PRIORIDAD[p] || '') + '"><input type="radio" name="prioridad" value="' + esc(p) + '"' + (p === 'Media' || p === 'Normal' ? ' checked' : '') + '><span>' + esc(p === 'Urgente' ? 'Urgente (afecta pacientes)' : p) + '</span></label>').join('') +
    '</div></div>' +
    '<label>Nombre de quien reporta<input name="reportadoPor" required maxlength="80" value="' + esc(leer('ultimoNombre') || '') + '" placeholder="Su nombre"></label>' +
    campoFoto('foto', 'Foto (opcional)') +
    '<button class="btn btn-pri btn-ancho" type="submit">Enviar reporte</button>' +
    '</form>');

  const f = $('#form-reporte');
  $$('input[name=modulo]', f).forEach((r) => r.addEventListener('change', () => {
    const tipos = cfg.tipos[r.value] || [];
    f.tipo.disabled = false;
    f.tipo.innerHTML = '<option value="">Elija el tipo</option>' + tipos.map((t) => '<option>' + esc(t) + '</option>').join('');
  }));
  $$('input[name=torre]', f).forEach((r) => r.addEventListener('change', () => {
    const servicios = (cfg.servicios || {})[r.value] || [];
    $('#campo-servicio').hidden = false;
    $('#etiqueta-servicio').textContent = 'Servicio ' + r.value.split(',')[0];
    f.servicio.innerHTML = '<option value="">Elija el servicio</option>' + servicios.map((x) => '<option>' + esc(x) + '</option>').join('');
    f.ubicacion.placeholder = 'Ej: Habitación 304';
  }));
  f.servicio.addEventListener('change', () => {
    f.ubicacion.placeholder = /no está en la lista/i.test(f.servicio.value) ? 'Escriba el servicio y el lugar exacto' : 'Ej: Habitación 304';
  });
  conectarFoto(f, 'foto');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const torreSel = $('input[name=torre]:checked', f);
    const datos = {
      modulo: (f.modulo.value || ''), tipo: f.tipo.value, torre: torreSel ? torreSel.value : '', servicio: f.servicio.value,
      piso: f.piso.value, ubicacion: f.ubicacion.value,
      descripcion: f.descripcion.value, prioridad: f.prioridad.value, reportadoPor: f.reportadoPor.value
    };
    const faltan = [];
    if (!datos.modulo) faltan.push('a quién va dirigido');
    if (!datos.tipo) faltan.push('el tipo');
    if (!datos.torre) faltan.push('la ubicación del servicio');
    else if (!datos.servicio) faltan.push('el servicio');
    if (!datos.piso) faltan.push('el piso');
    if (!datos.ubicacion.trim()) faltan.push('la ubicación');
    if (!datos.descripcion.trim()) faltan.push('la descripción');
    if (!datos.reportadoPor.trim()) faltan.push('su nombre');
    if (faltan.length) { mostrarError('Falta: ' + faltan.join(', ')); return; }
    if (f.cuentaArea && f.cuentaArea.value) { datos.cuentaArea = f.cuentaArea.value; datos.origen = 'App'; }
    await conBoton($('button[type=submit]', f), 'Enviando…', async () => {
      try {
        datos.foto = await fotoDe(f, 'foto');
        const r = await api('crearSolicitud', datos);
        guardar('ultimoNombre', datos.reportadoPor.trim());
        toast('Reporte ' + r.id + ' enviado. El líder de ' + datos.modulo + ' ya fue notificado.');
        location.hash = datos.cuentaArea ? (esAdmin() ? '#/' : '#/administrar') : '#/mis-reportes';
      } catch (e) { mostrarError(e.message); }
    });
  });
}

async function vistaMisReportes() {
  ponerBarra('Reportar actividades', true);
  cargando();
  const lista = await api('misReportes');
  const abiertos = lista.filter((s) => ESTADOS_ABIERTOS.indexOf(s.estado) >= 0);
  const cerrados = lista.filter((s) => ESTADOS_ABIERTOS.indexOf(s.estado) < 0);
  let html = pestanasReportar('mios');
  if (!lista.length) html += vacio('Todavía no hay reportes de esta cuenta.');
  if (abiertos.length) html += '<h3 class="subtitulo">En trámite</h3>' + abiertos.map((s) => tarjeta(s, { mostrarArea: false })).join('');
  if (cerrados.length) html += '<h3 class="subtitulo">Cerrados</h3>' + cerrados.slice(0, 40).map((s) => tarjeta(s, { mostrarArea: false })).join('');
  pintar(html);
}

// ----------------------------- administrar -----------------------------
async function vistaAdministrar(pestana) {
  if (!esPersonal() || esAdmin()) { location.replace('#/'); return; }
  ponerBarra('Administrar actividades', true);
  cargando();
  const u = E.usuario;
  if (!esLider()) {
    const lista = await api('misActividades');
    const activas = lista.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso').sort(porPrioridad);
    const otras = lista.filter((s) => !(s.estado === 'Asignada' || s.estado === 'En proceso'));
    const p = pestana === 'terminadas' ? 'terminadas' : 'activas';
    pintar(pestanas([
      { id: 'activas', texto: 'Por hacer', href: '#/administrar/activas', n: activas.length },
      { id: 'terminadas', texto: 'Terminadas', href: '#/administrar/terminadas' }
    ], p) + (p === 'activas' ? (activas.map((s) => tarjeta(s)).join('') || vacio('No tiene actividades pendientes.')) :
      (otras.map((s) => tarjeta(s)).join('') || vacio('Aún no ha terminado actividades.'))));
    return;
  }
  const esCoord = esAdmin();
  const [lista, mias] = await Promise.all([
    api('panelModulo', { modulo: E.filtroModulo }),
    u.rol === 'Líder' ? api('misActividades') : Promise.resolve([])
  ]);
  const grupos = {
    'por-asignar': lista.filter((s) => s.estado === 'Pendiente' || s.estado === 'Reabierta').sort(porPrioridad),
    'en-curso': lista.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso'),
    'por-confirmar': lista.filter((s) => s.estado === 'Por confirmar'),
    'historial': lista.filter((s) => s.estado === 'Cerrada' || s.estado === 'Cancelada'),
    'mias': mias.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso')
  };
  const p = grupos[pestana] ? pestana : 'por-asignar';
  const tabs = [
    { id: 'por-asignar', texto: 'Por asignar', href: '#/administrar/por-asignar', n: grupos['por-asignar'].length },
    { id: 'en-curso', texto: 'En curso', href: '#/administrar/en-curso', n: grupos['en-curso'].length },
    { id: 'por-confirmar', texto: 'Por confirmar', href: '#/administrar/por-confirmar', n: grupos['por-confirmar'].length },
    { id: 'historial', texto: 'Historial', href: '#/administrar/historial' }
  ];
  if (grupos.mias.length || p === 'mias') tabs.push({ id: 'mias', texto: 'Mías', href: '#/administrar/mias', n: grupos.mias.length });
  let html = '';
  if (esCoord) {
    html += '<div class="filtro-modulos">' + ['Todos'].concat(E.config.modulos).map((m) =>
      '<button type="button" class="filtro ' + (m === E.filtroModulo ? 'activo' : '') + '" data-modulo="' + esc(m) + '">' + esc(m) + '</button>').join('') + '</div>';
  } else {
    html += '<p class="modulo-actual">Módulo: <strong>' + esc(u.modulo) + '</strong></p>';
  }
  html += pestanas(tabs, p);
  const textosVacios = {
    'por-asignar': 'No hay solicitudes por asignar.', 'en-curso': 'No hay actividades en curso.',
    'por-confirmar': 'No hay actividades terminadas esperando su confirmación.', 'historial': 'El historial está vacío.',
    'mias': 'No tiene actividades asignadas.'
  };
  html += grupos[p].map((s) => tarjeta(s)).join('') || vacio(textosVacios[p]);
  pintar(html);
  $$('.filtro').forEach((b) => b.addEventListener('click', () => { E.filtroModulo = b.dataset.modulo; vistaAdministrar(p); }));
}

function porPrioridad(a, b) {
  const d = (ORDEN_PRIORIDAD[a.prioridad] || 9) - (ORDEN_PRIORIDAD[b.prioridad] || 9);
  return d !== 0 ? d : new Date(a.fecha) - new Date(b.fecha);
}

// ------------------------------- detalle -------------------------------
async function vistaDetalle(id) {
  ponerBarra('Solicitud ' + id, true);
  cargando();
  const s = await api('detalle', { id });
  const a = s.acciones || [];
  let html = '<article class="detalle">' +
    '<div class="detalle-cabeza"><span class="tarjeta-id">' + esc(s.id) + '</span>' + chipPrioridad(s.prioridad) + chipEstado(s.estado) + '</div>' +
    '<h2>' + esc(s.tipo) + '</h2><p class="suave">' + esc(s.modulo) + '</p>' +
    '<dl class="datos">' +
    dato('Área', s.area) + dato('Reportado por', s.reportadoPor) +
    (s.torre ? dato('Torre', s.torre) : '') + (s.servicio ? dato('Servicio', s.servicio) : '') +
    dato('Ubicación', 'Piso ' + s.piso + ' · ' + s.ubicacion) +
    dato('Fecha', fechaCorta(s.fecha)) + 
    (s.tecnicoNombre ? dato('Atiende', s.tecnicoNombre) : '') + '</dl>' +
    '<h3 class="subtitulo">Descripción</h3><p class="texto-largo">' + esc(s.descripcion) + '</p>' +
    (s.foto ? '<a href="' + esc(s.foto) + '" target="_blank" rel="noopener"><img class="foto" src="' + esc(s.foto) + '" alt="Foto del reporte" loading="lazy" referrerpolicy="no-referrer"></a>' : '');
  if (s.trabajo) {
    html += '<h3 class="subtitulo">Trabajo realizado</h3><p class="texto-largo">' + esc(s.trabajo) + '</p>' +
      (s.fotoEvidencia ? '<a href="' + esc(s.fotoEvidencia) + '" target="_blank" rel="noopener"><img class="foto" src="' + esc(s.fotoEvidencia) + '" alt="Foto de evidencia" loading="lazy" referrerpolicy="no-referrer"></a>' : '');
  }
  if (s.comentario) html += '<h3 class="subtitulo">' + (s.estado === 'Cerrada' ? 'Comentario del líder' : 'Lo que pidió corregir el líder') + '</h3><p class="texto-largo">' + esc(s.comentario) + '</p>';
  html += '</article>';
  html += panelAcciones(s, a);
  html += '<h3 class="subtitulo">Historial</h3><ol class="historial">' +
    (s.historial || []).slice().reverse().map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol>';
  pintar(html);
  conectarAcciones(s, a);
}

function dato(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }

function panelAcciones(s, a) {
  if (!a.length) return '';
  let h = '<section class="acciones">';
  if (a.indexOf('confirmar') >= 0) {
    h += '<div class="accion-bloque destacado"><h3>¿Quedó bien el trabajo?</h3><p class="suave">' + esc(s.tecnicoNombre || 'El técnico') + ' marcó esta actividad como terminada. Revise el trabajo y la foto: confírmela para cerrarla o devuélvala si falta algo.</p>' +
      '<div class="botones-2"><button class="btn btn-ok" id="ac-conforme">Sí, cerrar</button>' +
      '<button class="btn btn-peligro" id="ac-reabrir">No, devolver</button></div></div>';
  }
  if (a.indexOf('iniciar') >= 0) h += '<button class="btn btn-pri btn-ancho" id="ac-iniciar">Iniciar trabajo</button>';
  if (a.indexOf('terminar') >= 0) {
    h += '<form class="accion-bloque" id="form-terminar" novalidate><h3>Terminar actividad</h3>' +
      '<label>Trabajo realizado<textarea name="trabajo" rows="3" required maxlength="1500" placeholder="Describa lo que hizo"></textarea></label>' +
      campoFoto('evidencia', 'Foto de evidencia (recomendada)') +
      '<button class="btn btn-ok btn-ancho" type="submit">Marcar como terminada</button></form>';
  }
  if (a.indexOf('asignar') >= 0) {
    h += '<div class="accion-bloque"><h3>' + (s.tecnico ? 'Reasignar' : 'Asignar técnico') + '</h3>' +
      '<label>Personal de ' + esc(s.modulo) + '<select id="ac-tecnico"><option value="">Cargando…</option></select></label>' +
      '<button class="btn btn-pri btn-ancho" id="ac-asignar">' + (s.tecnico ? 'Reasignar' : 'Asignar') + '</button></div>';
  }
  if (a.indexOf('cambiarModulo') >= 0) {
    h += '<div class="accion-bloque"><h3>¿No le corresponde a ' + esc(s.modulo) + '?</h3>' +
      '<label>Remitir a<select id="ac-modulo">' + E.config.modulos.filter((m) => m !== s.modulo).map((m) => '<option>' + esc(m) + '</option>').join('') + '</select></label>' +
      '<button class="btn btn-sec btn-ancho" id="ac-remitir">Remitir</button></div>';
  }
  if (a.indexOf('cancelar') >= 0) h += '<button class="btn btn-texto-peligro btn-ancho" id="ac-cancelar">Cancelar solicitud</button>';
  return h + '</section>';
}

function conectarAcciones(s, a) {
  const hecho = (msg) => { toast(msg); refrescarResumen(); vistaDetalle(s.id); };
  const ejecutar = (boton, ocupado, accion, datos, msg) => conBoton(boton, ocupado, async () => {
    try { await api(accion, Object.assign({ id: s.id }, datos || {})); hecho(msg); } catch (e) { mostrarError(e.message); }
  });
  const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', () => fn(el)); };

  on('#ac-conforme', async (b) => {
    const c = await pedirTexto({ titulo: 'Confirmar y cerrar', mensaje: 'El área recibirá el aviso de que su solicitud quedó realizada. Puede dejar un comentario (opcional).', boton: 'Confirmar y cerrar' });
    if (c !== null) ejecutar(b, 'Cerrando…', 'confirmar', { conforme: true, comentario: c }, 'Solicitud cerrada. El área fue notificada.');
  });
  on('#ac-reabrir', async (b) => {
    const c = await pedirTexto({ titulo: '¿Qué falta por hacer?', mensaje: 'La actividad vuelve al técnico con su comentario.', boton: 'Devolver al técnico', requerido: true, peligro: true, placeholder: 'Ej: el aire sigue goteando' });
    if (c) ejecutar(b, 'Devolviendo…', 'confirmar', { conforme: false, comentario: c }, 'Actividad devuelta. El técnico fue notificado.');
  });
  on('#ac-iniciar', (b) => ejecutar(b, 'Iniciando…', 'iniciar', {}, 'Trabajo iniciado'));
  on('#ac-remitir', async (b) => {
    const m = $('#ac-modulo').value;
    if (await confirmar({ titulo: 'Remitir a ' + m, mensaje: 'El líder de ' + m + ' recibirá la solicitud.', boton: 'Remitir' })) {
      ejecutar(b, 'Remitiendo…', 'cambiarModulo', { modulo: m }, 'Solicitud remitida a ' + m);
    }
  });
  on('#ac-cancelar', async (b) => {
    const motivo = await pedirTexto({ titulo: 'Cancelar solicitud', mensaje: 'El área recibirá el motivo.', boton: 'Cancelar solicitud', requerido: true, peligro: true });
    if (motivo) ejecutar(b, 'Cancelando…', 'cancelar', { motivo }, 'Solicitud cancelada');
  });

  if (a.indexOf('asignar') >= 0) {
    api('tecnicos', { modulo: s.modulo }).then((lista) => {
      const sel = $('#ac-tecnico');
      if (!sel) return;
      sel.innerHTML = '<option value="">Elija una persona</option>' + lista.map((t) =>
        '<option value="' + esc(t.usuario) + '"' + (t.usuario === s.tecnico ? ' selected' : '') + '>' + esc(t.nombre) + (t.rol === 'Líder' ? ' (líder)' : '') + '</option>').join('');
    }).catch((e) => mostrarError(e.message));
    on('#ac-asignar', (b) => {
      const t = $('#ac-tecnico').value;
      if (!t) { mostrarError('Elija a quién asignar'); return; }
      ejecutar(b, 'Asignando…', 'asignar', { tecnico: t }, 'Asignada. El técnico fue notificado.');
    });
  }

  const ft = $('#form-terminar');
  if (ft) {
    conectarFoto(ft, 'evidencia');
    ft.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!ft.trabajo.value.trim()) { mostrarError('Describa el trabajo realizado'); return; }
      await conBoton($('button[type=submit]', ft), 'Enviando…', async () => {
        try {
          const foto = await fotoDe(ft, 'evidencia');
          await api('terminar', { id: s.id, trabajo: ft.trabajo.value, foto });
          hecho('Actividad terminada. El líder fue notificado para confirmarla.');
        } catch (e) { mostrarError(e.message); }
      });
    });
  }
}

// ------------------------------- fotos -------------------------------
function campoFoto(nombre, etiqueta) {
  return '<div class="campo"><span class="etiqueta">' + esc(etiqueta) + '</span>' +
    '<label class="foto-btn"><input type="file" name="' + nombre + '" accept="image/*" capture="environment" hidden>' +
    '<span>Tomar o elegir foto</span></label><div class="foto-previa" data-previa="' + nombre + '"></div></div>';
}
function conectarFoto(form, nombre) {
  const input = form.querySelector('input[name=' + nombre + ']');
  const previa = form.querySelector('[data-previa=' + nombre + ']');
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) { previa.innerHTML = ''; return; }
    const url = URL.createObjectURL(f);
    previa.innerHTML = '<img src="' + url + '" alt="Vista previa"><button type="button" class="btn-quitar">Quitar foto</button>';
    previa.querySelector('button').addEventListener('click', () => { input.value = ''; previa.innerHTML = ''; });
  });
}
async function fotoDe(form, nombre) {
  const input = form.querySelector('input[name=' + nombre + ']');
  const f = input && input.files && input.files[0];
  return f ? comprimirImagen(f) : '';
}
/** Reduce la foto a máximo 1280 px y calidad 70% para que suba rápido. */
function comprimirImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolver(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

// ------------------------------ dashboard ------------------------------
const PERIODOS = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['todo', 'Todo']];

function duracion(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return Math.round(h * 60) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h';
  return Math.round(h / 24) + ' días';
}
function porc(n) { return (n === null || n === undefined) ? '—' : String(n).replace('.', ',') + '%'; }

/** Barras horizontales: una fila por elemento, ancho proporcional al mayor. */
function barras(lista, opciones) {
  const o = opciones || {};
  if (!lista.length) return vacio(o.vacio || 'Sin datos en este periodo.');
  const max = Math.max(1, ...lista.map((x) => x.total));
  return '<div class="barras">' + lista.map((x) =>
    '<div class="barra-fila" title="' + esc(x.nombre + ': ' + x.total + ' reportes (' + porc(x.pct) + ')') + '">' +
    '<div class="barra-nombre">' + esc(x.nombre) + (o.conArea && x.area ? '<span class="barra-sub">' + esc(x.area) + '</span>' : '') + '</div>' +
    '<div class="barra-pista"><div class="barra-relleno" style="width:' + (x.total ? Math.max(2, x.total * 100 / max) : 0) + '%"></div></div>' +
    '<div class="barra-valor">' + x.total + ' <span>' + porc(x.pct) + '</span></div></div>').join('') + '</div>';
}

function columnas(serie, periodo) {
  if (!serie.length) return vacio('Sin reportes en este periodo.');
  const max = Math.max(1, ...serie.map((x) => x.total));
  const etiqueta = (e) => periodo === 'hoy' ? e.slice(0, 2) : periodo === 'todo' ? e.slice(5) + '/' + e.slice(2, 4) : e.slice(8);
  const cada = serie.length > 16 ? Math.ceil(serie.length / 8) : 1;
  return '<div class="columnas">' + serie.map((x, i) =>
    '<div class="col" title="' + esc(x.etiqueta + ': ' + x.total + ' reportes') + '">' +
    '<div class="col-valor">' + (x.total ? x.total : '') + '</div>' +
    '<div class="col-barra" style="height:' + (x.total ? Math.max(3, x.total * 100 / max) : 0) + '%"></div>' +
    '<div class="col-etq">' + (i % cada === 0 ? esc(etiqueta(x.etiqueta)) : '') + '</div></div>').join('') + '</div>';
}

async function vistaDashboard(periodo) {
  if (!esAdmin()) { location.replace('#/'); return; }
  const p = PERIODOS.some((x) => x[0] === periodo) ? periodo : 'mes';
  ponerBarra('Historial', true);
  cargando();
  const d = await api('dashboard', { periodo: p });
  const g = d.general;
  const unidad = p === 'hoy' ? 'por hora' : p === 'todo' ? 'por mes' : 'por día';
  const conReportes = d.areas.filter((a) => a.total > 0);
  const menos = d.areas.slice().sort((a, b) => a.total - b.total || a.nombre.localeCompare(b.nombre)).slice(0, 5);
  const personasMenos = d.personas.slice().sort((a, b) => a.total - b.total || a.nombre.localeCompare(b.nombre)).slice(0, 5);
  let html = '<nav class="pestanas">' + PERIODOS.map(([id, t]) =>
    '<a href="#/dashboard/' + id + '" class="' + (id === p ? 'activa' : '') + '">' + t + '</a>').join('') + '</nav>';
  html += '<p class="suave pequeno rango">' + (d.desde ? 'Reportes del ' + esc(fechaDia(d.desde)) + ' al ' + esc(fechaDia(d.hasta)) : 'Todos los reportes registrados') + '</p>';

  html += '<section class="kpis">' +
    kpi('Reportes', d.total, '') +
    kpi('Efectividad', porc(g.efectividad), 'cerradas de las no canceladas') +
    kpi('En trámite', g.enTramite, g.porConfirmar ? g.porConfirmar + ' por confirmar' : '') +
    kpi('Tiempo de cierre', duracion(g.horasPromedio), 'promedio') + '</section>';

  html += '<h3 class="subtitulo">Efectividad por módulo</h3><div class="modulos-dash">' + d.modulos.map((m) =>
    '<div class="tarjeta-dash"><div class="dash-modulo">' + esc(m.modulo) + '</div>' +
    '<div class="dash-grande">' + porc(m.efectividad) + '</div>' +
    '<div class="progreso" title="' + esc(m.cerradas + ' cerradas de ' + (m.total - m.canceladas)) + '"><div style="width:' + (m.efectividad || 0) + '%"></div></div>' +
    '<div class="dash-detalle">' + m.cerradas + ' cerradas de ' + (m.total - m.canceladas) + ' · ' + m.enTramite + ' en trámite<br>' +
    'Cierre promedio: ' + duracion(m.horasPromedio) + (m.devueltas ? ' · ' + m.devueltas + ' devueltas al técnico' : '') +
    (m.canceladas ? ' · ' + m.canceladas + ' canceladas' : '') + '</div></div>').join('') + '</div>';

  html += '<h3 class="subtitulo">Reportes ' + unidad + '</h3><div class="tarjeta-dash">' + columnas(d.serie, p) + '</div>';

  html += '<h3 class="subtitulo">Porcentaje de reportes por área</h3><div class="tarjeta-dash">' +
    barras(conReportes.slice(0, 10), { vacio: 'Ningún área ha reportado en este periodo.' }) +
    (conReportes.length > 10 ? '<details><summary>Ver todas las áreas (' + conReportes.length + ')</summary>' + barras(conReportes.slice(10)) + '</details>' : '') + '</div>';

  html += '<div class="dos-col">' +
    '<div><h3 class="subtitulo">Áreas que más reportan</h3><div class="tarjeta-dash">' + ranking(conReportes.slice(0, 5)) + '</div></div>' +
    '<div><h3 class="subtitulo">Áreas que menos reportan</h3><div class="tarjeta-dash">' + ranking(menos) + '</div></div></div>';

  html += '<div class="dos-col">' +
    '<div><h3 class="subtitulo">Personas que más reportan</h3><div class="tarjeta-dash">' + ranking(d.personas.slice(0, 5), true) + '</div></div>' +
    '<div><h3 class="subtitulo">Personas que menos reportan</h3><div class="tarjeta-dash">' + ranking(personasMenos, true) + '</div></div></div>' +
    '<p class="suave pequeno">Se cuentan por el nombre que escriben al reportar. Quien no ha reportado nada en el periodo no aparece.</p>';

  html += '<h3 class="subtitulo">Servicios con más reportes</h3><div class="tarjeta-dash">' + barras(d.servicios.slice(0, 10), { vacio: 'Sin servicios registrados en este periodo.' }) + '</div>';

  html += '<h3 class="subtitulo">Reportes por prioridad</h3><div class="prioridades-dash">' + d.prioridades.map((x) =>
    '<div class="prio-dash"><span class="chip ' + (CLASE_PRIORIDAD[x.nombre] || '') + '">' + esc(x.nombre) + '</span>' +
    '<strong>' + x.total + '</strong><span class="suave">' + porc(x.pct) + '</span></div>').join('') + '</div>';

  html += '<p class="suave pequeno">Efectividad = solicitudes cerradas por el líder ÷ solicitudes del periodo que no fueron canceladas. ' +
    'Tiempo de cierre = desde que se reporta hasta que el líder la cierra.</p>';
  pintar(html);
}

function kpi(titulo, valor, nota) {
  return '<div class="kpi"><div class="kpi-titulo">' + esc(titulo) + '</div><div class="kpi-valor">' + esc(valor) + '</div>' +
    (nota ? '<div class="kpi-nota">' + esc(nota) + '</div>' : '') + '</div>';
}
function ranking(lista, conArea) {
  if (!lista.length) return vacio('Sin datos en este periodo.');
  return '<ol class="ranking">' + lista.map((x) => '<li><span class="rk-nombre">' + esc(x.nombre) +
    (conArea && x.area ? '<span class="barra-sub">' + esc(x.area) + '</span>' : '') + '</span>' +
    '<span class="rk-valor">' + x.total + ' <span>' + porc(x.pct) + '</span></span></li>').join('') + '</ol>';
}
function fechaDia(k) {
  const d = new Date(k + 'T12:00:00');
  return isNaN(d) ? k : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------- notificaciones ----------------------------
async function vistaNotificaciones() {
  ponerBarra('Notificaciones', true);
  cargando();
  const r = await api('notificaciones');
  E.noLeidas = r.noLeidas; actualizarContador();
  let html = '<div class="notif-cabeza"><span class="suave">' + (r.noLeidas ? r.noLeidas + ' sin leer' : 'Todo al día') + '</span>' +
    (r.noLeidas ? '<button class="btn-link" id="leer-todas">Marcar todas como leídas</button>' : '') + '</div>';
  html += r.lista.map((n) => '<a class="notif ' + (n.leida ? '' : 'no-leida') + '" href="' + (n.solicitud ? '#/solicitud/' + encodeURIComponent(n.solicitud) : '#/notificaciones') + '" data-id="' + esc(n.id) + '">' +
    '<div class="notif-titulo">' + esc(n.titulo) + '</div><div class="notif-texto">' + esc(n.mensaje) + '</div>' +
    '<div class="notif-fecha">' + esc(hace(n.fecha)) + '</div></a>').join('') || vacio('No tiene notificaciones.');
  html += avisoPush();
  pintar(html);
  conectarAvisoPush();
  $$('.notif.no-leida').forEach((el) => el.addEventListener('click', () => {
    api('marcarLeidas', { ids: [el.dataset.id] }).then(refrescarResumen).catch(() => {});
  }));
  const todas = $('#leer-todas');
  if (todas) todas.addEventListener('click', () => conBoton(todas, '…', async () => {
    await api('marcarLeidas', {}); E.noLeidas = 0; actualizarContador(); vistaNotificaciones();
  }));
}

// ------------------------------- push -------------------------------
let FB = null;
async function cargarFirebase() {
  if (FB) return FB;
  if (!CFG.FIREBASE || /PEGUE/.test(CFG.FIREBASE.apiKey || 'PEGUE')) throw new Error('Firebase aún no está configurado en config.js');
  const base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';
  const [appMod, msgMod] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-messaging.js')]);
  if (!(await msgMod.isSupported())) throw new Error('NO_SOPORTADO');
  const app = appMod.initializeApp(CFG.FIREBASE);
  const messaging = msgMod.getMessaging(app);
  // Mensajes que llegan con la app abierta: se muestran como aviso dentro de la app.
  msgMod.onMessage(messaging, (p) => {
    const n = p.notification || {};
    const id = p.data && p.data.solicitud;
    // Con la app abierta también se muestra el aviso del sistema (con sonido) y vibra.
    mostrarAvisoSistema(n.title || 'Notificación', n.body || '', id);
    toast((n.title || 'Notificación') + (n.body ? ': ' + n.body : ''), {
      duracion: 8000, accion: id ? () => { location.hash = '#/solicitud/' + encodeURIComponent(id); } : null
    });
    refrescarResumen();
  });
  FB = { messaging, getToken: msgMod.getToken };
  return FB;
}

async function mostrarAvisoSistema(titulo, cuerpo, id) {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    if (!window.Notification || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const base = location.href.split('#')[0];
    await reg.showNotification(titulo, {
      body: cuerpo, icon: base.replace(/[^/]*$/, '') + 'icon-192.png', tag: id || 'general', renotify: true,
      silent: false, vibrate: [300, 100, 300, 100, 300],
      data: { url: base + (id ? '#/solicitud/' + encodeURIComponent(id) : '#/') }
    });
  } catch (e) { /* si falla, queda el aviso dentro de la app */ }
}

function traducirErrorPush(m) {
  if (/push service error|Registration failed/i.test(m)) {
    return 'El navegador bloqueó las notificaciones. Si usa Brave, active "Usar servicios de Google para mensajería push" en brave://settings/privacy y reinicie. En Android use Google Chrome.';
  }
  return m;
}

function estadoPush() {
  if (esIOS() && !esInstalada()) return 'ios-instalar';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission === 'granted' && leer('tokenPush')) return 'activo';
  return 'inactivo';
}

async function activarPush(silencioso) {
  try {
    if (!silencioso) {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error(permiso === 'denied' ?
        'Bloqueó las notificaciones. Actívelas en los ajustes del navegador para esta página.' : 'No se concedió el permiso.');
    } else if (!window.Notification || Notification.permission !== 'granted') {
      return;
    }
    const fb = await cargarFirebase();
    const registro = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    const token = await fb.getToken(fb.messaging, { vapidKey: CFG.FIREBASE_VAPID_KEY, serviceWorkerRegistration: registro });
    if (!token) throw new Error('No se pudo obtener el permiso de notificaciones');
    await api('registrarDispositivo', { token });
    guardar('tokenPush', token);
    if (!silencioso) { toast('Notificaciones activadas en este dispositivo'); enrutar(); }
  } catch (e) {
    console.warn('Push:', e);
    if (!silencioso) mostrarError(e.message === 'NO_SOPORTADO' ? 'Este navegador no admite notificaciones. Use Chrome en Android o instale la app en iPhone.' : traducirErrorPush(e.message));
  }
}

function avisoPush() {
  if (!E.usuario) return '';
  const st = estadoPush();
  if (st === 'activo') return '';
  if (st === 'ios-instalar') {
    return '<div class="aviso"><strong>Instale la app para recibir notificaciones.</strong> En Safari toque ' +
      '<b>Compartir</b> (cuadro con flecha) y luego <b>Agregar a inicio</b>. Después abra la app desde el ícono e inicie sesión.</div>';
  }
  if (st === 'no-soportado') return '<div class="aviso">Este navegador no admite notificaciones. En Android use Google Chrome.</div>';
  if (st === 'bloqueado') return '<div class="aviso">Las notificaciones están bloqueadas para esta página. Actívelas en los ajustes del navegador (ícono del candado junto a la dirección).</div>';
  return '<div class="aviso aviso-accion"><div><strong>Active las notificaciones</strong><br><span class="suave">Para enterarse al instante de cada actividad.</span></div>' +
    '<button class="btn btn-pri" id="btn-activar-push">Activar</button></div>' +
    (E.instalador ? '<div class="aviso aviso-accion"><div><strong>Instale la app</strong><br><span class="suave">Queda con su ícono en la pantalla de inicio.</span></div><button class="btn btn-sec" id="btn-instalar">Instalar</button></div>' : '');
}
function conectarAvisoPush() {
  const b = $('#btn-activar-push');
  if (b) b.addEventListener('click', () => conBoton(b, 'Activando…', () => activarPush(false)));
  const i = $('#btn-instalar');
  if (i) i.addEventListener('click', async () => { E.instalador.prompt(); await E.instalador.userChoice; E.instalador = null; enrutar(); });
}

// ------------------------------- cuenta -------------------------------
function abrirCuenta() {
  const u = E.usuario;
  if (!u) return;
  const st = estadoPush();
  const textoPush = { activo: 'Activadas en este dispositivo', inactivo: 'Desactivadas', bloqueado: 'Bloqueadas en el navegador',
    'ios-instalar': 'Instale la app para activarlas', 'no-soportado': 'No disponibles en este navegador' }[st];
  const m = abrirModal('<h3>' + esc(u.nombre) + '</h3><p class="suave">Usuario: ' + esc(u.usuario) + ' · ' + esc(u.rol) +
    (u.modulo && u.rol !== 'Área' ? ' · ' + esc(u.modulo) : '') + '</p>' +
    '<p>Notificaciones: <strong>' + esc(textoPush) + '</strong></p>' +
    '<div class="modal-botones columna">' +
    (st === 'inactivo' || st === 'activo' ? '<button class="btn btn-sec" id="cuenta-push">' + (st === 'activo' ? 'Volver a registrar este dispositivo' : 'Activar notificaciones') + '</button>' : '') +
    '<button class="btn btn-peligro" id="cuenta-salir">Cerrar sesión</button>' +
    '<button class="btn btn-texto" id="cuenta-cerrar">Volver</button></div>');
  $('#cuenta-cerrar', m).addEventListener('click', cerrarModal);
  $('#cuenta-salir', m).addEventListener('click', () => { cerrarModal(); cerrarSesion(); });
  const p = $('#cuenta-push', m);
  if (p) p.addEventListener('click', () => { cerrarModal(); activarPush(false); });
}

// ------------------------------- arranque -------------------------------
function iniciar() {
  $('#btn-atras').addEventListener('click', () => {
    if (PILA.length > 1) history.back(); else location.hash = '#/';
  });
  $('#btn-campana').addEventListener('click', () => { location.hash = '#/notificaciones'; });
  $('#btn-menu').addEventListener('click', abrirCuenta);
  window.addEventListener('hashchange', enrutar);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); E.instalador = e; });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && E.token) {
      refrescarResumen();
      const h = location.hash;
      if (h === '#/' || h === '' || h.indexOf('#/administrar') === 0 || h === '#/mis-reportes') enrutar();
    }
  });
  setInterval(() => { if (document.visibilityState === 'visible' && E.token) refrescarResumen(); }, 60000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('firebase-messaging-sw.js').catch(() => {});
  }
  if (E.token) { refrescarResumen(); activarPush(true); }
  enrutar();
}

iniciar();
