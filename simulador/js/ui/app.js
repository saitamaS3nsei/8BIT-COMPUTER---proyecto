// Aplicación: cámara, herramientas, edición con deshacer, guardado y bucle de simulación.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo, UI = S.UI;
  // Con #completa la página abre la computadora ya armada, en un espacio de trabajo aparte
  // para no pisar el armado propio guardado en el navegador.
  const MODO = (G.location && G.location.hash || '').slice(1);
  const ARMADA = MODO === 'completa';
  const CLAVE_LS = ARMADA ? 'sim8.protoboard.v1:completa' : 'sim8.protoboard.v1';
  const UMBRAL = 4;

  class App {
    constructor() {
      this.cv = document.getElementById('lienzo');
      this.escena = document.getElementById('escena');
      this.dib = new UI.Dibujo(this, this.cv);
      this.cam = { x: -320, y: -80, z: 1.2 };
      this.herr = 'seleccionar';
      this.colorCable = S.COLORES_CABLE[3][0];
      this.sel = null;
      this.hover = null;
      this.raton = null;
      this.colocar = null;
      this.fantasma = null;
      this.cableNuevo = null;
      this.arrastre = null;
      this.arrastrandoId = null;
      this.arrastrandoCable = null;
      this.redFijada = -1;
      this.pinFoco = null;
      this.vistaCables = 'opacos';
      this.verFaltantes = true;
      this.verValores = true;
      this.pasoGuia = 1;
      this.velocidad = 1;
      this.pausado = false;
      this.historia = [];
      this.rehacerPila = [];
      this.acciones = null;
      this.espacio = false;
      this.sucio = true;
      this.cargarInicial();
      this.paneles = new UI.Paneles(this);
      this.eventos();
      this.redimensionar();
      if (!this.camGuardada) this.ajustarVista();
      this.paneles.actualizar();
      if (ARMADA) {
        document.title = 'Computadora armada · Protoboard 8 bits';
        document.querySelector('#barra .marca').innerHTML = 'Protoboard <b>8 bits</b> <span class="modo">armada</span>';
        if (this.recienArmada) this.aviso(`Computadora completa: ${this.doc.boards.length} protoboards, ${this.doc.parts.length} piezas y ${this.doc.wires.length} cables. Tu armado propio sigue en index.html`);
      }
      this.ultimoCuadro = performance.now();
      this.ultimoVivo = 0;
      requestAnimationFrame(t => this.bucle(t));
    }

    // ------------------------------------------------------------------ Documento
    cargarInicial() {
      let doc = null;
      try {
        const g = JSON.parse(localStorage.getItem(CLAVE_LS) || 'null');
        if (g && g.doc && Array.isArray(g.doc.parts)) {
          doc = g.doc;
          if (ARMADA && doc.armado !== S.VERSION_ARMADO) throw new Error('armado anterior');
          this.pasoGuia = g.pasoGuia || 1;
          if (g.cam) { this.cam = g.cam; this.camGuardada = true; }
        }
      } catch (e) { doc = null; }
      if (!doc && ARMADA) { doc = S.autoArmar(8); this.pasoGuia = 8; this.recienArmada = true; }
      this.doc = doc || S.docInicial();
      try {
        this.normalizar(this.doc);
        this.motor = new S.Motor(this.doc, { semilla: Date.now() & 0xffff });
        this.verif = S.verificar(this.doc, this.motor);
      } catch (e) {
        // Un guardado dañado no debe impedir abrir el simulador.
        console.warn('Guardado local inválido, se empieza de cero', e);
        this.doc = S.docInicial();
        this.motor = new S.Motor(this.doc, { semilla: Date.now() & 0xffff });
        this.verif = S.verificar(this.doc, this.motor);
      }
    }
    normalizar(doc) {
      doc.notes = doc.notes || []; doc.wires = doc.wires || []; doc.boards = doc.boards || []; doc.secciones = doc.secciones || [];
      if (!doc.next) doc.next = 1 + Math.max(0, ...[...doc.parts, ...doc.wires, ...doc.boards, ...doc.notes].map(x => +String(x.id).replace(/\D/g, '') || 0));
      for (const p of doc.parts) p.props = Object.assign(S.propsIniciales(p.type), p.props || {});
    }
    ocupacion() {
      if (!this._ocup || this._ocupDoc !== this.doc) { this._ocup = S.ocupacion(this.doc); this._ocupDoc = this.doc; }
      return this._ocup;
    }
    // Posiciones de pines y curvas de cables: se recalculan solo cuando cambia el documento.
    invalidarGeometria() { this._geoP = null; this._geoC = null; }
    geometria(p, usarCache) {
      if (!usarCache) return { caja: UI.caja(this.doc, p), pines: S.huella(p).map(h => ({ pin: h.pin, pos: S.posClave(this.doc, h.clave) })) };
      if (!this._geoP || this._geoPDoc !== this.doc) { this._geoP = new Map(); this._geoPDoc = this.doc; }
      let g = this._geoP.get(p.id);
      if (!g || g.p !== p) {
        g = { p, caja: UI.caja(this.doc, p), pines: S.huella(p).map(h => ({ pin: h.pin, pos: S.posClave(this.doc, h.clave) })) };
        this._geoP.set(p.id, g);
      }
      return g;
    }
    geometriaCables() {
      if (this._geoC && this._geoCDoc === this.doc && this._geoCMotor === this.motor.N) return this._geoC;
      const out = [];
      for (const w of this.doc.wires) {
        const a = S.posClave(this.doc, w.a), b = S.posClave(this.doc, w.b);
        if (!a || !b) continue;
        const c = UI.curvaCable(a, b);
        const xs = [a.x, b.x, c.c1.x, c.c2.x], ys = [a.y, b.y, c.c1.y, c.c2.y];
        out.push({ w, c, na: this.motor.nodoDe(w.a), x0: Math.min(...xs) - 4, x1: Math.max(...xs) + 4, y0: Math.min(...ys) - 4, y1: Math.max(...ys) + 4 });
      }
      this._geoC = out; this._geoCDoc = this.doc; this._geoCMotor = this.motor.N;
      return out;
    }
    aplicar() {
      this._ocup = null;
      this.invalidarGeometria();
      this.motor.doc = this.doc;
      this.motor.construir();
      this.verif = S.verificar(this.doc, this.motor);
      this.guardarLocal();
      this.sucio = true;
      if (this.sel && this.sel.tipo === 'pieza' && !this.doc.parts.some(p => p.id === this.sel.id)) this.sel = null;
      if (this.sel && this.sel.tipo === 'cable' && !this.doc.wires.some(w => w.id === this.sel.id)) this.sel = null;
      if (this.sel && this.sel.tipo === 'tablero' && !this.doc.boards.some(b => b.id === this.sel.id)) this.sel = null;
      this.paneles.actualizar();
    }
    editar(fn) {
      const antes = JSON.stringify(this.doc);
      fn(this.doc);
      if (JSON.stringify(this.doc) === antes) return false;
      this.historia.push(antes);
      if (this.historia.length > 150) this.historia.shift();
      this.rehacerPila = [];
      this.aplicar();
      return true;
    }
    reemplazarDoc(nuevo) {
      this.historia.push(JSON.stringify(this.doc));
      this.rehacerPila = [];
      this.doc = nuevo;
      this.normalizar(this.doc);
      this.sel = null; this.redFijada = -1; this.pinFoco = null;
      this.aplicar();
      this.ajustarVista();
    }
    // Cambios de uso (interruptores, potenciómetro, fuente): no entran en el historial de deshacer.
    cambiarEstado(fn) {
      fn(this.doc);
      this.motor.enlazar();
      this.verif = S.verificar(this.doc, this.motor);
      this.guardarLocal();
      this.sucio = true;
      this.paneles.refrescarVivo(true);
    }
    deshacer() {
      if (!this.historia.length) return this.aviso('No hay nada que deshacer');
      this.rehacerPila.push(JSON.stringify(this.doc));
      this.doc = JSON.parse(this.historia.pop());
      this.aplicar();
    }
    rehacer() {
      if (!this.rehacerPila.length) return this.aviso('No hay nada que rehacer');
      this.historia.push(JSON.stringify(this.doc));
      this.doc = JSON.parse(this.rehacerPila.pop());
      this.aplicar();
    }
    guardarLocal() {
      clearTimeout(this.tGuardar);
      this.tGuardar = setTimeout(() => {
        try { localStorage.setItem(CLAVE_LS, JSON.stringify({ doc: this.doc, pasoGuia: this.pasoGuia, cam: this.cam })); } catch (e) { /* almacenamiento lleno o bloqueado */ }
      }, 400);
    }
    descargar() {
      const datos = JSON.stringify({ formato: 'protoboard-8bits', version: 1, doc: this.doc }, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([datos], { type: 'application/json' }));
      a.download = 'computadora-8bits-protoboard.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    abrirArchivo(archivo) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const g = JSON.parse(r.result);
          const doc = g.doc || g;
          if (!Array.isArray(doc.parts) || !Array.isArray(doc.boards)) throw new Error('formato');
          this.reemplazarDoc(doc);
          this.aviso('Proyecto abierto');
        } catch (e) { this.aviso('Ese archivo no es un proyecto de este simulador'); }
      };
      r.readAsText(archivo);
    }

    // ------------------------------------------------------------------ Cámara
    redimensionar() {
      const r = this.escena.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      this.cv.width = Math.max(1, Math.round(r.width * dpr));
      this.cv.height = Math.max(1, Math.round(r.height * dpr));
      this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
      this.ancho = r.width; this.alto = r.height;
      this.sucio = true;
    }
    aMundo(sx, sy) { return { x: this.cam.x + sx / this.cam.z, y: this.cam.y + sy / this.cam.z }; }
    zoom(f, sx, sy) {
      const antes = this.aMundo(sx, sy);
      this.cam.z = Math.min(8, Math.max(0.12, this.cam.z * f));
      this.cam.x = antes.x - sx / this.cam.z; this.cam.y = antes.y - sy / this.cam.z;
      this.ocultarTip();
      this.sucio = true; this.guardarLocal();
    }
    encuadrar(x0, y0, x1, y1, maxZ = 3) {
      const m = 40, w = x1 - x0 + 2 * m, h = y1 - y0 + 2 * m;
      this.cam.z = Math.min(maxZ, this.ancho / w, this.alto / h);
      this.cam.x = (x0 + x1) / 2 - this.ancho / 2 / this.cam.z;
      this.cam.y = (y0 + y1) / 2 - this.alto / 2 / this.cam.z;
      this.ocultarTip();
      this.sucio = true; this.guardarLocal();
    }
    ajustarVista() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const inc = (x, y, w, h) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
      for (const b of this.doc.boards) inc(b.x, b.y - 30, geo.W, geo.H + 30);
      for (const p of this.doc.parts) if (p.pos) inc(p.pos.x, p.pos.y, S.TIPOS[p.type].w, S.TIPOS[p.type].h);
      if (!isFinite(x0)) { x0 = -100; y0 = -100; x1 = 600; y1 = 300; }
      this.encuadrar(x0, y0, x1, y1, 2.2);
    }
    centrarEn(x, y, z) {
      if (z) this.cam.z = z;
      this.cam.x = x - this.ancho / 2 / this.cam.z; this.cam.y = y - this.alto / 2 / this.cam.z;
      this.ocultarTip();
      this.sucio = true; this.guardarLocal();
    }
    irATablero(id) {
      const b = this.doc.boards.find(x => x.id === id);
      if (!b) return;
      this.sel = { tipo: 'tablero', id };
      this.encuadrar(b.x - 10, b.y - 40, b.x + geo.W + 10, b.y + geo.H + 20, 3);
      this.paneles.actualizar();
    }
    irAPieza(id) {
      const p = this.doc.parts.find(q => q.id === id);
      if (!p) return;
      const c = UI.caja(this.doc, p);
      this.sel = { tipo: 'pieza', id };
      if (c) this.centrarEn(c.x + c.w / 2, c.y + c.h / 2, Math.max(this.cam.z, 2));
      this.paneles.mostrar('props');
      this.paneles.actualizar();
    }

    // ------------------------------------------------------------------ Consultas
    posPin(id, pin) {
      const p = this.doc.parts.find(q => q.id === id);
      if (!p) return null;
      const h = S.huella(p).find(x => String(x.pin) === String(pin));
      return h ? S.posClave(this.doc, h.clave) : null;
    }
    tableroEn(pt, margen = 0) {
      for (let i = this.doc.boards.length - 1; i >= 0; i--) {
        const b = this.doc.boards[i];
        if (pt.x >= b.x - margen && pt.x <= b.x + geo.W + margen && pt.y >= b.y - margen && pt.y <= b.y + geo.H + margen) return b;
      }
      return null;
    }
    agujeroEn(pt) {
      const b = this.tableroEn(pt, 6);
      if (!b) return null;
      const h = geo.agujeroEn(pt.x - b.x, pt.y - b.y);
      return h ? { tablero: b, fila: h.fila, col: h.col, clave: geo.clave(b.id, h.fila, h.col) } : null;
    }
    // Lo que hay bajo el puntero, de arriba hacia abajo.
    tocar(pt) {
      const doc = this.doc, z = this.cam.z, tol = Math.max(2.5, 5 / z);
      if (this.sel && this.sel.tipo === 'cable') {
        const w = doc.wires.find(x => x.id === this.sel.id);
        if (w) for (const ext of ['a', 'b']) { const q = S.posClave(doc, w[ext]); if (q && Math.hypot(q.x - pt.x, q.y - pt.y) < tol + 1) return { tipo: 'extremoCable', id: w.id, ext }; }
      }
      if (this.sel && this.sel.tipo === 'pieza') {
        const p = doc.parts.find(x => x.id === this.sel.id);
        if (p && S.TIPOS[p.type].cat === 'leads') for (const pin of S.TIPOS[p.type].pines) {
          const q = S.posClave(doc, p.leads[pin]);
          if (q && Math.hypot(q.x - pt.x, q.y - pt.y) < tol + 1) return { tipo: 'extremo', id: p.id, pin };
        }
      }
      for (const p of doc.parts) {
        const t = S.TIPOS[p.type];
        if (t.cat !== 'libre') continue;
        for (const [pin, [dx, dy]] of Object.entries(t.bornes)) if (Math.hypot(p.pos.x + dx - pt.x, p.pos.y + dy - pt.y) < 9) return { tipo: 'borne', id: p.id, pin, clave: `${p.id}:${pin}` };
        if (Math.hypot(p.pos.x + 16 - pt.x, p.pos.y + 96 - pt.y) < 9) return { tipo: 'pieza', id: p.id, ctl: 'encendido' };
        if (pt.x >= p.pos.x && pt.x <= p.pos.x + t.w && pt.y >= p.pos.y && pt.y <= p.pos.y + t.h) return { tipo: 'pieza', id: p.id };
      }
      if (this.vistaCables !== 'ocultos') {
        let mejor = null;
        for (const g of this.geometriaCables()) {
          if (pt.x < g.x0 - tol || pt.x > g.x1 + tol || pt.y < g.y0 - tol || pt.y > g.y1 + tol) continue;
          const c = g.c;
          let prev = c.a;
          for (let i = 1; i <= 16; i++) {
            const q = UI.puntoCurva(c, i / 16);
            const d = distSeg(pt, prev, q);
            if (d < tol * 0.75 && (!mejor || d < mejor.d)) mejor = { d, id: g.w.id };
            prev = q;
          }
        }
        if (mejor) {
          const h = this.agujeroEn(pt);
          const w = doc.wires.find(x => x.id === mejor.id);
          // Si el puntero está justo en un agujero vacío, se prefiere el agujero (para poder tirar otro cable).
          if (!(h && !this.ocupacion().has(h.clave) && mejor.d > 1.2 && w.a !== h.clave && w.b !== h.clave)) return { tipo: 'cable', id: mejor.id };
        }
      }
      const orden = ['leads', 'inline', 'dip'];
      for (const cat of orden) {
        for (let i = doc.parts.length - 1; i >= 0; i--) {
          const p = doc.parts[i], t = S.TIPOS[p.type];
          if (t.cat !== cat) continue;
          const c = UI.caja(doc, p);
          if (!c) continue;
          if (cat === 'leads') { if (Math.hypot(pt.x - c.cx, pt.y - c.cy) < 6) return { tipo: 'pieza', id: p.id }; continue; }
          const m = cat === 'dip' ? 1 : 0;
          if (pt.x < c.x - m || pt.x > c.x + c.w + m || pt.y < c.y - m || pt.y > c.y + c.h + m) continue;
          let ctl = null;
          if (p.type === 'slide') ctl = 'slide';
          else if (S.esPulsador(p.type)) ctl = 'boton';
          else if (p.type === 'pot') ctl = Math.hypot(pt.x - (c.x + c.w / 2), pt.y - (c.y + c.h / 2 - 2)) < 9 ? 'pot' : null;
          else if (t.sw) {
            for (let k = 0; k < t.sw; k++) {
              const q = S.posClave(doc, S.huella(p).find(h => h.pin === k + 1).clave);
              if (Math.abs(pt.x - q.x) < 4.5) { ctl = 'dip'; return { tipo: 'pieza', id: p.id, ctl, i: k }; }
            }
          }
          return { tipo: 'pieza', id: p.id, ctl };
        }
      }
      for (let i = doc.boards.length - 1; i >= 0; i--) {
        const b = doc.boards[i];
        if (pt.x >= b.x && pt.x <= b.x + UI.anchoPestana(b) && pt.y >= b.y - 17 && pt.y <= b.y - 2) return { tipo: 'pestana', id: b.id };
      }
      const h = this.agujeroEn(pt);
      if (h) return Object.assign({ tipo: 'agujero' }, h);
      const b = this.tableroEn(pt);
      if (b) return { tipo: 'tablero', id: b.id };
      return null;
    }
    claveDeToque(t) {
      if (!t) return null;
      if (t.tipo === 'agujero' || t.tipo === 'borne') return t.clave;
      return null;
    }
    // Red eléctrica bajo el puntero (para la punta lógica y el resaltado).
    redDeToque(t) {
      if (!t) return -1;
      if (t.tipo === 'agujero' || t.tipo === 'borne') return this.motor.redDeClave(t.clave);
      if (t.tipo === 'cable') { const w = this.doc.wires.find(x => x.id === t.id); return w ? this.motor.redDeClave(w.a) : -1; }
      return -1;
    }
    get redResaltada() {
      if (this.redFijada >= 0) return this.redFijada;
      if (this.herr === 'punta' && this.hover) return this.redDeToque(this.hover);
      return -1;
    }
    // Redes que se destacan: la medida con la punta lógica o las de los pines de la pieza seleccionada.
    // Las redes de alimentación no se destacan por selección, porque tienen cientos de cables.
    redesFoco() {
      const n = this.redResaltada;
      if (n >= 0) return new Set([n]);
      if (!this.sel || this.sel.tipo !== 'pieza') return null;
      const p = this.doc.parts.find(q => q.id === this.sel.id);
      if (!p || p.type === 'fuente') return null;
      const m = this.motor, set = new Set();
      for (const h of S.huella(p)) {
        const r = m.redDePin(p.id, h.pin);
        if (r >= 0 && !m.fDrv[r].length) set.add(r);
      }
      return set;
    }
    resalteTiras() {
      const m = new Map();
      const add = (clave, color) => {
        const i = clave.indexOf('/');
        if (i < 0) return;
        const b = clave.slice(0, i), tira = clave.slice(i + 1);
        if (!m.has(b)) m.set(b, []);
        m.get(b).push({ tira, color });
      };
      const n = this.redResaltada;
      if (n >= 0) {
        const v = this.motor.valorRed(n);
        const c = UI.colorValor(v);
        for (const k of this.motor.nodosDeRedCache(n)) if (!k.includes('#') && !k.includes(':')) add(k, c + '55');
      }
      const h = this.hover;
      if (h && h.tipo === 'agujero' && (this.herr === 'cable' || this.herr === 'seleccionar' || this.colocar)) add(`${h.tablero.id}/${geo.tira(h.fila, h.col)}`, 'rgba(77,163,255,0.22)');
      return m;
    }

    // ------------------------------------------------------------------ Edición
    rolLibre(tipo) {
      const usados = new Set(this.doc.parts.map(p => p.rol).filter(Boolean));
      const paso = S.diseno.pasos[this.pasoGuia - 1];
      const r = paso && paso.roles.find(id => S.diseno.roles.get(id).tipo === tipo && !usados.has(id));
      return r || null;
    }
    iniciarColocacion(tipo, props = {}, rol) {
      this.cancelar();
      if (tipo === 'fuente' && this.doc.parts.some(p => p.type === 'fuente')) {
        const f = this.doc.parts.find(p => p.type === 'fuente');
        this.aviso('Ya hay una fuente en el banco. Te llevo a ella.');
        return this.irAPieza(f.id);
      }
      const r = rol === undefined ? this.rolLibre(tipo) : rol;
      this.colocar = { tipo, props, rol: r, etapa: 0, primera: null };
      const t = S.TIPOS[tipo];
      const nombre = r ? S.diseno.roles.get(r).nombre : t.nombre;
      if (t.cat === 'leads') this.ayuda(tipo === 'led' ? `${nombre}: haz clic en el agujero del ánodo (+), la pata larga` : `${nombre}: haz clic en el agujero de la primera pata`);
      else if (t.cat === 'dip') this.ayuda(`${nombre}: colócalo cruzando el canal central. R lo gira 180°. Esc cancela`);
      else this.ayuda(`${nombre}: haz clic donde quieras ponerlo. Esc cancela`);
      this.marcarHerramienta();
    }
    candidato(pt) {
      const c = this.colocar, t = S.TIPOS[c.tipo];
      const base = { id: '__nueva', type: c.tipo, rol: c.rol, props: S.propsIniciales(c.tipo, c.props) };
      if (t.cat === 'dip') {
        const b = this.tableroEn(pt, 20);
        if (!b) return null;
        const col = Math.round((pt.x - b.x - 25) / 10) + 1 - Math.floor((t.cols - 1) / 2);
        return Object.assign(base, { at: { board: b.id, col: Math.max(1, Math.min(geo.COLS - t.cols + 1, col)), flip: !!c.flip } });
      }
      if (t.cat === 'inline') {
        const h = this.agujeroEn(pt);
        if (!h || geo.esRiel(h.fila)) return null;
        const col = Math.max(1, Math.min(geo.COLS - t.patas + 1, h.col - Math.floor((t.patas - 1) / 2)));
        return Object.assign(base, { at: { board: h.tablero.id, row: h.fila, col, flip: !!c.flip } });
      }
      if (t.cat === 'libre') return Object.assign(base, { pos: { x: Math.round(pt.x - t.w / 2), y: Math.round(pt.y - t.h / 2) } });
      return null;
    }
    actualizarFantasma(pt) {
      const c = this.colocar;
      if (!c) return;
      const t = S.TIPOS[c.tipo];
      if (t.cat === 'leads') {
        const h = this.agujeroEn(pt);
        const ocup = this.ocupacion();
        const valido = !!h && !ocup.has(h.clave) && h.clave !== c.primera;
        this.fantasma = { punto: h ? S.posClave(this.doc, h.clave) : pt, valido };
        if (c.primera) {
          const a = S.posClave(this.doc, c.primera), b = h ? S.posClave(this.doc, h.clave) : pt;
          const p = { id: '__nueva', type: c.tipo, leads: {}, props: S.propsIniciales(c.tipo, c.props) };
          p.leads[t.pines[0]] = c.primera;
          p.leads[t.pines[1]] = h ? h.clave : c.primera;
          this.fantasma.parte = h ? p : null;
          if (!h) this.fantasma.linea = [a, b];
        }
        return;
      }
      const p = this.candidato(pt);
      if (!p) { this.fantasma = null; return; }
      const v = t.cat === 'libre' ? { ok: true } : S.validarHuella(this.doc, p, this.ocupacion());
      this.fantasma = { parte: p, valido: v.ok, msg: v.msg };
    }
    clicColocar(pt, mantener) {
      const c = this.colocar, t = S.TIPOS[c.tipo];
      if (t.cat === 'leads') {
        const h = this.agujeroEn(pt);
        if (!h) return this.aviso('Haz clic en un agujero de la protoboard');
        if (this.ocupacion().has(h.clave)) return this.aviso('Ese agujero ya tiene algo. Usa otro agujero de la misma tira');
        if (!c.primera) {
          c.primera = h.clave;
          return this.ayuda(c.tipo === 'led' ? 'Ahora el agujero del cátodo (−), la pata corta' : 'Ahora el agujero de la segunda pata');
        }
        if (h.clave === c.primera) return;
        let nuevo = null;
        this.editar(doc => {
          nuevo = { id: S.nuevoId(doc, 'p'), type: c.tipo, rol: c.rol || undefined, leads: { [t.pines[0]]: c.primera, [t.pines[1]]: h.clave }, props: S.propsIniciales(c.tipo, c.props) };
          if (!nuevo.rol) delete nuevo.rol;
          doc.parts.push(nuevo);
        });
        const v = S.validarHuella(this.doc, nuevo, new Map());
        if (v.aviso) this.aviso(v.aviso);
        if (mantener) { c.primera = null; this.ayuda('Siguiente: haz clic en la primera pata'); }
        else { this.cancelar(); this.sel = { tipo: 'pieza', id: nuevo.id }; this.paneles.actualizar(); }
        return;
      }
      const p = this.candidato(pt);
      if (!p) return this.aviso(t.cat === 'dip' ? 'Coloca el chip sobre una protoboard' : 'Coloca la pieza en un agujero de la protoboard');
      if (t.cat !== 'libre') {
        const v = S.validarHuella(this.doc, p, this.ocupacion());
        if (!v.ok) return this.aviso(v.msg === 'Agujero ocupado' ? 'No cabe: alguna pata cae en un agujero ocupado' : v.msg);
      }
      let id = null;
      this.editar(doc => {
        p.id = id = S.nuevoId(doc, 'p');
        if (!p.rol) delete p.rol;
        doc.parts.push(p);
      });
      if (mantener && !p.rol) return;
      this.cancelar();
      this.sel = { tipo: 'pieza', id };
      this.paneles.mostrar('props');
      this.paneles.actualizar();
    }
    // Nueva posición de una pieza que se arrastra.
    moverCandidato(p, pt, ag) {
      const t = S.TIPOS[p.type];
      const q = JSON.parse(JSON.stringify(p));
      const destino = { x: pt.x - ag.dx, y: pt.y - ag.dy };
      if (t.cat === 'libre') { q.pos = { x: Math.round(destino.x), y: Math.round(destino.y) }; return q; }
      if (t.cat === 'dip') {
        const b = this.tableroEn(pt, 20);
        if (!b) return null;
        const col = Math.round((destino.x - b.x - 25) / 10) + 1;
        q.at = { board: b.id, col: Math.max(1, Math.min(geo.COLS - t.cols + 1, col)), flip: p.at.flip };
        return q;
      }
      if (t.cat === 'inline') {
        const h = this.agujeroEn(destino);
        if (!h || geo.esRiel(h.fila)) return null;
        q.at = { board: h.tablero.id, row: h.fila, col: Math.max(1, Math.min(geo.COLS - t.patas + 1, h.col)), flip: p.at.flip };
        return q;
      }
      if (t.cat === 'leads') {
        const a0 = S.posClave(this.doc, p.leads[t.pines[0]]);
        for (const pin of t.pines) {
          const o = S.posClave(this.doc, p.leads[pin]);
          const h = this.agujeroEn({ x: o.x + destino.x - a0.x, y: o.y + destino.y - a0.y });
          if (!h) return null;
          q.leads[pin] = h.clave;
        }
        return q;
      }
      return null;
    }
    borrar(sel) {
      if (!sel) return;
      if (sel.tipo === 'pieza') this.editar(doc => { doc.parts = doc.parts.filter(p => p.id !== sel.id); doc.wires = doc.wires.filter(w => !w.a.startsWith(sel.id + ':') && !w.b.startsWith(sel.id + ':')); });
      else if (sel.tipo === 'cable') this.editar(doc => { doc.wires = doc.wires.filter(w => w.id !== sel.id); });
      else if (sel.tipo === 'tablero') this.borrarTablero(sel.id);
      this.sel = null;
      this.paneles.actualizar();
    }
    borrarTablero(id) {
      const enTablero = k => k && k.startsWith(id + '/');
      const piezas = this.doc.parts.filter(p => (p.at && p.at.board === id) || (p.leads && Object.values(p.leads).some(enTablero)));
      const cables = this.doc.wires.filter(w => enTablero(w.a) || enTablero(w.b));
      if ((piezas.length || cables.length) && !confirm(`La protoboard tiene ${piezas.length} pieza(s) y ${cables.length} cable(s). ¿Borrarla con todo? (Puedes deshacer con Ctrl+Z)`)) return;
      this.editar(doc => {
        const ids = new Set(piezas.map(p => p.id)), cs = new Set(cables.map(w => w.id));
        doc.parts = doc.parts.filter(p => !ids.has(p.id));
        doc.wires = doc.wires.filter(w => !cs.has(w.id));
        doc.boards = doc.boards.filter(b => b.id !== id);
      });
    }
    agregarTablero() {
      let i = 0;
      const ocupado = (x, y) => this.doc.boards.some(b => Math.abs(b.x - x) < geo.W && Math.abs(b.y - y) < geo.H + 40);
      while (ocupado((i % 2) * 720, Math.floor(i / 2) * 270)) i++;
      let nuevo;
      this.editar(doc => {
        const n = doc.boards.length + 1;
        nuevo = { id: S.nuevoId(doc, 'b'), x: (i % 2) * 720, y: Math.floor(i / 2) * 270, nombre: `Protoboard ${n}` };
        doc.boards.push(nuevo);
      });
      this.centrarEn(nuevo.x + geo.W / 2, nuevo.y + geo.H / 2);
      this.aviso(`${nuevo.nombre} agregada. Recuerda unir sus rieles a la fuente`);
    }
    girar() {
      const s = this.sel;
      if (this.colocar) { this.colocar.flip = !this.colocar.flip; if (this.raton) this.actualizarFantasma(this.raton); this.sucio = true; return; }
      if (!s || s.tipo !== 'pieza') return;
      const p = this.doc.parts.find(q => q.id === s.id), t = S.TIPOS[p.type];
      if (t.cat === 'dip' || t.cat === 'inline') {
        const q = JSON.parse(JSON.stringify(p)); q.at.flip = !q.at.flip;
        if (!S.validarHuella(this.doc, q, this.ocupacion(), p.id).ok) return this.aviso('No se puede girar aquí');
        this.editar(doc => { doc.parts.find(x => x.id === p.id).at.flip = q.at.flip; });
      } else if (t.cat === 'leads') {
        this.editar(doc => { const x = doc.parts.find(y => y.id === p.id); const [a, b] = t.pines; [x.leads[a], x.leads[b]] = [x.leads[b], x.leads[a]]; });
        if (p.type === 'led') this.aviso('LED invertido: ánodo y cátodo intercambiados');
      }
    }
    asignarRol(id, rol) {
      this.editar(doc => {
        for (const p of doc.parts) if (rol && p.rol === rol && p.id !== id) delete p.rol;
        const p = doc.parts.find(x => x.id === id);
        if (rol) p.rol = rol; else delete p.rol;
      });
    }
    cargarSolucion(n) {
      const texto = n >= 8 ? 'la computadora completa' : `la solución de los pasos 1 a ${n}`;
      if (this.doc.parts.length > 1 && !confirm(`Esto reemplaza tu armado por ${texto}. Tu trabajo actual se puede recuperar con Deshacer (Ctrl+Z). ¿Continuar?`)) return;
      this.reemplazarDoc(S.autoArmar(n));
      this.aviso(`Cargada ${texto}: ${this.doc.boards.length} protoboards, ${this.doc.parts.length} piezas y ${this.doc.wires.length} cables`);
    }

    // ------------------------------------------------------------------ Uso de las piezas
    usarControl(t) {
      const p = this.doc.parts.find(x => x.id === t.id);
      if (!p) return;
      if (t.ctl === 'encendido') { this.cambiarEstado(() => { p.props.on = !p.props.on; }); this.aviso(p.props.on ? 'Fuente encendida' : 'Fuente apagada'); }
      else if (t.ctl === 'slide') this.cambiarEstado(() => { p.props.pos = p.props.pos ? 0 : 1; });
      else if (t.ctl === 'dip') this.cambiarEstado(() => { p.props.sw[t.i] = !p.props.sw[t.i]; });
    }
    presionar(id, abajo) {
      this.motor.pausado = this.pausado;
      this.motor.pulsar(id, abajo);
      this.sucio = true;
    }
    moverPot(id, delta) {
      const p = this.doc.parts.find(x => x.id === id);
      if (!p) return;
      this.cambiarEstado(() => { p.props.pos = Math.max(0, Math.min(1, Math.round((p.props.pos + delta) * 100) / 100)); });
      const c = this.motor.comps.find(k => k.def.reloj && k.tiempos && k.tiempos.ok);
      this.ayuda(`Potenciómetro al ${Math.round(p.props.pos * 100)} %${c ? ` · reloj del 555: ${S.hercio(c.tiempos.f)}` : ''}`);
    }
    programar(nombre) {
      const falta = S.faltaParaProgramar(this.doc);
      if (falta.length) return this.aviso(`Para programar con los interruptores falta: ${falta.join(', ')}`);
      const prog = S.PROGRAMAS[nombre];
      this.acciones = { lista: S.accionesProgramar(prog.words), i: 0, prox: 0, nombre, texto: prog.title };
      this.ultimoPrograma = nombre;
      this.aviso(`Cargando «${prog.title}» con los interruptores…`);
    }
    ejecutar() {
      const lista = [{ tipo: 'slide', rol: '2:PROG', pos: 0 }, { tipo: 'esperar', s: 0.05 }, { tipo: 'slide', rol: '2:AUTO', pos: 1 }];
      if (!S.parteDeRol(this.doc, '2:PROG') || !S.parteDeRol(this.doc, '2:AUTO')) return this.aviso('Faltan los interruptores PROG y AUTO');
      this.acciones = { lista, i: 0, prox: 0, texto: 'ejecutar' };
    }
    avanzarAcciones(ahora) {
      const a = this.acciones;
      if (!a || ahora < a.prox) return;
      while (a.i < a.lista.length && ahora >= a.prox) {
        const acc = a.lista[a.i++];
        try {
          this.motor.pausado = this.pausado;
          const s = S.ejecutarAccion(this.doc, this.motor, acc);
          if (acc.texto) this.ayuda(acc.texto);
          if (s) { a.prox = ahora + s * 2000; break; }
        } catch (e) { this.aviso(e.message); this.acciones = null; return; }
      }
      this.verif = S.verificar(this.doc, this.motor);
      this.sucio = true;
      this.guardarLocal();
      if (a.i >= a.lista.length) {
        this.acciones = null;
        if (a.nombre) this.aviso(`Programa cargado. Pulsa «Ejecutar» o pon PROG en 0 y AUTO en 1`);
        this.paneles.actualizar();
      }
    }

    // ------------------------------------------------------------------ Mensajes
    aviso(txt) {
      const el = document.getElementById('aviso');
      el.textContent = txt; el.classList.add('visible');
      clearTimeout(this.tAviso);
      this.tAviso = setTimeout(() => el.classList.remove('visible'), 3200);
    }
    ayuda(txt) { document.getElementById('estadoTexto').textContent = txt; this.textoAyuda = txt; }
    cancelar() {
      this.colocar = null; this.fantasma = null; this.cableNuevo = null;
      this.ayuda('');
      this.marcarHerramienta();
      this.sucio = true;
    }
    cambiarHerramienta(h) {
      this.cancelar();
      this.herr = h;
      if (h !== 'punta') this.redFijada = -1;
      const textos = {
        seleccionar: 'Mover: arrastra piezas; haz clic en interruptores, pulsadores y la fuente para usarlos',
        cable: 'Cable: haz clic en un agujero y luego en otro. Teclas 1 a 8 cambian el color',
        punta: 'Punta lógica: pasa el puntero sobre un agujero para medir; clic para fijar la red',
        borrar: 'Borrar: haz clic en una pieza o un cable'
      };
      this.ayuda(textos[h]);
      this.marcarHerramienta();
    }
    marcarHerramienta() {
      document.querySelectorAll('[data-herr]').forEach(b => b.classList.toggle('activa', b.dataset.herr === this.herr && !this.colocar));
      this.cv.style.cursor = this.colocar ? 'copy' : this.herr === 'cable' ? 'crosshair' : this.herr === 'punta' ? 'help' : this.herr === 'borrar' ? 'not-allowed' : 'default';
    }

    // ------------------------------------------------------------------ Eventos
    eventos() {
      const cv = this.cv;
      window.addEventListener('resize', () => this.redimensionar());
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('mousedown', e => this.abajo(e));
      window.addEventListener('mousemove', e => this.mover(e));
      window.addEventListener('mouseup', e => this.arriba(e));
      cv.addEventListener('mouseleave', () => { this.hover = null; this.ocultarTip(); this.sucio = true; });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        const t = this.tocar(this.aMundo(sx, sy));
        if (t && t.tipo === 'pieza' && t.ctl === 'pot' && !this.colocar) return this.moverPot(t.id, e.deltaY < 0 ? 0.05 : -0.05);
        if (e.ctrlKey || Math.abs(e.deltaY) >= 1 && !e.shiftKey) this.zoom(Math.pow(1.0015, -e.deltaY), sx, sy);
        else { this.cam.x += e.deltaX / this.cam.z; this.cam.y += e.deltaY / this.cam.z; this.sucio = true; }
      }, { passive: false });
      cv.addEventListener('dblclick', e => {
        const t = this.tocar(this.pt(e));
        if (t && t.tipo === 'pieza') { this.sel = { tipo: 'pieza', id: t.id }; this.paneles.mostrar('props'); this.paneles.actualizar(); }
      });
      window.addEventListener('keydown', e => this.tecla(e));
      window.addEventListener('keyup', e => { if (e.code === 'Space') { this.espacio = false; this.marcarHerramienta(); } });
    }
    pt(e) { const r = this.cv.getBoundingClientRect(); return this.aMundo(e.clientX - r.left, e.clientY - r.top); }

    abajo(e) {
      const r = this.cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const pt = this.aMundo(sx, sy);
      this.ocultarTip();
      if (e.button === 1 || e.button === 2 || this.espacio) {
        if (e.button === 2 && (this.colocar || this.cableNuevo)) { this.cancelar(); return; }
        this.arrastre = { tipo: 'pan', sx, sy, cx: this.cam.x, cy: this.cam.y };
        return;
      }
      if (e.button !== 0) return;
      if (this.colocar) return this.clicColocar(pt, e.shiftKey);
      const t = this.tocar(pt);
      if (this.herr === 'cable') return this.clicCable(t, e.shiftKey);
      if (this.herr === 'punta') {
        const n = this.redDeToque(t);
        this.redFijada = n === this.redFijada ? -1 : n;
        this.pinFoco = null;
        this.sucio = true;
        this.paneles.actualizar();
        return;
      }
      if (this.herr === 'borrar') {
        if (t && (t.tipo === 'pieza' || t.tipo === 'cable')) this.borrar({ tipo: t.tipo, id: t.id });
        else if (t && t.tipo === 'pestana') this.borrar({ tipo: 'tablero', id: t.id });
        return;
      }
      // Seleccionar / mover / usar.
      if (!t || t.tipo === 'agujero' || t.tipo === 'tablero') {
        if (this.sel) { this.sel = null; this.paneles.actualizar(); }
        this.redFijada = -1; this.pinFoco = null;
        this.arrastre = { tipo: 'pan', sx, sy, cx: this.cam.x, cy: this.cam.y };
        this.sucio = true;
        return;
      }
      if (t.tipo === 'extremo' || t.tipo === 'extremoCable') { this.arrastre = Object.assign({ sx, sy, movido: false }, t); return; }
      if (t.tipo === 'borne') { this.cambiarHerramienta('cable'); return this.clicCable(t, false); }
      if (t.tipo === 'cable') { this.sel = { tipo: 'cable', id: t.id }; this.paneles.mostrar('props'); this.paneles.actualizar(); this.sucio = true; return; }
      if (t.tipo === 'pestana') {
        const b = this.doc.boards.find(x => x.id === t.id);
        this.sel = { tipo: 'tablero', id: t.id };
        this.arrastre = { tipo: 'tablero', id: t.id, sx, sy, bx: b.x, by: b.y, antes: JSON.stringify(this.doc), movido: false };
        this.paneles.mostrar('props'); this.paneles.actualizar(); this.sucio = true;
        return;
      }
      if (t.tipo === 'pieza') {
        const p = this.doc.parts.find(x => x.id === t.id);
        const ancla = this.anclaPieza(p, pt);
        this.arrastre = { tipo: 'pieza', id: t.id, sx, sy, ctl: t.ctl, i: t.i, ancla, movido: false, y0: sy };
        if (t.ctl === 'boton') {
          if (p.props.mantener) { const rt = this.motor.rt.get(p.id); this.presionar(p.id, !(rt && rt.presionado)); this.arrastre.latch = true; }
          else { this.presionar(p.id, true); this.arrastre.presionado = true; }
        }
        if (!t.ctl || t.ctl === 'pot') {
          const cambio = !this.sel || this.sel.id !== t.id;
          this.sel = { tipo: 'pieza', id: t.id };
          if (cambio) { this.paneles.mostrar('props'); this.paneles.actualizar(); }
        }
        this.sucio = true;
      }
    }
    anclaPieza(p, pt) {
      const t = S.TIPOS[p.type];
      if (t.cat === 'libre') return { dx: pt.x - p.pos.x, dy: pt.y - p.pos.y };
      if (t.cat === 'leads') { const a = S.posClave(this.doc, p.leads[t.pines[0]]); return { dx: pt.x - a.x, dy: pt.y - a.y }; }
      const h = S.huella(p);
      const ref = t.cat === 'dip' ? S.posClave(this.doc, p.at.flip ? h.find(x => x.pin === t.n / 2 + 1).clave : h[0].clave) : S.posClave(this.doc, h[p.at.flip ? h.length - 1 : 0].clave);
      return { dx: pt.x - ref.x, dy: pt.y - ref.y };
    }
    mover(e) {
      const r = this.cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const pt = this.aMundo(sx, sy);
      this.raton = pt;
      const a = this.arrastre;
      if (a) {
        const lejos = Math.hypot(sx - a.sx, sy - a.sy) > UMBRAL;
        if (a.tipo === 'pan') { this.cam.x = a.cx - (sx - a.sx) / this.cam.z; this.cam.y = a.cy - (sy - a.sy) / this.cam.z; this.ocultarTip(); this.sucio = true; return; }
        if (a.tipo === 'tablero') {
          if (!lejos && !a.movido) return;
          a.movido = true;
          const b = this.doc.boards.find(x => x.id === a.id);
          b.x = Math.round((a.bx + (sx - a.sx) / this.cam.z) / 10) * 10; b.y = Math.round((a.by + (sy - a.sy) / this.cam.z) / 10) * 10;
          this.invalidarGeometria();
          this.sucio = true;
          return;
        }
        if (a.tipo === 'pieza') {
          if (a.ctl === 'pot' && (lejos || a.movido)) { a.movido = true; this.moverPot(a.id, (a.y0 - sy) / 150); a.y0 = sy; return; }
          if (!lejos && !a.movido) return;
          if (!a.movido) {
            a.movido = true;
            if (a.presionado) { this.presionar(a.id, false); a.presionado = false; }
            this.arrastrandoId = a.id;
          }
          const p = this.doc.parts.find(x => x.id === a.id);
          const q = this.moverCandidato(p, pt, a.ancla);
          const v = q ? (S.TIPOS[p.type].cat === 'libre' ? { ok: true } : S.validarHuella(this.doc, q, this.ocupacion(), p.id)) : { ok: false };
          this.fantasma = q ? { parte: q, valido: v.ok } : null;
          a.destino = v.ok ? q : null;
          this.sucio = true;
          return;
        }
        if (a.tipo === 'extremo' || a.tipo === 'extremoCable') {
          if (!lejos && !a.movido) return;
          a.movido = true;
          const h = this.agujeroEn(pt);
          const b = a.tipo === 'extremoCable' ? this.tocar(pt) : null;
          let clave = h ? h.clave : null;
          if (b && b.tipo === 'borne' && a.tipo === 'extremoCable') clave = b.clave;
          const ocup = this.ocupacion();
          const o = clave && ocup.get(clave);
          const valido = !!clave && (!o || o.id === a.id);
          this.fantasma = { punto: clave ? S.posClave(this.doc, clave) : pt, valido };
          a.destino = valido ? clave : null;
          this.sucio = true;
          return;
        }
      }
      if (this.colocar) { this.actualizarFantasma(pt); this.sucio = true; }
      const t = this.tocar(pt);
      const cambio = JSON.stringify(t) !== JSON.stringify(this.hover);
      this.hover = t;
      if (cambio) { this.sucio = true; this.describir(t, e); }
      else this.moverTip(e);
      if (this.cableNuevo) this.sucio = true;
    }
    arriba(e) {
      const a = this.arrastre;
      this.arrastre = null;
      if (!a) return;
      if (a.tipo === 'tablero') {
        if (a.movido) { this.historia.push(a.antes); this.rehacerPila = []; this.aplicar(); }
        return;
      }
      if (a.tipo === 'pieza') {
        if (a.presionado) this.presionar(a.id, false);
        if (a.movido && a.ctl !== 'pot') {
          this.arrastrandoId = null;
          this.fantasma = null;
          if (a.destino) {
            const d = a.destino;
            this.editar(doc => { const p = doc.parts.find(x => x.id === a.id); if (d.at) p.at = d.at; if (d.leads) p.leads = d.leads; if (d.pos) p.pos = d.pos; });
          } else this.aviso('Ahí no cabe: la pieza vuelve a su lugar');
        } else if (!a.movido && !a.latch && (a.ctl === 'slide' || a.ctl === 'dip' || a.ctl === 'encendido')) this.usarControl(a);
        this.sucio = true;
        return;
      }
      if (a.tipo === 'extremo' || a.tipo === 'extremoCable') {
        this.fantasma = null;
        if (a.movido && a.destino) {
          this.editar(doc => {
            if (a.tipo === 'extremo') doc.parts.find(x => x.id === a.id).leads[a.pin] = a.destino;
            else doc.wires.find(x => x.id === a.id)[a.ext] = a.destino;
          });
        } else if (a.movido) this.aviso('Suelta el extremo en un agujero libre');
        this.sucio = true;
      }
    }
    clicCable(t, seguir) {
      const clave = t && (t.tipo === 'agujero' || t.tipo === 'borne') ? t.clave : null;
      if (!clave) {
        if (t && t.tipo === 'pieza') return this.aviso('Los cables van en agujeros libres. Usa otro agujero de la misma columna que la pata');
        return this.cableNuevo ? this.cancelarCable() : null;
      }
      const libre = t.tipo === 'borne' || !this.ocupacion().has(clave);
      if (!libre) return this.aviso('Ese agujero ya tiene algo. Usa otro de la misma tira (columna de 5)');
      if (!this.cableNuevo) { this.cableNuevo = clave; this.ayuda('Ahora haz clic en el otro extremo. Clic derecho o Esc cancela'); this.sucio = true; return; }
      if (clave === this.cableNuevo) return;
      const a = this.cableNuevo;
      this.editar(doc => doc.wires.push({ id: S.nuevoId(doc, 'w'), a, b: clave, color: this.colorCable }));
      this.cableNuevo = seguir ? clave : null;
      this.ayuda(seguir ? 'Sigue desde aquí (Shift mantiene el cable)' : 'Cable colocado. Haz clic en otro agujero para empezar el siguiente');
      this.sucio = true;
    }
    cancelarCable() { this.cableNuevo = null; this.sucio = true; this.ayuda(''); }
    tecla(e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') { this.espacio = true; this.cv.style.cursor = 'grab'; e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? this.rehacer() : this.deshacer(); }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return this.rehacer(); }
      if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); return this.descargar(); }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'escape') { this.cancelar(); this.sel = null; this.redFijada = -1; this.pinFoco = null; this.paneles.actualizar(); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); return this.borrar(this.sel); }
      if (k === 'r') return this.girar();
      if (k === 'v') return this.cambiarHerramienta('seleccionar');
      if (k === 'w') return this.cambiarHerramienta('cable');
      if (k === 'p') return this.cambiarHerramienta('punta');
      if (k === 'd') return this.cambiarHerramienta('borrar');
      if (k === 'f') return this.ajustarVista();
      if (/^[1-8]$/.test(k)) { this.colorCable = S.COLORES_CABLE[+k - 1][0]; this.paneles.colores(); this.ayuda(`Color de cable: ${S.COLORES_CABLE[+k - 1][1]}`); }
    }

    // ------------------------------------------------------------------ Información bajo el puntero
    describir(t, e) {
      const html = this.textoToque(t);
      const tip = document.getElementById('tip');
      if (!html) { this.ocultarTip(); if (!this.colocar && !this.cableNuevo) this.ayuda(this.textoAyudaBase || ''); return; }
      tip.innerHTML = html;
      tip.style.display = 'block';
      this.moverTip(e);
    }
    moverTip(e) {
      const tip = document.getElementById('tip');
      if (tip.style.display !== 'block' || !e) return;
      const r = this.escena.getBoundingClientRect();
      let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
      if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 12;
      if (y + tip.offsetHeight > r.height - 8) y = e.clientY - r.top - tip.offsetHeight - 12;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    ocultarTip() { const tip = document.getElementById('tip'); if (tip) tip.style.display = 'none'; }
    textoToque(t) {
      if (!t || this.arrastre) return '';
      const m = this.motor, doc = this.doc, esc = UI.esc;
      const valor = n => n < 0 ? '' : `<div class="v"><i style="background:${UI.colorValor(m.valorRed(n))}"></i>${UI.textoValor(m.valorRed(n))}</div>`;
      if (t.tipo === 'agujero') {
        const o = this.ocupacion().get(t.clave);
        const n = m.redDeClave(t.clave);
        let s = `<b>${esc(t.tablero.nombre || t.tablero.id)}</b> · ${geo.esRiel(t.fila) ? `riel ${t.fila[1] === '+' ? '+ (rojo)' : '− (azul)'} ${t.fila[0] === 'T' ? 'de arriba' : 'de abajo'}` : `fila ${t.fila}, columna ${t.col}`}`;
        if (o && o.tipo === 'pieza') {
          const p = doc.parts.find(x => x.id === o.id);
          s += `<div>${esc(S.nombrePieza(p))} · ${esc(S.nombrePin(p, o.pin))}</div>`;
          const ep = this.verif.estadoPin.get(`${p.id}#${o.pin}`);
          if (ep) s += UI.textoEstadoPin(ep);
        } else if (o && o.tipo === 'cable') s += '<div>Punta de cable</div>';
        return s + valor(n);
      }
      if (t.tipo === 'borne') return `<b>Fuente</b> · borne ${t.pin === '+' ? '+ (rojo)' : '− (negro)'}${valor(m.redDeClave(t.clave))}<div class="g">Haz clic para tirar un cable desde aquí</div>`;
      if (t.tipo === 'cable') { const w = doc.wires.find(x => x.id === t.id); return `<b>Cable</b>${w && w.temporal ? ' temporal' : ''}${valor(m.redDeClave(w.a))}`; }
      if (t.tipo === 'pieza') {
        const p = doc.parts.find(x => x.id === t.id);
        const ty = S.TIPOS[p.type];
        let s = `<b>${esc(S.nombrePieza(p))}</b>`;
        if (p.rol && ty.nombre !== S.nombrePieza(p)) s += ` <span class="g">${esc(ty.nombre)}</span>`;
        if (t.ctl === 'slide') s += `<div class="g">Clic: cambiar a ${p.props.pos ? '0' : '1'}</div>`;
        else if (t.ctl === 'boton') s += `<div class="g">Mantén presionado el botón del ratón para pulsar</div>`;
        else if (t.ctl === 'dip') s += `<div class="g">Clic: interruptor ${t.i + 1} a ${p.props.sw[t.i] ? 'OFF' : 'ON'}</div>`;
        else if (t.ctl === 'pot') s += `<div class="g">Rueda del ratón o arrastra hacia arriba/abajo · ${Math.round(p.props.pos * 100)} %</div>`;
        else if (t.ctl === 'encendido') s += `<div class="g">Clic: ${p.props.on ? 'apagar' : 'encender'}</div>`;
        else s += `<div class="g">Arrastra para mover · doble clic para ver sus pines</div>`;
        return s;
      }
      if (t.tipo === 'pestana') return '<b>Protoboard</b><div class="g">Arrastra la pestaña para mover la protoboard con todo lo que tiene</div>';
      return '';
    }

    // ------------------------------------------------------------------ Bucle
    bucle(ahora) {
      const dt = Math.min(0.1, (ahora - this.ultimoCuadro) / 1000);
      this.ultimoCuadro = ahora;
      this.motor.pausado = this.pausado;
      if (!this.pausado) {
        const t0 = this.motor.t;
        this.motor.avanzar(dt * this.velocidad, 4000);
        if (this.motor.t !== t0) this.cambioSim = true;
      }
      this.avanzarAcciones(ahora);
      const toca = this.sucio || (this.cambioSim && ahora - (this.ultimoDibujo || 0) > 33);
      if (toca) {
        this.dib.dibujar();
        this.sucio = false; this.cambioSim = false; this.ultimoDibujo = ahora;
      }
      if (ahora - this.ultimoVivo > 250) { this.ultimoVivo = ahora; this.paneles.refrescarVivo(false); }
      requestAnimationFrame(t => this.bucle(t));
    }
  }

  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  UI.App = App;
})(globalThis);
