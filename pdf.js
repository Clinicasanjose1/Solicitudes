/*
 * Generador de PDF sencillo (sin librerías externas) para la App de Solicitudes.
 * Usa las fuentes estándar Helvetica / Helvetica-Bold (codificación WinAnsi, admite tildes y ñ)
 * y permite texto, rectángulos de color e imágenes JPEG. Coordenadas en puntos, origen arriba a la izquierda.
 * No es necesario editar este archivo.
 */
const ANCHOS = {
  normal: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  negrita: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99 };

function codigo(ch) {
  const c = ch.charCodeAt(0);
  if (c < 0x20) return 0x20;
  if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) return c;
  if (CP1252[c]) return CP1252[c];
  return 0x3F; // '?'
}

export class PDFSimple {
  constructor(ancho, alto) {
    this.ancho = ancho; this.alto = alto;
    this.paginas = []; this.imagenes = []; this.actual = null;
  }
  nuevaPagina() { this.actual = []; this.paginas.push(this.actual); return this.paginas.length; }
  anchoTexto(texto, tam, negrita) {
    const w = negrita ? ANCHOS.negrita : ANCHOS.normal;
    let s = 0;
    for (const ch of String(texto)) s += w[codigo(ch)] || 556;
    return s * tam / 1000;
  }
  /** Parte un texto en líneas que caben en "ancho" puntos (respeta saltos de línea). */
  partir(texto, ancho, tam, negrita) {
    const lineas = [];
    String(texto === undefined || texto === null ? '' : texto).split(/\r?\n/).forEach((parrafo) => {
      const palabras = parrafo.split(/\s+/).filter(Boolean);
      let linea = '';
      palabras.forEach((p) => {
        const prueba = linea ? linea + ' ' + p : p;
        if (this.anchoTexto(prueba, tam, negrita) <= ancho) { linea = prueba; return; }
        if (linea) lineas.push(linea);
        // palabra más larga que la columna: se corta
        let resto = p;
        while (this.anchoTexto(resto, tam, negrita) > ancho) {
          let n = resto.length - 1;
          while (n > 1 && this.anchoTexto(resto.slice(0, n), tam, negrita) > ancho) n--;
          lineas.push(resto.slice(0, n)); resto = resto.slice(n);
        }
        linea = resto;
      });
      lineas.push(linea);
    });
    return lineas.length ? lineas : [''];
  }
  _color(c) { return c.map((x) => (x / 255).toFixed(3)).join(' '); }
  rect(x, y, w, h, color) {
    this.actual.push(this._color(color) + ' rg ' + x.toFixed(2) + ' ' + (this.alto - y - h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f');
  }
  linea(x1, y1, x2, y2, color, grosor) {
    this.actual.push(this._color(color) + ' RG ' + (grosor || 0.5) + ' w ' + x1.toFixed(2) + ' ' + (this.alto - y1).toFixed(2) + ' m ' +
      x2.toFixed(2) + ' ' + (this.alto - y2).toFixed(2) + ' l S');
  }
  /** Escribe texto; y es la línea base medida desde arriba. */
  texto(x, y, texto, tam, opciones) {
    const o = opciones || {};
    let s = '';
    for (const ch of String(texto)) {
      const c = codigo(ch);
      const car = String.fromCharCode(c);
      s += (car === '(' || car === ')' || car === '\\') ? '\\' + car : car;
    }
    let px = x;
    if (o.alinear === 'derecha') px = x - this.anchoTexto(texto, tam, o.negrita);
    if (o.alinear === 'centro') px = x - this.anchoTexto(texto, tam, o.negrita) / 2;
    this.actual.push('BT /' + (o.negrita ? 'F2' : 'F1') + ' ' + tam + ' Tf ' + this._color(o.color || [29, 42, 48]) + ' rg ' +
      px.toFixed(2) + ' ' + (this.alto - y).toFixed(2) + ' Td (' + s + ') Tj ET');
  }
  /** jpeg: Uint8Array de un archivo JPEG; ancho/alto en píxeles de la imagen. */
  agregarImagen(jpeg, anchoPx, altoPx) {
    this.imagenes.push({ jpeg, anchoPx, altoPx });
    return 'Im' + this.imagenes.length;
  }
  imagen(nombre, x, y, w, h) {
    this.actual.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + (this.alto - y - h).toFixed(2) + ' cm /' + nombre + ' Do Q');
  }
  /** Devuelve el PDF como Uint8Array. */
  generar(titulo) {
    const objetos = []; // cada uno: array de partes (string binario o Uint8Array)
    const agregar = (partes) => { objetos.push(partes); return objetos.length; };
    const catalogo = agregar(null); const raiz = agregar(null);
    const f1 = agregar(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
    const f2 = agregar(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
    const imgs = this.imagenes.map((im) => agregar([
      '<< /Type /XObject /Subtype /Image /Width ' + im.anchoPx + ' /Height ' + im.altoPx +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.jpeg.length + ' >>\nstream\n', im.jpeg, '\nendstream']));
    const recursos = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> /XObject << ' +
      imgs.map((n, i) => '/Im' + (i + 1) + ' ' + n + ' 0 R').join(' ') + ' >> >>';
    const hojas = this.paginas.map((comandos) => {
      const contenido = comandos.join('\n');
      const c = agregar(['<< /Length ' + contenido.length + ' >>\nstream\n' + contenido + '\nendstream']);
      return agregar(['<< /Type /Page /Parent ' + raiz + ' 0 R /MediaBox [0 0 ' + this.ancho + ' ' + this.alto + '] /Resources ' + recursos + ' /Contents ' + c + ' 0 R >>']);
    });
    objetos[raiz - 1] = ['<< /Type /Pages /Kids [' + hojas.map((h) => h + ' 0 R').join(' ') + '] /Count ' + hojas.length + ' >>'];
    let info = '';
    for (const ch of String(titulo || '')) info += String.fromCharCode(codigo(ch)).replace(/[()\\]/g, '\\$&');
    const nInfo = agregar(['<< /Title (' + info + ') /Producer (App Solicitudes CSJ) >>']);
    objetos[catalogo - 1] = ['<< /Type /Catalog /Pages ' + raiz + ' 0 R >>'];

    const trozos = []; let largo = 0;
    const poner = (p) => {
      const b = typeof p === 'string' ? Uint8Array.from(p, (ch) => ch.charCodeAt(0) & 0xFF) : p;
      trozos.push(b); largo += b.length;
    };
    poner('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const posiciones = [];
    objetos.forEach((partes, i) => { posiciones.push(largo); poner((i + 1) + ' 0 obj\n'); partes.forEach(poner); poner('\nendobj\n'); });
    const xref = largo;
    poner('xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n');
    posiciones.forEach((p) => poner(String(p).padStart(10, '0') + ' 00000 n \n'));
    poner('trailer\n<< /Size ' + (objetos.length + 1) + ' /Root ' + catalogo + ' 0 R /Info ' + nInfo + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    const salida = new Uint8Array(largo); let pos = 0;
    trozos.forEach((t) => { salida.set(t, pos); pos += t.length; });
    return salida;
  }
}
