// Dibujo del banco de trabajo en un <canvas>: protoboards, piezas, cables y ayudas visuales.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo, { L, H, Z, X, WL, WH, WX } = S.V;
  const UI = S.UI = S.UI || {};

  const COLOR_LED = {
    rojo: ['#ff3b30', '#5a1612'], verde: ['#34e05a', '#123d1d'], amarillo: ['#ffd60a', '#4d420f'],
    azul: ['#3d8bff', '#13284d'], blanco: ['#f4f7ff', '#4a4d55']
  };
  UI.COLOR_LED = COLOR_LED;
  const BANDAS = ['#111', '#7b3f00', '#d32f2f', '#f57c00', '#f9d71c', '#2e7d32', '#1565c0', '#7b1fa2', '#888', '#fff'];
  function bandas(ohm) {
    const e = Math.floor(Math.log10(ohm)) - 1;
    const d = Math.round(ohm / Math.pow(10, e));
    return [BANDAS[Math.floor(d / 10) % 10], BANDAS[d % 10], BANDAS[Math.max(0, e)] || '#111', '#c9a227'];
  }
  const colorValor = v => v === H ? '#3ff06a' : v === WH ? '#9be7a9' : v === L ? '#2a5c39' : v === WL ? '#4b6b55' : v === X ? '#ff3b30' : v === WX ? '#ff9f1a' : '#7d8590';
  UI.colorValor = colorValor;
  UI.COLOR_PASO = { 1: '#9aa3b1', 2: '#e67e22', 3: '#4da3ff', 4: '#e8c51e', 5: '#3fae4a', 6: '#b07cd8', 7: '#ff6b5a', 8: '#9aa3b1' };
  const medidor = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const anchos = new Map();
  UI.anchoPestana = function (b) {
    const txt = `⠿ ${b.nombre || b.id}`;
    if (!anchos.has(txt)) { medidor.font = '9px system-ui, sans-serif'; anchos.set(txt, Math.ceil(medidor.measureText(txt).width) + 12); }
    return anchos.get(txt);
  };
  UI.textoValor = v => v === H ? '1 · 5 V' : v === WH ? '1 · 5 V (por resistencia)' : v === L ? '0 · 0 V' : v === WL ? '0 · 0 V (por resistencia)' : v === X ? 'CONFLICTO (corto entre 0 y 1)' : v === WX ? 'indefinido (resistencias a 0 y a 1)' : 'flotante (sin conectar; un 74LS la lee como 1)';

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  UI.rr = rr;

  // Caja de una pieza en el mundo (para selección y clics).
  UI.caja = function (doc, p) {
    const t = S.TIPOS[p.type];
    if (t.cat === 'libre') return { x: p.pos.x, y: p.pos.y, w: t.w, h: t.h };
    if (t.cat === 'dip') {
      const b = S.tablero(doc, p.at.board); if (!b) return null;
      const x0 = b.x + geo.colX(p.at.col) - 6, x1 = b.x + geo.colX(p.at.col + t.cols - 1) + 6;
      return { x: x0, y: b.y + geo.FILA_Y.e + 3, w: x1 - x0, h: geo.FILA_Y.f - geo.FILA_Y.e - 6 };
    }
    if (t.cat === 'inline') {
      const b = S.tablero(doc, p.at.board); if (!b) return null;
      const n = t.patas, x0 = b.x + geo.colX(p.at.col) - 7, x1 = b.x + geo.colX(p.at.col + n - 1) + 7;
      const y = b.y + geo.FILA_Y[p.at.row];
      const alto = p.type === 'pot' ? 26 : 18;
      return { x: x0, y: y - alto + 4, w: x1 - x0, h: alto };
    }
    if (t.cat === 'leads') {
      const a = S.posClave(doc, p.leads[t.pines[0]]), b = S.posClave(doc, p.leads[t.pines[1]]);
      if (!a || !b) return null;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      return { x: cx - 7, y: cy - 7, w: 14, h: 14, a, b, cx, cy };
    }
    return null;
  };

  // Puntos de control del cable (curva suave, como un cable de protoboard).
  UI.curvaCable = function (a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 16) return { a, b, c1: a, c2: b, recto: true };
    const k = Math.min(d * 0.16, 36), nx = -dy / d * k, ny = dx / d * k;
    return { a, b, c1: { x: a.x + dx * 0.25 + nx, y: a.y + dy * 0.25 + ny }, c2: { x: a.x + dx * 0.75 + nx, y: a.y + dy * 0.75 + ny } };
  };
  UI.puntoCurva = function (c, t) {
    const u = 1 - t;
    return {
      x: u * u * u * c.a.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.b.x,
      y: u * u * u * c.a.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.b.y
    };
  };

  class Dibujo {
    constructor(app, canvas) { this.app = app; this.cv = canvas; this.ctx = canvas.getContext('2d'); }

    dibujar() {
      const app = this.app, ctx = this.ctx, cam = app.cam, dpr = window.devicePixelRatio || 1;
      const W = this.cv.width, H_ = this.cv.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1a1d23';
      ctx.fillRect(0, 0, W, H_);
      ctx.setTransform(cam.z * dpr, 0, 0, cam.z * dpr, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr);
      const vis = { x0: cam.x, y0: cam.y, x1: cam.x + W / dpr / cam.z, y1: cam.y + H_ / dpr / cam.z };
      this.vis = vis;
      this.cuadricula(vis);
      const doc = app.doc;
      const resaltar = app.resalteTiras();
      for (const b of doc.boards) if (this.visible(b.x - 10, b.y - 30, geo.W + 20, geo.H + 40)) this.tablero(b, resaltar);
      this.notas();
      this.ledsPorId = new Map(app.motor.leds.map(l => [l.part.id, l]));
      const orden = { dip: 0, inline: 1, leads: 2, libre: 3 };
      const partes = [...doc.parts].sort((p, q) => orden[S.TIPOS[p.type].cat] - orden[S.TIPOS[q.type].cat]);
      for (const p of partes) { if (p.id === app.arrastrandoId) continue; this.pieza(p, 1); }
      this.cables();
      if (app.sel && app.sel.tipo === 'pieza' && app.vistaCables !== 'ocultos') {
        const p = doc.parts.find(q => q.id === app.sel.id);
        if (p && p.id !== app.arrastrandoId && S.TIPOS[p.type].cat !== 'libre') this.pieza(p, 1);
      }
      this.faltantes();
      this.seleccion();
      this.fantasma();
    }

    visible(x, y, w, h) { const v = this.vis; return x + w >= v.x0 && x <= v.x1 && y + h >= v.y0 && y <= v.y1; }

    cuadricula(v) {
      const ctx = this.ctx, z = this.app.cam.z;
      if (z < 0.35) return;
      ctx.fillStyle = '#242830';
      const p = 50, r = 1 / z;
      for (let x = Math.floor(v.x0 / p) * p; x < v.x1; x += p) for (let y = Math.floor(v.y0 / p) * p; y < v.y1; y += p) ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }

    // El fondo de la protoboard (cuerpo, rieles, números y agujeros) se dibuja una vez en un lienzo aparte.
    fondoTablero(ctx, escala) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#f2eee3';
      rr(ctx, 0, 0, geo.W, geo.H, 6); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#cdc4ad'; ctx.lineWidth = 1; rr(ctx, 0, 0, geo.W, geo.H, 6); ctx.stroke();
      ctx.fillStyle = '#e1dac8'; ctx.fillRect(8, 101, geo.W - 16, 8);
      ctx.lineWidth = 1.2;
      for (const [y, c] of [[6, '#2f6fd6'], [34, '#d9312b'], [176, '#2f6fd6'], [204, '#d9312b']]) {
        ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(geo.W - 12, y); ctx.stroke();
      }
      ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [y, t, c] of [[14, '−', '#2f6fd6'], [26, '+', '#d9312b'], [184, '−', '#2f6fd6'], [196, '+', '#d9312b']]) {
        ctx.fillStyle = c; ctx.fillText(t, 9, y); ctx.fillText(t, geo.W - 9, y);
      }
      if (escala > 0.55) {
        ctx.fillStyle = '#9b927b'; ctx.font = '5.5px system-ui, sans-serif';
        for (let c = 1; c <= geo.COLS; c++) if (c === 1 || c % 5 === 0) { ctx.fillText(String(c), geo.colX(c), 41); ctx.fillText(String(c), geo.colX(c), 169); }
        for (const f of [...geo.FILAS_ARRIBA, ...geo.FILAS_ABAJO]) { ctx.fillText(f, 12, geo.FILA_Y[f]); ctx.fillText(f, geo.W - 12, geo.FILA_Y[f]); }
      }
      const s = 3.4;
      for (const f of geo.filas) {
        const y = geo.FILA_Y[f], riel = f.length === 2;
        for (let c = 1; c <= geo.COLS; c++) {
          if (riel && !geo.agujeroValido(f, c)) continue;
          const x = geo.colX(c);
          ctx.fillStyle = '#3a3936'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
          if (escala >= 2) { ctx.fillStyle = '#1f1e1c'; ctx.fillRect(x - s / 2 + 0.6, y - s / 2 + 0.6, s - 1.2, s - 1.2); }
        }
      }
    }
    cacheTablero(nivel) {
      if (this._tc && this._tc.nivel === nivel) return this._tc.c;
      const c = document.createElement('canvas');
      c.width = Math.ceil((geo.W + 24) * nivel); c.height = Math.ceil((geo.H + 24) * nivel);
      const x = c.getContext('2d');
      x.scale(nivel, nivel); x.translate(12, 12);
      this.fondoTablero(x, nivel);
      this._tc = { nivel, c };
      return c;
    }
    tablero(b, resaltar) {
      const ctx = this.ctx, z = this.app.cam.z, e = z * (window.devicePixelRatio || 1);
      const nivel = e <= 0.6 ? 0.5 : e <= 1.2 ? 1 : e <= 2.4 ? 2 : e <= 4.8 ? 4 : 0;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (nivel) ctx.drawImage(this.cacheTablero(nivel), -12, -12, geo.W + 24, geo.H + 24);
      else this.fondoTablero(ctx, e);
      const sel = this.app.sel && this.app.sel.tipo === 'tablero' && this.app.sel.id === b.id;
      ctx.fillStyle = sel ? '#3b6fd8' : '#2c313a';
      rr(ctx, 0, -17, UI.anchoPestana(b), 15, 4); ctx.fill();
      ctx.fillStyle = '#d6dbe4'; ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`⠿ ${b.nombre || b.id}`, 6, -9.5);
      this.secciones(b);
      if (resaltar.has(b.id)) {
        for (const { tira, color } of resaltar.get(b.id)) {
          ctx.fillStyle = color;
          if (tira.length === 2) { const y = geo.FILA_Y[tira]; rr(ctx, geo.colX(3) - 5, y - 5, geo.colX(61) - geo.colX(3) + 10, 10, 3); ctx.fill(); }
          else {
            const c = +tira.slice(1), filas = tira[0] === 'U' ? geo.FILAS_ARRIBA : geo.FILAS_ABAJO;
            rr(ctx, geo.colX(c) - 4.5, geo.FILA_Y[filas[0]] - 5, 9, 50, 3); ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // Franjas de módulo encima de la protoboard y rótulos de grupo de LEDs en el canal central.
    secciones(b) {
      const ctx = this.ctx, z = this.app.cam.z;
      const lista = (this.app.doc.secciones || []).filter(s => s.board === b.id);
      if (!lista.length) return;
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const modulos = lista.filter(s => s.lado === 'modulo').sort((x, y) => x.col0 - y.col0);
      for (const s of lista) {
        const x0 = geo.colX(s.col0) - 5, x1 = geo.colX(s.col1) + 5, color = UI.COLOR_PASO[s.paso] || '#9aa3b1';
        if (s.lado === 'modulo') {
          ctx.fillStyle = color;
          ctx.fillRect(x0, -24, x1 - x0, 3);
          ctx.fillRect(x0, -24, 1.5, 6); ctx.fillRect(x1 - 1.5, -24, 1.5, 6);
          ctx.font = `bold ${z < 0.5 ? 14 : 9}px system-ui, sans-serif`;
          // El texto puede pasar del ancho de su franja, pero no llegar a la franja siguiente.
          const sig = modulos[modulos.indexOf(s) + 1];
          const limite = (sig ? geo.colX(sig.col0) - 5 : geo.W) - x0 - 6;
          const opciones = [s.texto, s.texto.replace(' (continúa)', ' (sigue)'), s.texto.replace(/ · .*/, ''), `${s.paso}`];
          const txt = opciones.find(t => ctx.measureText(t).width <= limite) || '';
          if (txt) ctx.fillText(txt, x0, -27);
        } else if (z > 0.9) {
          const arriba = s.lado === 'arriba';
          ctx.font = 'bold 4.6px system-ui, sans-serif';
          const txt = `${arriba ? '▲' : '▼'} ${s.texto}`;
          const w = ctx.measureText(txt).width + 4, y = arriba ? 101.2 : 105.4;
          ctx.fillStyle = 'rgba(20,22,27,0.82)'; rr(ctx, x0, y, w, 6.2, 1.5); ctx.fill();
          ctx.fillStyle = color; ctx.fillText(txt, x0 + 2, y + 4.9);
        }
      }
    }

    notas() {
      const ctx = this.ctx;
      const tam = Math.min(13, 24 / this.app.cam.z);
      ctx.font = `bold ${tam}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      for (const n of this.app.doc.notes || []) { ctx.fillStyle = '#8fb3ff'; ctx.fillText(n.texto, n.x, n.y); }
    }

    // ------------------------------------------------------------------ Piezas
    pieza(p, alfa, invalida, fantasma) {
      const ctx = this.ctx, t = S.TIPOS[p.type], app = this.app;
      const g = app.geometria(p, !fantasma);
      const caja = g.caja;
      if (!caja || !this.visible(caja.x - 30, caja.y - 30, caja.w + 60, caja.h + 60)) return;
      ctx.save();
      ctx.globalAlpha = alfa;
      if (t.cat === 'dip') this.dip(p, t, caja, g);
      else if (t.cat === 'inline') this.linea(p, t, caja, g);
      else if (t.cat === 'leads') this.dosPatas(p, t, caja);
      else if (t.cat === 'libre') this.fuente(p, t, caja);
      if (invalida) { ctx.globalAlpha = 1; ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2 / app.cam.z; ctx.setLineDash([4 / app.cam.z, 3 / app.cam.z]); ctx.strokeRect(caja.x - 3, caja.y - 3, caja.w + 6, caja.h + 6); }
      ctx.restore();
    }

    patasDip(caja, g) {
      const ctx = this.ctx;
      ctx.fillStyle = '#b9bec6';
      for (const { pos: q } of g.pines) {
        if (!q) continue;
        const arriba = q.y < caja.y + caja.h / 2;
        ctx.fillRect(q.x - 2, arriba ? q.y - 2 : caja.y + caja.h, 4, arriba ? caja.y - q.y + 2 : q.y - caja.y - caja.h + 2);
      }
    }

    dip(p, t, caja, g) {
      const ctx = this.ctx, app = this.app, z = app.cam.z;
      if (z > 0.45) this.patasDip(caja, g);
      if (t.sw) return this.dipSwitch(p, t, caja, g);
      const c = app.motor.comp(p.id), e = app.motor.estado(p.id);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      rr(ctx, caja.x + 1, caja.y + 2, caja.w, caja.h, 2); ctx.fill();
      ctx.fillStyle = '#1f2125';
      rr(ctx, caja.x, caja.y, caja.w, caja.h, 2); ctx.fill();
      ctx.fillStyle = '#2b2e33'; ctx.fillRect(caja.x + 1, caja.y + 1, caja.w - 2, 2);
      const flip = p.at.flip, my = caja.y + caja.h / 2;
      ctx.fillStyle = '#0d0e10';
      ctx.beginPath();
      if (!flip) ctx.arc(caja.x, my, 3.6, -Math.PI / 2, Math.PI / 2); else ctx.arc(caja.x + caja.w, my, 3.6, Math.PI / 2, Math.PI * 1.5);
      ctx.fill();
      ctx.fillStyle = '#5b5f66';
      ctx.beginPath(); ctx.arc(flip ? caja.x + caja.w - 4 : caja.x + 4, flip ? caja.y + 4 : caja.y + caja.h - 4, 1.3, 0, 7); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const rol = p.rol && S.diseno.roles.get(p.rol);
      if (z > 0.75) {
        ctx.fillStyle = '#e6e8ec'; ctx.font = `bold ${t.cols <= 4 ? 6 : 7}px system-ui, sans-serif`;
        ctx.fillText(t.nombre, caja.x + caja.w / 2, rol && z > 1.1 ? my - 4 : my);
      }
      if (rol && z > 1.1) {
        ctx.fillStyle = '#8fb3ff'; ctx.font = '5px system-ui, sans-serif';
        if (g.etiqueta === undefined || g.etiquetaRol !== p.rol) {
          let txt = rol.label.replace(/^74LS\d+\s*/, '').replace(/^NE555\s*/, '');
          while (ctx.measureText(txt).width > caja.w - 8 && txt.length > 4) txt = txt.slice(0, -2);
          g.etiqueta = txt || rol.label; g.etiquetaRol = p.rol;
        }
        ctx.fillText(g.etiqueta, caja.x + caja.w / 2, my + 5);
      }
      const color = e.quemado ? '#ff3b30' : c && c.alimentado ? '#3ff06a' : '#555a63';
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(flip ? caja.x + 4 : caja.x + caja.w - 4, flip ? caja.y + caja.h - 4 : caja.y + 4, 1.5, 0, 7); ctx.fill();
      if (e.quemado) {
        ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(caja.x + 3, caja.y + 3); ctx.lineTo(caja.x + caja.w - 3, caja.y + caja.h - 3); ctx.moveTo(caja.x + caja.w - 3, caja.y + 3); ctx.lineTo(caja.x + 3, caja.y + caja.h - 3); ctx.stroke();
      }
      if (app.verValores && z > 1.3 && c) this.valoresPines(c, g);
    }

    valoresPines(c, g) {
      const ctx = this.ctx, m = this.app.motor;
      for (const { pin, pos: q } of g.pines) {
        if (!q) continue;
        const v = m.val[c.pn[pin]];
        ctx.fillStyle = colorValor(v);
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0, 7); ctx.fill();
      }
    }

    dipSwitch(p, t, caja, g) {
      const ctx = this.ctx;
      ctx.fillStyle = '#c0392b';
      rr(ctx, caja.x, caja.y - 2, caja.w, caja.h + 4, 2); ctx.fill();
      const textos = this.app.cam.z > 1.3;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 4.5px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (textos) ctx.fillText('ON', caja.x + 2, caja.y + 1.5);
      for (let i = 0; i < t.sw; i++) {
        const q = g.pines.find(h => h.pin === i + 1).pos;
        const on = p.props.sw[i];
        const y0 = caja.y + 5, alto = caja.h - 8;
        ctx.fillStyle = '#7d1f15'; ctx.fillRect(q.x - 3, y0, 6, alto);
        ctx.fillStyle = '#f4f4f4'; ctx.fillRect(q.x - 2.6, on ? y0 + 0.5 : y0 + alto / 2, 5.2, alto / 2 - 0.5);
        if (!textos) continue;
        ctx.fillStyle = '#ffd8d0'; ctx.font = '4px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(p.at.flip ? t.sw - i : i + 1), q.x, caja.y + caja.h + 0.5);
      }
    }

    linea(p, t, caja, g) {
      const ctx = this.ctx, app = this.app;
      const patas = g.pines.map(h => h.pos);
      ctx.strokeStyle = '#aab0b8'; ctx.lineWidth = 1.4;
      for (const q of patas) { ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x, caja.y + caja.h - 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, caja.x + 1, caja.y + 2, caja.w, caja.h, 2); ctx.fill();
      const cx = caja.x + caja.w / 2, cy = caja.y + caja.h / 2;
      const rol = p.rol && S.diseno.roles.get(p.rol);
      const etiqueta = rol ? rol.label.replace(/^(Pulsador|Interruptor|Potenciómetro)\s*/, '') : '';
      if (p.type === 'slide') {
        ctx.fillStyle = '#30343b'; rr(ctx, caja.x, caja.y + 3, caja.w, caja.h - 6, 2); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#15171a'; ctx.fillRect(caja.x + 4, cy - 2.5, caja.w - 8, 5);
        const on = !!p.props.pos, kx = on ? caja.x + 4 : caja.x + caja.w - 14;
        ctx.fillStyle = '#e3e6ea'; rr(ctx, kx, cy - 4, 10, 8, 1.5); ctx.fill();
        if (app.cam.z > 1) {
          ctx.fillStyle = '#9fa6b2'; ctx.font = 'bold 5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('1', caja.x + 3, caja.y + 1); ctx.fillText('0', caja.x + caja.w - 3, caja.y + 1);
        }
      } else if (p.type === 'btn2' || p.type === 'btnspdt') {
        const pres = app.motor.rt.get(p.id) && app.motor.rt.get(p.id).presionado;
        ctx.fillStyle = '#3a3f47'; rr(ctx, caja.x, caja.y, caja.w, caja.h, 2); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = pres ? '#0f1012' : '#1c1e22';
        ctx.beginPath(); ctx.arc(cx, cy, pres ? 5 : 6, 0, 7); ctx.fill();
        ctx.fillStyle = pres ? '#262a30' : '#4a5059';
        ctx.beginPath(); ctx.arc(cx - 1, cy - 1, pres ? 3 : 4, 0, 7); ctx.fill();
        if (p.type === 'btnspdt' && this.app.cam.z > 0.9) {
          ctx.fillStyle = '#9fa6b2'; ctx.font = '3.6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const ord = p.at.flip ? ['NA', 'C', 'NC'] : ['NC', 'C', 'NA'];
          patas.forEach((q, i) => ctx.fillText(ord[i], q.x, caja.y + caja.h - 2.5));
        }
      } else if (p.type === 'pot') {
        ctx.fillStyle = '#2457a6'; rr(ctx, caja.x, caja.y, caja.w, caja.h, 2); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.arc(cx, cy - 2, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#b5bac2'; ctx.beginPath(); ctx.arc(cx, cy - 2, 6, 0, 7); ctx.fill();
        const ang = (-225 + 270 * p.props.pos) * Math.PI / 180;
        ctx.strokeStyle = '#1e2a3a'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx + Math.cos(ang) * 6, cy - 2 + Math.sin(ang) * 6); ctx.stroke();
      }
      ctx.shadowColor = 'transparent';
      if (etiqueta && this.app.cam.z > 0.8) {
        ctx.fillStyle = '#8fb3ff'; ctx.font = 'bold 6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(etiqueta, cx, caja.y - 1.5);
      }
    }

    dosPatas(p, t, caja) {
      const ctx = this.ctx, { a, b, cx, cy } = caja, z = this.app.cam.z;
      ctx.strokeStyle = '#b3b8bf'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(cx, cy); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#c9ced5';
      for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.5, 0, 7); ctx.fill(); }
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save(); ctx.translate(cx, cy);
      if (p.type === 'res') {
        ctx.rotate(ang);
        ctx.fillStyle = '#e4cf9c'; rr(ctx, -8, -2.8, 16, 5.6, 2.6); ctx.fill();
        if (z > 0.7) bandas(p.props.valor).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-5.2 + i * 2.7 + (i === 3 ? 1.6 : 0), -2.7, 1.3, 5.4); });
      } else if (p.type === 'cap') {
        const grande = p.props.valor >= 1e-6;
        ctx.fillStyle = grande ? '#2d6cdf' : '#d9a53a';
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 4, ang, 0, 7); ctx.fill();
        ctx.shadowColor = 'transparent';
        if (z > 1.6) {
          ctx.fillStyle = grande ? '#e8f0ff' : '#5b3f0c'; ctx.font = 'bold 3.6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const e = Math.round(Math.log10(p.props.valor / 1e-12));
          ctx.fillText(`10${e - 1}`, 0, 0.3);
        }
      } else if (p.type === 'led') {
        const s = this.ledsPorId ? this.ledsPorId.get(p.id) : this.app.motor.leds.find(l => l.part.id === p.id);
        const est = s ? this.app.motor.estadoLed(s) : { on: false };
        const [claro, oscuro] = COLOR_LED[p.props.color] || COLOR_LED.rojo;
        if (est.on) {
          if (!this.brillos) this.brillos = new Map();
          let g = this.brillos.get(claro);
          if (!g) { g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, claro + 'cc'); g.addColorStop(1, claro + '00'); this.brillos.set(claro, g); }
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
        }
        ctx.fillStyle = est.quemado ? '#2a2a2a' : est.on ? claro : oscuro;
        ctx.beginPath(); ctx.arc(0, 0, 4.8, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(-1, -1, 3, Math.PI, Math.PI * 1.5); ctx.stroke();
        // Lado plano del cátodo.
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4.4, -2.4); ctx.lineTo(4.4, 2.4); ctx.stroke();
        if (est.quemado) { ctx.strokeStyle = '#ff3b30'; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, 3); ctx.moveTo(3, -3); ctx.lineTo(-3, 3); ctx.stroke(); }
      }
      ctx.restore();
      if (p.type === 'led' && p.props.etiqueta && z > 1.1) {
        ctx.font = 'bold 3.8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(p.props.etiqueta).width + 3;
        ctx.fillStyle = 'rgba(20,22,27,0.8)'; rr(ctx, cx - w / 2, cy + 5.6, w, 5, 1.2); ctx.fill();
        ctx.fillStyle = '#f2f2f2'; ctx.fillText(p.props.etiqueta, cx, cy + 8.2);
      }
    }

    fuente(p, t, caja) {
      const ctx = this.ctx, app = this.app, m = app.motor, f = m.fuentes.find(x => x.part.id === p.id);
      const pr = p.props, corto = f && f.corto;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, caja.x + 2, caja.y + 4, caja.w, caja.h, 7); ctx.fill();
      ctx.fillStyle = '#3a4049'; rr(ctx, caja.x, caja.y, caja.w, caja.h, 7); ctx.fill();
      ctx.fillStyle = '#2b3037'; rr(ctx, caja.x + 6, caja.y + 6, caja.w - 12, 20, 3); ctx.fill();
      ctx.fillStyle = '#d6dbe4'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('FUENTE DE LABORATORIO', caja.x + 11, caja.y + 16);
      ctx.fillStyle = '#0d1a10'; rr(ctx, caja.x + 10, caja.y + 32, 104, 46, 3); ctx.fill();
      const enc = pr.on;
      const I = enc && !corto ? m.corriente() : 0;
      const V = enc && !corto ? pr.volts : 0;
      ctx.fillStyle = enc ? '#5dff7a' : '#1f3a25'; ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText(`${V.toFixed(2)} V`, caja.x + 16, caja.y + 46);
      ctx.fillStyle = enc ? (corto || I > pr.limite ? '#ff6b4a' : '#ffb340') : '#3a2a12';
      const Ii = corto ? pr.limite : I;
      ctx.fillText(`${Ii.toFixed(Ii < 1 ? 3 : 2)} A`, caja.x + 16, caja.y + 66);
      ctx.font = 'bold 7px system-ui, sans-serif';
      if (enc && (corto || I > pr.limite)) { ctx.fillStyle = '#ff6b4a'; ctx.fillText('CC · LÍMITE', caja.x + 72, caja.y + 66); }
      else if (enc) { ctx.fillStyle = '#5dff7a'; ctx.fillText('CV', caja.x + 98, caja.y + 46); }
      ctx.fillStyle = '#9aa3b1'; ctx.font = '7px system-ui, sans-serif';
      ctx.fillText(`límite ${pr.limite} A`, caja.x + 122, caja.y + 40);
      ctx.fillText(`ajuste ${pr.volts} V`, caja.x + 122, caja.y + 52);
      // Botón de encendido.
      const bx = caja.x + 16, by = caja.y + 96;
      ctx.fillStyle = enc ? '#2bb24c' : '#7a2a24';
      ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, 4, -Math.PI * 0.3, Math.PI * 1.3); ctx.moveTo(bx, by - 5.5); ctx.lineTo(bx, by - 1.5); ctx.stroke();
      ctx.fillStyle = '#c7cdd6'; ctx.font = '7px system-ui, sans-serif'; ctx.fillText(enc ? 'ENCENDIDA' : 'APAGADA', bx + 12, by);
      for (const [pin, [dx, dy]] of Object.entries(t.bornes)) {
        const x = caja.x + dx, y = caja.y + dy;
        ctx.fillStyle = pin === '+' ? '#c62828' : '#16181b';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#c9ced5'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#d6dbe4'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(pin === '+' ? '+' : '−', x, y - 13);
      }
    }

    // ------------------------------------------------------------------ Cables y ayudas
    // Los cables se dibujan por lotes (un trazo por color y transparencia), porque son cientos.
    cables() {
      const ctx = this.ctx, app = this.app, z = app.cam.z;
      if (app.vistaCables === 'ocultos') return;
      const foco = app.redesFoco();
      const base = app.vistaCables === 'translucidos' ? 0.28 : 1;
      const tenue = foco ? Math.min(base, 0.13) : base;
      const v = this.vis, red = app.motor.red;
      const lote = new Map(), destacados = [], temporales = [];
      for (const g of app.geometriaCables()) {
        if (g.w.id === app.arrastrandoCable) continue;
        if (g.x1 < v.x0 || g.x0 > v.x1 || g.y1 < v.y0 || g.y0 > v.y1) continue;
        const sel = app.sel && app.sel.tipo === 'cable' && app.sel.id === g.w.id;
        const guia = g.w.id === app.cableGuiaId;
        if (sel || guia || (foco && g.na >= 0 && foco.has(red[g.na]))) { destacados.push([g, sel, guia]); continue; }
        const color = g.w.color || '#2f6fd6';
        if (!lote.has(color)) lote.set(color, []);
        lote.get(color).push(g);
        if (g.w.temporal) temporales.push(g);
      }
      const camino = lista => {
        ctx.beginPath();
        for (const { c } of lista) { ctx.moveTo(c.a.x, c.a.y); if (c.recto) ctx.lineTo(c.b.x, c.b.y); else ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.b.x, c.b.y); }
      };
      const todos = [].concat(...lote.values());
      // De lejos, un solo trazo por cable; de cerca, borde oscuro, color y brillo.
      const detalle = z >= 1;
      ctx.lineCap = detalle ? 'round' : 'butt';
      ctx.globalAlpha = tenue;
      if (todos.length) {
        if (detalle) { camino(todos); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4.2; ctx.stroke(); }
        for (const [color, lista] of lote) { camino(lista); ctx.strokeStyle = color; ctx.lineWidth = detalle ? 2.9 : 3.2; ctx.stroke(); }
        if (detalle) { camino(todos); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.9; ctx.stroke(); }
        if (temporales.length) { ctx.setLineDash([3, 3]); camino(temporales); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
        if (detalle) {
          ctx.fillStyle = '#c9ced5'; ctx.beginPath();
          for (const { c } of todos) for (const q of [c.a, c.b]) { ctx.moveTo(q.x + 1.7, q.y); ctx.arc(q.x, q.y, 1.7, 0, 7); }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (const [g, sel, guia] of destacados) {
        if (guia) this.halo(g.c);
        this.cable(g.c, g.w.color || '#2f6fd6', !guia, g.w.temporal);
        if (guia) this.anillos(g.c);
      }
      if (app.cableNuevo) {
        const a = S.posClave(app.doc, app.cableNuevo), b = app.raton;
        if (a && b) { ctx.globalAlpha = 0.75; this.cable(UI.curvaCable(a, b), app.colorCable, false); ctx.globalAlpha = 1; }
      }
    }
    // Cable del paso actual del modo «Cable por cable»: halo ámbar y un anillo numerado en cada extremo.
    halo(c) {
      const ctx = this.ctx;
      ctx.save();
      ctx.lineCap = 'round'; ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y);
      if (c.recto) ctx.lineTo(c.b.x, c.b.y); else ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.b.x, c.b.y);
      ctx.stroke();
      ctx.restore();
    }
    anillos(c) {
      const ctx = this.ctx, z = this.app.cam.z, r = Math.max(6, 11 / z), br = r * 0.62;
      ctx.save();
      ctx.lineWidth = Math.max(1.6, 2.2 / z); ctx.strokeStyle = '#ffb340';
      [c.a, c.b].forEach((q, i) => {
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.stroke();
        const bx = q.x - r * 1.05, by = q.y - r * 1.05;
        ctx.fillStyle = '#ffb340'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1d23'; ctx.font = `bold ${br * 1.4}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), bx, by + br * 0.06);
      });
      ctx.restore();
    }
    cable(c, color, resaltado, temporal) {
      const ctx = this.ctx;
      const camino = () => { ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); if (c.recto) ctx.lineTo(c.b.x, c.b.y); else ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.b.x, c.b.y); };
      ctx.lineCap = 'round';
      camino(); ctx.strokeStyle = resaltado ? '#7fd4ff' : 'rgba(0,0,0,0.55)'; ctx.lineWidth = resaltado ? 5.2 : 4.2; ctx.stroke();
      camino(); ctx.strokeStyle = color; ctx.lineWidth = 2.9; ctx.stroke();
      if (temporal) { ctx.setLineDash([3, 3]); camino(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
      camino(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.fillStyle = '#c9ced5';
      for (const q of [c.a, c.b]) { ctx.beginPath(); ctx.arc(q.x, q.y, 1.7, 0, 7); ctx.fill(); }
    }

    faltantes() {
      const app = this.app;
      if (!app.verFaltantes || !app.verif || app.modoCables) return;
      const ctx = this.ctx, doc = app.doc, z = app.cam.z;
      const paso = app.pasoGuia;
      const lista = app.verif.faltan.filter(f => paso >= 8 || S.diseno.roles.get(f.a.rol).paso <= paso || S.diseno.roles.get(f.b.rol).paso <= paso);
      ctx.save();
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.lineWidth = 1.4 / z;
      for (const f of lista) {
        const a = app.posPin(f.a.id, f.a.pin), b = app.posPin(f.b.id, f.b.pin);
        if (!a || !b) continue;
        const foco = app.pinFoco && ((app.pinFoco.id === f.a.id && String(app.pinFoco.pin) === String(f.a.pin)) || (app.pinFoco.id === f.b.id && String(app.pinFoco.pin) === String(f.b.pin)));
        ctx.strokeStyle = foco ? '#ffffff' : 'rgba(255,159,26,0.85)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (z > 0.8) {
          ctx.fillStyle = 'rgba(255,159,26,0.95)'; ctx.font = `${8 / Math.max(z, 1)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(f.sig, (a.x + b.x) / 2, (a.y + b.y) / 2 - 4 / z);
        }
      }
      ctx.restore();
    }

    seleccion() {
      const app = this.app, ctx = this.ctx, z = app.cam.z;
      if (!app.sel || app.sel.tipo !== 'pieza') return;
      const p = app.doc.parts.find(q => q.id === app.sel.id);
      if (!p || p.id === app.arrastrandoId) return;
      const c = UI.caja(app.doc, p);
      if (!c) return;
      ctx.save();
      ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 1.6 / z; ctx.setLineDash([4 / z, 3 / z]);
      ctx.strokeRect(c.x - 4, c.y - 4, c.w + 8, c.h + 8);
      ctx.restore();
      const t = S.TIPOS[p.type];
      if (t.cat === 'leads') {
        ctx.fillStyle = '#4da3ff';
        for (const q of [c.a, c.b]) { ctx.beginPath(); ctx.arc(q.x, q.y, 3 / Math.min(z, 2) + 1, 0, 7); ctx.fill(); }
      }
    }

    fantasma() {
      const app = this.app, g = app.fantasma;
      if (!g) return;
      if (g.parte) this.pieza(g.parte, 0.72, !g.valido, true);
      if (g.punto) {
        const ctx = this.ctx;
        ctx.fillStyle = g.valido ? 'rgba(77,163,255,0.9)' : 'rgba(255,59,48,0.9)';
        ctx.beginPath(); ctx.arc(g.punto.x, g.punto.y, 3.2, 0, 7); ctx.fill();
      }
    }
  }
  UI.Dibujo = Dibujo;
})(globalThis);
