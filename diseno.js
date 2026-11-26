/*
 * Íconos e ilustraciones de la App de Solicitudes (diseño v5).
 * No es necesario editar este archivo.
 */
const s = (w, cuerpo, extra) => '<svg viewBox="0 0 24 24" width="' + w + '" height="' + w + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + cuerpo + '</svg>';

export const ICO = {
  inicio: s(22, '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  reportar: s(22, '<path d="M9 4h6l1 2h3v14H5V6h3l1-2z"/><path d="M12 10v6M9 13h6"/>'),
  lista: s(22, '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>'),
  actividades: s(22, '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10l1.5 1.5 3-3M8.5 16l1.5 1.5 3-3"/>'),
  historial: s(22, '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>'),
  campana: s(22, '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  chevron: s(18, '<path d="M6 9l6 6 6-6"/>'),
  flecha: s(22, '<path d="M5 12h14M13 6l6 6-6 6"/>'),
  camara: s(20, '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  edificio: s(16, '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>'),
  pin: s(16, '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  calendario: s(16, '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  persona: s(16, '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  ojo: s(20, '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  asignar: s(20, '<circle cx="10" cy="8" r="4"/><path d="M3 21c1.3-3.8 4-5.5 7-5.5 1.6 0 3 .4 4.2 1.2M19 14v6M16 17h6"/>'),
  reloj: s(16, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  alerta: s(16, '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>'),
  check: s(16, '<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  buscar: s(20, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  play: s(18, '<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  confirmar: s(18, '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l3 3 5-6"/>'),
  pasado: s(18, '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  mia: s(18, '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  izquierda: s(18, '<path d="M15 6l-6 6 6 6"/>'),
  derecha: s(18, '<path d="M9 6l6 6-6 6"/>'),
  enviar: s(20, '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>')
};

/** Ícono grande según el tipo de solicitud. */
const T = (cuerpo) => s(40, cuerpo, ' stroke-width="1.6"');
const ICONOS_TIPO = [
  [/puerta|cerradura/, T('<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M14.5 12h.01" stroke-width="3"/><path d="M3 21h18"/>')],
  [/plomer|agua|fuga|baño/, T('<path d="M4 8h9a3 3 0 0 1 3 3v2"/><path d="M4 5v6M9 5V3M7 3h4"/><path d="M16 17c0 1.7-1 3-2 3s-2-1.3-2-3 2-4 2-4 2 2.3 2 4z"/>')],
  [/aire/, T('<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M6 10h12M8 16l-1 3M12 16v3M16 16l1 3"/>')],
  [/el[eé]ctric|ilumin|luz/, T('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>')],
  [/ventana/, T('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>')],
  [/mobiliario|silla|mesa/, T('<path d="M6 11V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M4 11h16v4H4zM6 15v6M18 15v6"/>')],
  [/pared|pintura/, T('<rect x="4" y="3" width="13" height="6" rx="1"/><path d="M17 6h3v5h-8v3"/><rect x="10.5" y="14" width="3" height="7" rx="1"/>')],
  [/computador|pc/, T('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>')],
  [/impresora/, T('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>')],
  [/internet|red|wifi/, T('<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01" stroke-width="3"/>')],
  [/tel[eé]fono|extensi/, T('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>')],
  [/software|sistema/, T('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M9 13l-2 2 2 2M15 13l2 2-2 2"/>')],
  [/usuario|contrase/, T('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>')],
  [/monitor|signos/, T('<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M6 11h3l1.5-3 3 6 1.5-3H18M9 21h6"/>')],
  [/infusi/, T('<path d="M9 3h6v9a3 3 0 0 1-6 0z"/><path d="M12 15v3M10 21h4M9 7h6"/>')],
  [/ventilador/, T('<path d="M12 4v8M12 12c-4 0-7 2-7 6 0 1.5 1 2 2 2 3 0 5-3 5-8zM12 12c4 0 7 2 7 6 0 1.5-1 2-2 2-3 0-5-3-5-8z"/>')],
  [/desfibril/, T('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/><path d="M13 7l-3 5h4l-3 5"/>')],
  [/electrocard|ecg/, T('<path d="M2 12h4l2-5 3 10 3-8 2 3h6"/>')],
  [/im[aá]gen|rayos|ecograf|resonan/, T('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 7v10M9 9h6M9.5 12h5M9 15h6"/>')],
  [/laboratorio|muestra/, T('<path d="M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>')],
  [/cama/, T('<path d="M3 7v12M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>')]
];
const ICONO_TIPO_OTRO = T('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>');
export function iconoTipo(tipo) {
  const t = String(tipo || '').toLowerCase();
  for (const [re, ico] of ICONOS_TIPO) if (re.test(t)) return ico;
  return ICONO_TIPO_OTRO;
}

/** Ilustraciones grandes de las tarjetas de inicio (azules, sin fotos). */
const fondo = '<circle cx="60" cy="62" r="50" fill="#e4edfb"/><circle cx="96" cy="26" r="10" fill="#eef4fd"/>';
const tablero = (x, y) => '<rect x="' + x + '" y="' + (y + 6) + '" width="52" height="66" rx="8" fill="#fff" stroke="#1d5bd1" stroke-width="5"/>' +
  '<rect x="' + (x + 16) + '" y="' + (y - 2) + '" width="20" height="14" rx="4" fill="#1d5bd1"/>' +
  [0, 1, 2].map((i) => '<path d="M' + (x + 9) + ' ' + (y + 27 + i * 15) + 'l4 4 7-8" stroke="#1d5bd1" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M' + (x + 26) + ' ' + (y + 27 + i * 15) + 'h17" stroke="#0b3a75" stroke-width="4" stroke-linecap="round"/>').join('');
const engranaje = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#1d5bd1" stroke-width="' + (r * 0.5) + '" stroke-dasharray="' + (r * 0.42).toFixed(2) + ' ' + (2 * Math.PI * r / 8 - r * 0.42).toFixed(2) + '"/>' +
  '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.85) + '" fill="#1d5bd1"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.38) + '" fill="#fff"/>';
const llave = (tx, ty, esc, color) => '<g transform="translate(' + tx + ' ' + ty + ') scale(' + esc + ')"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" fill="' + color + '"/></g>';
export const ILU = {
  campana: '<svg viewBox="0 0 120 120" aria-hidden="true">' + fondo +
    '<defs><linearGradient id="g-campana" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b97f2"/><stop offset="1" stop-color="#1d5bd1"/></linearGradient></defs>' +
    '<path d="M60 26c-15 0-25 11-25 27v16l-8 11h66l-8-11V53c0-16-10-27-25-27z" fill="url(#g-campana)"/>' +
    '<circle cx="60" cy="24" r="5" fill="#1d5bd1"/><circle cx="60" cy="88" r="8" fill="#0b3a75"/>' +
    '<path d="M86 30a16 16 0 0 1 8 14M94 21a28 28 0 0 1 12 23" stroke="#5b97f2" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
  reportar: '<svg viewBox="0 0 120 120" aria-hidden="true">' + fondo + tablero(24, 22) +
    '<circle cx="84" cy="84" r="20" fill="#0b3a75"/>' + llave(72, 72, 1, '#fff') + '</svg>',
  administrar: '<svg viewBox="0 0 120 120" aria-hidden="true">' + fondo + tablero(22, 20) + engranaje(84, 84, 15) + '</svg>',
  herramienta: '<svg viewBox="0 0 120 120" aria-hidden="true">' + fondo +
    '<defs><linearGradient id="g-llave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b97f2"/><stop offset="1" stop-color="#1d5bd1"/></linearGradient></defs>' +
    llave(14, 10, 3.6, 'url(#g-llave)') + engranaje(86, 84, 15) + '</svg>',
  historial: '<svg viewBox="0 0 120 120" aria-hidden="true">' + fondo +
    '<rect x="22" y="70" width="12" height="24" rx="3" fill="#0b3a75"/><rect x="40" y="58" width="12" height="36" rx="3" fill="#0b3a75"/>' +
    '<rect x="58" y="46" width="12" height="48" rx="3" fill="#1d5bd1"/>' +
    '<path d="M22 58l22-16 14 8 22-20" stroke="#1d5bd1" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 28h10v10" stroke="#1d5bd1" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="88" cy="80" r="17" fill="#5b97f2"/><path d="M88 80V63a17 17 0 0 1 16 12z" fill="#0b3a75"/></svg>'
};
