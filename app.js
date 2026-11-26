/*
 * App de Solicitudes — Clínica San José de Cúcuta
 * Interfaz web instalable (PWA). Habla con el servidor de Apps Script
 * y recibe notificaciones push con Firebase Cloud Messaging.
 * No es necesario editar este archivo: la configuración va en config.js.
 */
import { ICO, ILU, iconoTipo } from './diseno.js';

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
  lista: { datos: [], q: '', pagina: 1 },
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

const CLASE_PRIO = { Urgente: 'prio-urgente', Alta: 'prio-alta', Media: 'prio-media', Normal: 'prio-media', Baja: 'prio-baja' };

/** Tarjeta de una solicitud (diseño de Administrar actividades). o.asignar: muestra el botón Asignar. */
function tarjeta(s, opciones) {
  const o = opciones || {};
  const prio = s.prioridad === 'Normal' ? 'Media' : s.prioridad;
  const icoPrio = prio === 'Baja' ? ICO.check : prio === 'Media' ? ICO.reloj : ICO.alerta;
  return '<article class="act ' + (CLASE_PRIO[s.prioridad] || '') + '" data-id="' + esc(s.id) + '">' +
    '<a class="act-icono" href="#/solicitud/' + encodeURIComponent(s.id) + '" aria-label="Ver ' + esc(s.id) + '">' + iconoTipo(s.tipo) + '</a>' +
    '<a class="act-info" href="#/solicitud/' + encodeURIComponent(s.id) + '">' +
    '<span class="act-id">' + esc(s.id) + '</span>' +
    '<h3>' + esc(s.tipo) + '</h3>' +
    '<span class="act-linea">' + ICO.edificio + esc(o.mostrarArea === false ? s.modulo : s.area + ' · ' + s.modulo) + '</span>' +
    '<span class="act-linea">' + ICO.pin + (s.servicio ? esc(s.servicio) + ' · ' : '') + 'Piso ' + esc(s.piso) + ' · ' + esc(s.ubicacion) + '</span>' +
    '<span class="act-linea">' + ICO.calendario + esc(hace(s.fecha)) + (s.tecnicoNombre ? ' · ' + esc(s.tecnicoNombre) : '') + '</span>' +
    '</a>' +
    '<div class="act-estado"><span class="badge-prio">' + icoPrio + esc(prio) + '</span>' +
    '<span class="badge-estado ' + (CLASE_ESTADO[s.estado] || '') + '">' + ICO.reloj + esc(s.estado) + '</span></div>' +
    '<div class="act-botones"><a class="btn btn-borde" href="#/solicitud/' + encodeURIComponent(s.id) + '">' + ICO.ojo + 'Ver detalles</a>' +
    (o.asignar ? '<button type="button" class="btn btn-pri btn-asignar" data-id="' + esc(s.id) + '">' + ICO.asignar + 'Asignar</button>' : '') +
    '</div></article>';
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

function cargoDe(u) {
  if (!u) return '';
  if (u.rol === 'Área') return 'Cuenta de ' + u.nombre;
  if (esAdmin()) return 'Administración';
  return u.rol + ' de ' + u.modulo;
}
function iniciales(u) {
  const n = nombreSaludo(u) || (u && u.nombre) || '';
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?';
}
/** Foto de perfil (o iniciales). editable: muestra el botón de cámara para cambiarla. */
function avatar(u, tam, editable) {
  const cont = '<span>' + esc(iniciales(u)) + '</span>' + (u && u.foto ? '<img src="' + esc(u.foto) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '');
  return '<div class="avatar avatar-' + tam + '">' + cont +
    (editable ? '<label class="avatar-camara" title="Cambiar foto de perfil"><input type="file" accept="image/*" class="input-avatar" hidden>' + ICO.camara + '</label>' : '') + '</div>';
}
function conectarAvatar() {
  $$('.input-avatar').forEach((inp) => inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const caja = inp.closest('.avatar');
    caja.classList.add('subiendo');
    try {
      const foto = await recortarCuadrado(f, 480);
      const r = await api('subirFotoPerfil', { foto });
      E.usuario.foto = r.foto; guardar('usuario', E.usuario);
      cerrarModal();
      toast('Foto de perfil actualizada');
      pintarLateral();
      if ((location.hash || '#/') === '#/' || location.hash === '') vistaInicio(); else caja.classList.remove('subiendo');
    } catch (e) { caja.classList.remove('subiendo'); mostrarError(e.message); }
  }));
}
/** Recorta la foto al centro en cuadrado y la reduce para que suba rápido. */
function recortarCuadrado(archivo, lado) {
  return new Promise((resolver, rechazar) => {
    const img = new Image(); const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const m = Math.min(img.width, img.height);
      const c = document.createElement('canvas'); c.width = lado; c.height = lado;
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url); resolver(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

function menuPorRol() {
  const u = E.usuario;
  const items = [['#/', 'Inicio', ICO.inicio]];
  if (u.rol === 'Área') items.push(['#/reportar', 'Reportar', ICO.reportar], ['#/mis-reportes', 'Mis reportes', ICO.lista]);
  else if (esAdmin()) items.push(['#/dashboard', 'Historial', ICO.historial], ['#/reportar', 'Reportar', ICO.reportar]);
  else items.push(['#/administrar', esLider() ? 'Actividades' : 'Mis actividades', ICO.actividades], ['#/reportar', 'Reportar', ICO.reportar]);
  items.push(['#/notificaciones', 'Notificaciones', ICO.campana]);
  return items;
}
/** Menú lateral azul (se ve en computador y tableta). */
function pintarLateral() {
  const l = $('#lateral');
  if (!E.token || !E.usuario || document.body.classList.contains('en-login')) {
    l.hidden = true; document.body.classList.remove('con-lateral'); return;
  }
  l.hidden = false; document.body.classList.add('con-lateral');
  const h = location.hash || '#/';
  const items = menuPorRol();
  const activo = (href) => href === '#/' ? (h === '#/' || h === '#') :
    (h.indexOf(href) === 0 || (href === '#/reportar' && h === '#/mis-reportes' && !items.some((x) => x[0] === '#/mis-reportes')));
  l.innerHTML = '<a class="lat-marca" href="#/"><img src="icon-192.png" alt=""><span>Clínica<br>San José</span></a>' +
    '<nav class="lat-nav">' + items.map(([href, t, ico]) => '<a href="' + href + '" class="' + (activo(href) ? 'activo' : '') + '">' + ico +
      '<span>' + t + '</span>' + (href === '#/notificaciones' && E.noLeidas ? '<b class="lat-cont">' + (E.noLeidas > 99 ? '99+' : E.noLeidas) + '</b>' : '') + '</a>').join('') + '</nav>' +
    '<div class="lat-pie"><button type="button" class="lat-usuario" id="lat-usuario">' + avatar(E.usuario, 's', false) +
    '<span class="lat-nombre">' + esc(nombreSaludo(E.usuario) || E.usuario.nombre) + '<small>' + esc(cargoDe(E.usuario)) + '</small></span>' + ICO.chevron + '</button>' +
    '<div class="credito">Creado por: David Vega y Jaider Landinez</div></div>';
  $('#lat-usuario').addEventListener('click', abrirCuenta);
}

function actualizarContador() {
  const c = $('#contador-notif');
  c.textContent = E.noLeidas > 99 ? '99+' : String(E.noLeidas);
  c.hidden = !E.noLeidas;
  const lc = $('#lateral .lat-cont');
  if (lc || E.noLeidas) pintarLateral();
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
  document.body.classList.remove('en-login', 'en-inicio', 'en-pagina');
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
  pintarLateral();
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
    '<p class="credito credito-login">Creado por: David Vega y Jaider Landinez</p>' +
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

function textoNotif() {
  const st = estadoPush();
  const t = {
    activo: ['Notificaciones activas', 'Recibes alertas en tiempo real cuando una actividad es asignada o cambia de estado.', 'Gestionar notificaciones'],
    inactivo: ['Activar notificaciones', 'Recibe alertas en tiempo real cuando una actividad sea asignada o se actualice su estado.', 'Activar notificaciones'],
    bloqueado: ['Notificaciones bloqueadas', 'Actívelas en los ajustes del navegador (ícono del candado junto a la dirección) y vuelva a intentar.', 'Gestionar notificaciones'],
    'ios-instalar': ['Instale la app para recibir alertas', 'En Safari toque Compartir y luego "Agregar a inicio". Abra la app desde el ícono e inicie sesión.', 'Ver cómo'],
    'no-soportado': ['Notificaciones no disponibles', 'Este navegador no admite notificaciones. En Android use Google Chrome.', 'Gestionar notificaciones']
  }[st];
  return { st, titulo: t[0], texto: t[1], boton: t[2] };
}

/** Encabezado del inicio con la foto de la clínica, el saludo y la foto de perfil. */
function heroInicio(u, c) {
  const nombre = nombreSaludo(u);
  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const oscuro = esAdmin();
  let desc, cifras = [];
  if (u.rol === 'Área') desc = 'Reporta daños o necesidades y da seguimiento a las solicitudes de tu área.';
  else if (oscuro) desc = 'Panel de gestión y seguimiento de solicitudes';
  else if (esLider()) desc = 'Asigna y da seguimiento a las actividades de ' + u.modulo + '.';
  else desc = 'Gestiona tus actividades y mantente informado sobre las solicitudes de la clínica.';
  if (esLider()) cifras = [[c.pendientes, 'Por asignar', ICO.actividades, '#/administrar/por-asignar'], [c.enCurso, 'En curso', ICO.reloj, '#/administrar/en-curso'], [c.porConfirmar, 'Por confirmar', ICO.confirmar, '#/administrar/por-confirmar']];
  else if (esPersonal() && !oscuro) cifras = [[c.activas, 'Por hacer', ICO.actividades, '#/administrar'], [c.abiertos, 'En trámite', ICO.reloj, '#/mis-reportes']];
  const cifrasHtml = cifras.map(([n, t, ico, href]) => '<a class="cifra" href="' + href + '"><span class="cifra-ico">' + ico + '</span>' +
    '<span class="cifra-txt"><strong>' + (n || 0) + '</strong>' + esc(t) + '</span><span class="cifra-ir">' + ICO.flecha + '</span></a>').join('');
  return '<section class="hero2 ' + (oscuro ? 'hero-oscuro' : 'hero-claro') + '">' +
    '<div class="hero2-foto"></div>' +
    '<div class="hero2-int">' +
    '<div class="hero2-texto">' +
    '<div class="hero2-fecha">' + esc(hoy.charAt(0).toUpperCase() + hoy.slice(1)) + '</div>' +
    '<div class="hero2-saludo">' + avatar(u, 'xl', true) +
    '<div><h1 class="' + (nombre.length > 24 ? 'largo' : '') + '">Hola' + (nombre ? ', ' + esc(nombre) : '') + '</h1>' +
    '<div class="hero2-cargo">' + esc(cargoDe(u)) + '</div></div></div>' +
    '<p class="hero2-desc">' + esc(desc) + '</p><span class="hero2-linea"></span>' +
    (oscuro ? '<a class="cifra-vidrio" href="#/reportar"><span class="cifra-ico">' + ICO.reportar + '</span><span class="cifra-txt"><strong>' + (c.abiertos || 0) +
      '</strong>Mis reportes en trámite</span></a>' : '') +
    '</div>' +
    (cifrasHtml ? '<div class="hero2-cifras">' + cifrasHtml + '</div>' : '') +
    '</div></section>';
}

function tarjetaGrande(ilu, titulo, texto, boton, destino, clase) {
  const esLink = destino.charAt(0) === '#';
  return '<div class="tg ' + (clase || '') + '"><div class="tg-ilu">' + ilu + '</div><div class="tg-cuerpo"><h2>' + esc(titulo) + '</h2><p>' + esc(texto) + '</p>' +
    (esLink ? '<a class="btn btn-pri tg-btn" href="' + destino + '">' : '<button type="button" class="btn ' + (clase === 'tg-notif' ? 'btn-borde' : 'btn-pri') + ' tg-btn" id="' + destino + '">') +
    esc(boton) + ICO.flecha + (esLink ? '</a>' : '</button>') + '</div></div>';
}
function filaOpcion(ilu, titulo, texto, destino, clase) {
  const esLink = destino.charAt(0) === '#';
  return (esLink ? '<a class="fila-op ' + (clase || '') + '" href="' + destino + '">' : '<button type="button" class="fila-op ' + (clase || '') + '" id="' + destino + '">') +
    '<span class="fila-ilu">' + ilu + '</span><span class="fila-txt"><strong>' + esc(titulo) + '</strong><span>' + esc(texto) + '</span></span>' +
    '<span class="fila-ir">' + ICO.flecha + '</span>' + (esLink ? '</a>' : '</button>');
}

async function vistaInicio() {
  ponerBarra(CFG.NOMBRE_APP || 'Solicitudes', false);
  document.body.classList.add('en-inicio');
  if (!E.usuario) cargando();
  await refrescarResumen();
  const u = E.usuario;
  if (!u) throw new Error('No se pudo cargar su información. Revise la conexión.');
  const c = E.contadores || {};
  const n = textoNotif();
  let html = heroInicio(u, c);
  if (E.instalador) html += '<div class="aviso aviso-accion"><div><strong>Instale la app</strong><br><span class="suave">Queda con su ícono en la pantalla de inicio.</span></div><button class="btn btn-sec" id="btn-instalar">Instalar</button></div>';
  if (esAdmin()) {
    html += '<div class="filas-op">' +
      filaOpcion(ILU.campana, n.titulo, n.texto, 'btn-notif', 'fila-notif') +
      filaOpcion(ILU.historial, 'Historial', 'Consulta el historial de solicitudes, la efectividad de cada módulo y descarga los PDF.', '#/dashboard') +
      filaOpcion(ILU.reportar, 'Reportar actividades', 'Informa un daño o una necesidad a Mantenimiento e infraestructura, Sistemas o Equipos Biomédicos.', '#/reportar') +
      '</div>';
  } else if (u.rol === 'Área') {
    html += '<div class="tg-grid">' +
      tarjetaGrande(ILU.campana, n.titulo, n.texto, n.boton, 'btn-notif', 'tg-notif') +
      tarjetaGrande(ILU.reportar, 'Reportar actividades', 'Informa un daño o una necesidad a Mantenimiento e infraestructura, Sistemas o Equipos Biomédicos y sigue su estado.', 'Reportar aquí', '#/reportar', 'tg-acento') +
      '</div>';
  } else {
    html += '<div class="tg-grid">' +
      tarjetaGrande(ILU.administrar, 'Administrar actividades', esLider() ? 'Asigna, sigue y confirma las actividades de ' + u.modulo + '.' : 'Consulta tus actividades asignadas y da seguimiento a su estado.',
        esLider() ? 'Ver actividades' : 'Ver mis actividades', '#/administrar') +
      tarjetaGrande(ILU.herramienta, 'Reportar actividades', 'Informa un daño o una necesidad a cualquier módulo de la clínica.', 'Reportar aquí', '#/reportar', 'tg-acento') +
      '</div>' + tarjetaGrande(ILU.campana, n.titulo, n.texto, n.boton, 'btn-notif', 'tg-notif tg-ancha');
  }
  html += '<p class="credito credito-pagina">Creado por: David Vega y Jaider Landinez</p>';
  pintar(html);
  conectarAvatar();
  const bn = $('#btn-notif');
  if (bn) bn.addEventListener('click', () => {
    if (n.st === 'inactivo') conBoton(bn, 'Activando…', () => activarPush(false)); else abrirCuenta();
  });
  const i = $('#btn-instalar');
  if (i) i.addEventListener('click', async () => { E.instalador.prompt(); await E.instalador.userChoice; E.instalador = null; enrutar(); });
}

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
  if (abiertos.length) html += '<h3 class="subtitulo">En trámite</h3><div class="lista-act">' + abiertos.map((s) => tarjeta(s, { mostrarArea: false })).join('') + '</div>';
  if (cerrados.length) html += '<h3 class="subtitulo">Cerrados</h3><div class="lista-act">' + cerrados.slice(0, 40).map((s) => tarjeta(s, { mostrarArea: false })).join('') + '</div>';
  pintar(html);
}

// ----------------------------- administrar -----------------------------
const POR_PAGINA = 8;

function cabeceraPagina(icono, titulo, desc) {
  return '<section class="cab-pag"><div class="cab-foto"></div><div class="cab-int"><div class="cab-icono">' + icono + '</div>' +
    '<div><h1>' + esc(titulo) + '</h1><p>' + esc(desc) + '</p></div></div></section>';
}

function pestanasAct(lista, activa) {
  return '<nav class="pest-act">' + lista.map((p) => '<a href="' + p.href + '" class="' + (p.id === activa ? 'activa' : '') + '">' + p.ico +
    '<span>' + esc(p.texto) + '</span>' + (p.n !== undefined ? '<b>' + p.n + '</b>' : '') + '</a>').join('') + '</nav>';
}

function sinTildes(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/** Pinta la lista filtrada por la búsqueda, con paginación. */
function pintarListaAct() {
  const L = E.lista;
  const q = sinTildes(L.q).trim();
  const filtrada = !q ? L.datos : L.datos.filter((x) => sinTildes([x.id, x.tipo, x.area, x.modulo, x.servicio, x.ubicacion, x.tecnicoNombre, x.reportadoPor, x.prioridad, x.estado].join(' ')).indexOf(q) >= 0);
  const paginas = Math.max(1, Math.ceil(filtrada.length / POR_PAGINA));
  if (L.pagina > paginas) L.pagina = paginas;
  const desde = (L.pagina - 1) * POR_PAGINA;
  const visibles = filtrada.slice(desde, desde + POR_PAGINA);
  const caja = $('#lista-act');
  if (!caja) return;
  caja.innerHTML = (visibles.map((x) => tarjeta(x, { asignar: L.conAsignar })).join('') || vacio(q ? 'No hay actividades que coincidan con la búsqueda.' : L.vacio)) +
    (filtrada.length ? '<div class="paginacion"><span>Mostrando ' + (desde + 1) + '–' + (desde + visibles.length) + ' de ' + filtrada.length + ' actividades</span>' +
      '<div class="pag-botones"><button type="button" data-p="' + (L.pagina - 1) + '"' + (L.pagina <= 1 ? ' disabled' : '') + ' aria-label="Anterior">' + ICO.izquierda + '</button>' +
      Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => paginas <= 7 || Math.abs(n - L.pagina) <= 2 || n === 1 || n === paginas)
        .map((n) => '<button type="button" data-p="' + n + '" class="' + (n === L.pagina ? 'activa' : '') + '">' + n + '</button>').join('') +
      '<button type="button" data-p="' + (L.pagina + 1) + '"' + (L.pagina >= paginas ? ' disabled' : '') + ' aria-label="Siguiente">' + ICO.derecha + '</button></div></div>' : '');
  $$('.paginacion button', caja).forEach((b) => b.addEventListener('click', () => { L.pagina = Number(b.dataset.p); pintarListaAct(); $('#lista-act').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  $$('.btn-asignar', caja).forEach((b) => b.addEventListener('click', () => abrirAsignar(L.datos.find((x) => x.id === b.dataset.id))));
}

function montarLista(datos, opciones) {
  E.lista = Object.assign({ datos, q: '', pagina: 1 }, opciones);
  const b = $('#buscar-act');
  if (b) b.addEventListener('input', () => { E.lista.q = b.value; E.lista.pagina = 1; pintarListaAct(); });
  pintarListaAct();
}

/** Asignación rápida desde la lista (misma acción "asignar" del detalle). */
async function abrirAsignar(sol) {
  if (!sol) return;
  const m = abrirModal('<h3>Asignar ' + esc(sol.id) + '</h3><p class="suave">' + esc(sol.tipo) + ' · ' + esc(sol.area) + ' · Piso ' + esc(sol.piso) + ' · ' + esc(sol.ubicacion) + '</p>' +
    '<label>Personal de ' + esc(sol.modulo) + '<select id="asig-tecnico"><option value="">Cargando…</option></select></label>' +
    '<div class="modal-botones"><button type="button" class="btn btn-sec" id="modal-no">Cancelar</button><button type="button" class="btn btn-pri" id="asig-si">Asignar</button></div>');
  $('#modal-no', m).addEventListener('click', cerrarModal);
  try {
    const lista = await api('tecnicos', { modulo: sol.modulo });
    $('#asig-tecnico', m).innerHTML = '<option value="">Elija una persona</option>' + lista.map((t) =>
      '<option value="' + esc(t.usuario) + '">' + esc(t.nombre) + (t.rol === 'Líder' ? ' (líder)' : '') + '</option>').join('');
  } catch (e) { mostrarError(e.message); }
  const b = $('#asig-si', m);
  b.addEventListener('click', () => conBoton(b, 'Asignando…', async () => {
    const t = $('#asig-tecnico', m).value;
    if (!t) { mostrarError('Elija a quién asignar'); return; }
    try {
      await api('asignar', { id: sol.id, tecnico: t });
      cerrarModal(); toast('Asignada. El técnico fue notificado.'); refrescarResumen(); enrutar();
    } catch (e) { mostrarError(e.message); }
  }));
}

async function vistaAdministrar(pestana) {
  if (!esPersonal() || esAdmin()) { location.replace('#/'); return; }
  ponerBarra('Administrar actividades', true);
  document.body.classList.add('en-pagina');
  cargando();
  const u = E.usuario;
  const buscador = '<label class="buscador">' + ICO.buscar + '<input type="search" id="buscar-act" placeholder="Buscar actividad…" autocomplete="off"></label>';
  if (!esLider()) {
    const lista = await api('misActividades');
    const activas = lista.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso').sort(porPrioridad);
    const otras = lista.filter((s) => !(s.estado === 'Asignada' || s.estado === 'En proceso'));
    const p = pestana === 'terminadas' ? 'terminadas' : 'activas';
    pintar(cabeceraPagina(ILU.administrar, 'Administrar actividades', 'Consulta tus actividades asignadas: inícialas y termínalas con evidencia.') +
      '<div class="barra-act">' + pestanasAct([
        { id: 'activas', texto: 'Por hacer', href: '#/administrar/activas', n: activas.length, ico: ICO.play },
        { id: 'terminadas', texto: 'Terminadas', href: '#/administrar/terminadas', ico: ICO.pasado }
      ], p) + buscador + '</div><div id="lista-act" class="lista-act"></div>');
    montarLista(p === 'activas' ? activas : otras, { vacio: p === 'activas' ? 'No tiene actividades pendientes.' : 'Aún no ha terminado actividades.' });
    return;
  }
  const [lista, mias] = await Promise.all([api('panelModulo', {}), api('misActividades')]);
  const grupos = {
    'por-asignar': lista.filter((s) => s.estado === 'Pendiente' || s.estado === 'Reabierta').sort(porPrioridad),
    'en-curso': lista.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso'),
    'por-confirmar': lista.filter((s) => s.estado === 'Por confirmar'),
    'historial': lista.filter((s) => s.estado === 'Cerrada' || s.estado === 'Cancelada'),
    'mias': mias.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso')
  };
  const p = grupos[pestana] ? pestana : 'por-asignar';
  const tabs = [
    { id: 'por-asignar', texto: 'Por asignar', href: '#/administrar/por-asignar', n: grupos['por-asignar'].length, ico: ICO.actividades },
    { id: 'en-curso', texto: 'En curso', href: '#/administrar/en-curso', n: grupos['en-curso'].length, ico: ICO.play },
    { id: 'por-confirmar', texto: 'Por confirmar', href: '#/administrar/por-confirmar', n: grupos['por-confirmar'].length, ico: ICO.confirmar },
    { id: 'historial', texto: 'Historial', href: '#/administrar/historial', ico: ICO.pasado }
  ];
  if (grupos.mias.length || p === 'mias') tabs.push({ id: 'mias', texto: 'Mías', href: '#/administrar/mias', n: grupos.mias.length, ico: ICO.mia });
  const textosVacios = {
    'por-asignar': 'No hay solicitudes por asignar.', 'en-curso': 'No hay actividades en curso.',
    'por-confirmar': 'No hay actividades terminadas esperando su confirmación.', 'historial': 'El historial está vacío.',
    'mias': 'No tiene actividades asignadas.'
  };
  pintar(cabeceraPagina(ILU.administrar, 'Administrar actividades', 'Gestiona y da seguimiento a las actividades de ' + u.modulo + ' reportadas por las diferentes áreas de la clínica.') +
    '<div class="barra-act">' + pestanasAct(tabs, p) + buscador + '</div>' + (p === 'historial' ? botonPdf() : '') +
    '<div id="lista-act" class="lista-act"></div>');
  conectarBotonPdf();
  montarLista(grupos[p], { vacio: textosVacios[p], conAsignar: p === 'por-asignar' });
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

  html += botonPdf();
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
  conectarBotonPdf();
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

// ------------------------- PDF de actividades terminadas -------------------------
const ICONO_PDF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function botonPdf() {
  return '<button type="button" class="btn btn-sec btn-ancho btn-pdf" id="btn-pdf">' + ICONO_PDF + 'Descargar PDF de actividades terminadas</button>';
}
function conectarBotonPdf() { const b = $('#btn-pdf'); if (b) b.addEventListener('click', abrirDescargaPdf); }

function diaLocal(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

function abrirDescargaPdf() {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const rangos = {
    'esta-semana': [diaLocal(lunes), diaLocal(hoy)],
    'semana-anterior': [diaLocal(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 7)), diaLocal(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 1))],
    'este-mes': [diaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), diaLocal(hoy)],
    'mes-anterior': [diaLocal(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), diaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 0))],
    'este-ano': [diaLocal(new Date(hoy.getFullYear(), 0, 1)), diaLocal(hoy)]
  };
  const m = abrirModal('<h3>Descargar actividades terminadas</h3>' +
    '<p class="suave">El PDF incluye las solicitudes cerradas (confirmadas por el líder) según su fecha de cierre.</p>' +
    (esAdmin() ? '<label>Módulo<select id="pdf-modulo"><option value="Todos">Todos los módulos</option>' +
      E.config.modulos.map((x) => '<option>' + esc(x) + '</option>').join('') + '</select></label>' :
      '<p>Módulo: <strong>' + esc(E.usuario.modulo) + '</strong></p>') +
    '<div class="atajos-fecha"><button type="button" data-r="esta-semana">Esta semana</button><button type="button" data-r="semana-anterior">Semana anterior</button><button type="button" data-r="este-mes" class="activo">Este mes</button><button type="button" data-r="mes-anterior">Mes anterior</button><button type="button" data-r="este-ano">Este año</button></div>' +
    '<div class="fila-fechas"><label>Desde<input type="date" id="pdf-desde" value="' + rangos['este-mes'][0] + '"></label>' +
    '<label>Hasta<input type="date" id="pdf-hasta" value="' + rangos['este-mes'][1] + '"></label></div>' +
    '<div class="modal-botones"><button type="button" class="btn btn-sec" id="modal-no">Cancelar</button>' +
    '<button type="button" class="btn btn-pri" id="pdf-generar">Descargar PDF</button></div>');
  $('#modal-no', m).addEventListener('click', cerrarModal);
  $$('.atajos-fecha button', m).forEach((b) => b.addEventListener('click', () => {
    $$('.atajos-fecha button', m).forEach((x) => x.classList.toggle('activo', x === b));
    $('#pdf-desde', m).value = rangos[b.dataset.r][0]; $('#pdf-hasta', m).value = rangos[b.dataset.r][1];
  }));
  const gen = $('#pdf-generar', m);
  gen.addEventListener('click', () => conBoton(gen, 'Generando…', async () => {
    try {
      const desde = $('#pdf-desde', m).value, hasta = $('#pdf-hasta', m).value;
      if (!desde || !hasta) throw new Error('Elija las dos fechas');
      const datos = await api('terminadas', { desde, hasta, modulo: esAdmin() ? $('#pdf-modulo', m).value : '' });
      if (!datos.lista.length) throw new Error('No hay actividades terminadas en ese rango de fechas.');
      const bytes = await construirPdfTerminadas(datos);
      const nombre = ('actividades-terminadas_' + datos.modulo + '_' + datos.desde + '_a_' + datos.hasta)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '-').toLowerCase() + '.pdf';
      descargarArchivo(bytes, nombre);
      cerrarModal();
      toast('PDF descargado: ' + datos.lista.length + ' actividades');
    } catch (e) { mostrarError(e.message); }
  }));
}

function descargarArchivo(bytes, nombre) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function fechaPdf(iso, conHora, corto) {
  if (!iso) return '';
  const d = new Date(iso);
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + (corto ? String(d.getFullYear()).slice(2) : d.getFullYear()) + (conHora ? ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) : '');
}
function fechaCorta2(k) { const [a, m, d] = k.split('-'); return d + '/' + m + '/' + a; }

const COLOR_PRIORIDAD_PDF = { Urgente: [192, 57, 43], Alta: [214, 110, 20], Media: [150, 115, 0], Baja: [47, 116, 208] };

async function construirPdfTerminadas(datos) {
  const { PDFSimple } = await import('./pdf.js');
  const AZUL = [0, 51, 90], GRIS = [93, 107, 114], TEXTO = [29, 42, 48];
  const pdf = new PDFSimple(842, 595); // A4 horizontal
  const M = 28, ANCHO = 842 - 2 * M, PIE = 560;
  let logo = null;
  try { logo = pdf.agregarImagen(new Uint8Array(await (await fetch('logo-pdf.jpg')).arrayBuffer()), 160, 160); } catch (e) { /* sin logo */ }

  const lista = datos.lista;
  const horas = lista.map((x) => x.horas).filter((h) => h !== null);
  const promedio = horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null;
  const rango = 'Cerradas del ' + fechaCorta2(datos.desde) + ' al ' + fechaCorta2(datos.hasta);
  const moduloTxt = datos.modulo === 'Todos' ? 'Todos los módulos' : datos.modulo;

  const columnas = [
    { t: 'ID', w: 46 }, { t: 'Fechas', w: 82 }, { t: 'Área / reportó', w: 92 }, { t: 'Ubicación', w: 98 },
    { t: 'Módulo / tipo', w: 92 }, { t: 'Prioridad', w: 44 }, { t: 'Descripción', w: 124 }, { t: 'Trabajo realizado', w: 132 }, { t: 'Técnico', w: 76 }
  ];
  const TAM = 7.6, LH = 9.4, PAD = 4;

  const celdas = (x) => [
    x.id,
    'Rep.: ' + fechaPdf(x.fechaReporte, true, true) + '\nCerr.: ' + fechaPdf(x.fechaCierre, true, true) + '\nTiempo: ' + duracion(x.horas),
    x.area + (x.reportadoPor ? '\n' + x.reportadoPor : ''),
    (x.torre ? x.torre.split(',')[0] + (x.servicio ? ' · ' + x.servicio : '') + '\n' : (x.servicio ? x.servicio + '\n' : '')) + 'Piso ' + x.piso + ' · ' + x.ubicacion,
    x.modulo + '\n' + x.tipo,
    x.prioridad,
    x.descripcion,
    (x.trabajo || '') + (x.comentario ? '\nComentario del líder: ' + x.comentario : ''),
    x.tecnico
  ];

  function encabezadoTabla(y) {
    pdf.rect(M, y, ANCHO, 20, AZUL);
    let cx = M;
    columnas.forEach((c) => { pdf.texto(cx + PAD, y + 13.5, c.t, 8, { negrita: true, color: [255, 255, 255] }); cx += c.w; });
    return y + 20;
  }
  function nuevaPagina(primera) {
    pdf.nuevaPagina();
    if (primera) {
      if (logo) pdf.imagen(logo, M, 22, 46, 46);
      pdf.texto(M + 58, 42, 'Actividades terminadas', 19, { negrita: true, color: AZUL });
      pdf.texto(M + 58, 60, (CFG.NOMBRE_CLINICA || 'Clínica San José de Cúcuta') + '  ·  ' + moduloTxt, 10, { color: GRIS });
      pdf.texto(M + ANCHO, 42, rango, 10.5, { negrita: true, color: TEXTO, alinear: 'derecha' });
      pdf.texto(M + ANCHO, 60, 'Generado el ' + fechaPdf(new Date().toISOString(), true) + ' por ' + (datos.generadoPor || ''), 8.5, { color: GRIS, alinear: 'derecha' });
      pdf.linea(M, 78, M + ANCHO, 78, AZUL, 1.2);
      let resumen = 'Total: ' + lista.length + ' actividades terminadas   ·   Tiempo promedio de cierre: ' + duracion(promedio);
      if (datos.modulo === 'Todos') {
        resumen += '   ·   ' + E.config.modulos.map((m) => m + ': ' + lista.filter((x) => x.modulo === m).length).join('   ·   ');
      }
      pdf.texto(M, 96, resumen, 9, { negrita: true, color: TEXTO });
      return encabezadoTabla(106);
    }
    if (logo) pdf.imagen(logo, M, 16, 24, 24);
    pdf.texto(M + 32, 32, 'Actividades terminadas  ·  ' + moduloTxt + '  ·  ' + rango, 9, { negrita: true, color: AZUL });
    return encabezadoTabla(48);
  }

  let y = nuevaPagina(true);
  lista.forEach((x, i) => {
    const textos = celdas(x);
    let lineas = textos.map((t, j) => pdf.partir(t, columnas[j].w - 2 * PAD, TAM, j === 0 || j === 5));
    const maxLineas = Math.floor((PIE - 70 - 2 * PAD) / LH);
    lineas = lineas.map((l) => l.length > maxLineas ? l.slice(0, maxLineas - 1).concat(['(continúa en la hoja de cálculo)']) : l);
    const alto = Math.max(...lineas.map((l) => l.length)) * LH + 2 * PAD;
    if (y + alto > PIE) y = nuevaPagina(false);
    if (i % 2 === 1) pdf.rect(M, y, ANCHO, alto, [242, 246, 250]);
    let cx = M;
    lineas.forEach((ls, j) => {
      const opc = { negrita: j === 0 || j === 5, color: j === 5 ? (COLOR_PRIORIDAD_PDF[x.prioridad] || TEXTO) : TEXTO };
      ls.forEach((l, k) => pdf.texto(cx + PAD, y + PAD + 7 + k * LH, l, TAM, opc));
      cx += columnas[j].w;
    });
    pdf.linea(M, y + alto, M + ANCHO, y + alto, [214, 223, 230], 0.5);
    y += alto;
  });

  const total = pdf.paginas.length;
  pdf.paginas.forEach((pag, i) => {
    pdf.actual = pag;
    pdf.texto(M, 578, 'Solicitudes CSJ · ' + (CFG.NOMBRE_CLINICA || ''), 7.5, { color: GRIS });
    pdf.texto(M + ANCHO, 578, 'Página ' + (i + 1) + ' de ' + total, 7.5, { color: GRIS, alinear: 'derecha' });
  });
  return pdf.generar('Actividades terminadas - ' + moduloTxt + ' - ' + rango);
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
  const m = abrirModal('<div class="cuenta-cab">' + avatar(u, 'l', true) + '<div><h3>' + esc(u.nombre) + '</h3><p class="suave">Usuario: ' + esc(u.usuario) + ' · ' + esc(u.rol) +
    (u.modulo && u.rol !== 'Área' ? ' · ' + esc(u.modulo) : '') + '</p><p class="suave pequeno">Toque la cámara para cambiar su foto de perfil.</p></div></div>' +
    '<p>Notificaciones: <strong>' + esc(textoPush) + '</strong></p>' +
    '<div class="modal-botones columna">' +
    (st === 'inactivo' || st === 'activo' ? '<button class="btn btn-sec" id="cuenta-push">' + (st === 'activo' ? 'Volver a registrar este dispositivo' : 'Activar notificaciones') + '</button>' : '') +
    '<button class="btn btn-peligro" id="cuenta-salir">Cerrar sesión</button>' +
    '<button class="btn btn-texto" id="cuenta-cerrar">Volver</button></div>' +
    '<p class="credito">Creado por: David Vega y Jaider Landinez</p>');
  conectarAvatar();
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
