// Modo «Cable por cable»: recorre la computadora de referencia en orden.
//   Paso 1: todas las piezas puestas en las protoboards, sin ningún cable.
//   Pasos 2 en adelante: un cable por paso, en el orden en que conviene cablear (por módulo del plan; en cada módulo,
//   primero la alimentación y luego las señales).
// Es de solo lectura y no toca tu armado: lo guarda aparte y lo devuelve al salir. Los interruptores sí se pueden usar.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo, UI = S.UI, esc = UI.esc;
  const A = UI.App.prototype, P = UI.Paneles.prototype;
  const $ = id => document.getElementById(id);
  const NOMBRES_COLOR = { '#d9312b': 'Rojo', '#1e1e1e': 'Negro', '#e8c51e': 'Amarillo', '#2f6fd6': 'Azul', '#3fae4a': 'Verde', '#e67e22': 'Naranja', '#f2f2f2': 'Blanco', '#8e44ad': 'Morado', '#16a085': 'Turquesa' };

  // ---------------------------------------------------------------- Datos auxiliares
  // Qué pines de piezas hay en cada tira de 5 agujeros (para decir «este cable va al pin 16 del 74LS161»).
  function construirIndice(ref) {
    const tiras = new Map();
    for (const p of ref.parts) {
      if (S.TIPOS[p.type].cat === 'libre') continue;
      for (const h of S.huella(p)) {
        const k = geo.leerClave(h.clave);
        if (!k || !k.agujero || geo.esRiel(k.fila)) continue;
        const clave = `${k.tablero}/${geo.tira(k.fila, k.col)}`;
        if (!tiras.has(clave)) tiras.set(clave, []);
        tiras.get(clave).push({ parte: p, pin: h.pin });
      }
    }
    return tiras;
  }
  // Rangos de pasos de cada módulo del plan: { paso, desde, hasta, n } (desde y hasta son números de paso del modo).
  function resumenModulos(cables) {
    const mods = [];
    cables.forEach((w, i) => {
      let m = mods[mods.length - 1];
      if (!m || m.paso !== w.paso) { m = { paso: w.paso, desde: i + 2, n: 0 }; mods.push(m); }
      m.n++; m.hasta = i + 2;
    });
    return mods;
  }
  const nombreTablero = (doc, id) => { const b = S.tablero(doc, id); return b ? (b.nombre || b.id).split(' · ')[0] : id; };
  const nombreCorto = p => p.type === 'led' ? `LED ${p.props.etiqueta || p.props.color}` : S.nombrePieza(p);
  const textoPin = (p, pin) => `${nombreCorto(p)} · ${S.nombrePin(p, pin)}`;
  const agujeroCorto = clave => { const k = geo.leerClave(clave); return k && k.agujero ? `${k.fila}${k.col}` : clave; };

  // Dónde cae un extremo del cable y qué pines hay en esa tira.
  function extremo(mc, doc, clave) {
    const k = geo.leerClave(clave);
    if (!k || !k.agujero) return { donde: `Borne ${k && k.pin === '+' ? '+ (rojo)' : '− (negro)'} de la fuente`, pines: [] };
    const nb = nombreTablero(doc, k.tablero);
    if (geo.esRiel(k.fila)) return { donde: `${nb} · riel ${k.fila[1] === '+' ? '+ (rojo)' : '− (azul)'} de ${k.fila[0] === 'T' ? 'arriba' : 'abajo'}, columna ${k.col}`, pines: [], riel: true, tablero: k.tablero };
    const lista = mc.tiras.get(`${k.tablero}/${geo.tira(k.fila, k.col)}`) || [];
    return { donde: `${nb} · fila ${k.fila}, columna ${k.col}`, pines: lista.map(x => textoPin(x.parte, x.pin)), tablero: k.tablero };
  }
  // Distancia entre los dos agujeros y largo de cable sugerido (1 agujero = 2.54 mm).
  function largo(doc, w, ea, eb) {
    const a = S.posClave(doc, w.a), b = S.posClave(doc, w.b);
    const huecos = Math.hypot(a.x - b.x, a.y - b.y) / 10;
    const cm = huecos * 0.254;
    const holgura = huecos <= 8 ? 0 : huecos <= 30 ? 1 : 2.5;
    const corte = Math.ceil((cm + 1.4 + holgura) * 2) / 2;
    return { huecos: Math.round(huecos), cm, corte, entreTableros: !!(ea.tablero && eb.tablero && ea.tablero !== eb.tablero) || !ea.tablero || !eb.tablero };
  }
  function paraQue(w, a, b) {
    const que = w.sig === 'VCC' ? '+5 V' : 'GND (tierra)';
    if (w.tipo === 'fuente') return `Lleva ${que} de la fuente al riel de la primera protoboard.`;
    if (w.tipo === 'riel') return w.cadena ? `Pasa ${que} a la siguiente protoboard.` : `Une el riel de arriba con el de abajo de la misma protoboard (${que}).`;
    if (w.tipo === 'alim') return w.sinUso ? `Lleva a GND una entrada que no se usa: ${a.pines.join('; ')}.` : `Lleva ${que} a: ${a.pines.join('; ')}.`;
    return `Une la señal ${w.sig}: ${a.pines.join('; ') || '—'}  con  ${b.pines.join('; ') || '—'}.`;
  }
  const descPieza = (doc, p) => {
    const t = S.TIPOS[p.type], n = nombreCorto(p);
    if (t.cat === 'dip') { const c = p.at.col; return `${n} · columnas ${c} a ${c + t.cols - 1} · pin 1 en f${c}`; }
    if (t.cat === 'inline') return `${n} · fila ${p.at.row}, columnas ${p.at.col} a ${p.at.col + t.patas - 1}`;
    if (p.type === 'led') return `${n} · ánodo (+) en ${agujeroCorto(p.leads.a)}, cátodo (−) en ${agujeroCorto(p.leads.k)}`;
    if (t.cat === 'leads') return `${n} · ${agujeroCorto(p.leads['1'])} y ${agujeroCorto(p.leads['2'])}`;
    return n;
  };
  const enTablero = (p, id) => p.at ? p.at.board === id : p.leads ? Object.values(p.leads).some(k => k.startsWith(id + '/')) : false;
  const colInicial = p => p.at ? p.at.col : Math.min(...Object.values(p.leads).map(k => geo.leerClave(k).col));
  const grupoPieza = p => S.CHIPS[p.type] ? S.CHIPS[p.type].nombre : p.type === 'res' ? `Resistencia ${S.ohm(p.props.valor)}` : p.type === 'cap' ? `Condensador ${S.faradio(p.props.valor)}` : p.type === 'led' ? 'LED' : S.TIPOS[p.type].nombre;

  // ---------------------------------------------------------------- Entrar, salir y moverse
  A.entrarModoCables = function (paso) {
    if (this.modoCables) return;
    this.cancelar();
    this.sel = null; this.redFijada = -1; this.pinFoco = null; this.arrastre = null;
    const ref = S.autoArmar(8);
    const porId = new Map(ref.wires.map(w => [w.id, w]));
    const cables = ref.ordenCables.map(id => porId.get(id));
    ref.wires = [];
    this.modoCables = {
      docUsuario: this.doc, motorUsuario: this.motor, historia: this.historia, rehacer: this.rehacerPila, cam: Object.assign({}, this.cam),
      ref, cables, paso: 1, seguir: true, tiras: construirIndice(ref), modulos: resumenModulos(cables)
    };
    this.historia = []; this.rehacerPila = [];
    this.doc = ref;
    this.normalizar(ref);
    // Con el circuito a medias los lazos de compuertas oscilan; un tope bajo evita perder tiempo en cada paso.
    this.motor = new S.Motor(ref, { semilla: Date.now() & 0xffff, maxIter: 400 });
    this.irAPaso(paso || 1);
    document.body.classList.add('modo-cables');
    this.ayuda('Cable por cable · ← → cambian de paso (Shift: de 10 en 10) · Inicio y Fin van a los extremos');
  };
  A.salirModoCables = function () {
    const mc = this.modoCables;
    if (!mc) return;
    this.cancelar();
    this.modoCables = null;
    this.cableGuiaId = null;
    this.doc = mc.docUsuario; this.motor = mc.motorUsuario;
    this.historia = mc.historia; this.rehacerPila = mc.rehacer;
    this.cam = mc.cam; this.sel = null; this.redFijada = -1; this.pinFoco = null;
    document.body.classList.remove('modo-cables');
    this.aplicar();
    this.ayuda('');
    this.aviso('De vuelta en tu armado');
  };
  A.restaurarModoCables = function () {
    const paso = this.cablesGuardado;
    this.cablesGuardado = null;
    if (paso) this.entrarModoCables(paso);
  };
  A.irAPaso = function (s, camara = true) {
    const mc = this.modoCables;
    if (!mc) return;
    const total = 1 + mc.cables.length;
    s = Math.max(1, Math.min(total, Math.round(+s) || 1));
    mc.paso = s;
    this.doc.wires = mc.cables.slice(0, s - 1);
    this.cableGuiaId = s >= 2 ? mc.cables[s - 2].id : null;
    this.sel = null;
    this.aplicar();
    if (camara && mc.seguir) this.enfocarPaso();
    this.sucio = true;
  };
  // Lleva la cámara al cable de este paso. Si ya se ven los dos extremos con zoom cómodo, no se mueve (evita marear).
  A.enfocarPaso = function () {
    const mc = this.modoCables;
    if (mc.paso === 1) return this.ajustarVista();
    const w = mc.cables[mc.paso - 2];
    const a = S.posClave(this.doc, w.a), b = S.posClave(this.doc, w.b);
    if (!a || !b) return;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const m = 50 / this.cam.z, vx1 = this.cam.x + this.ancho / this.cam.z, vy1 = this.cam.y + this.alto / this.cam.z;
    const dentro = x0 - m >= this.cam.x && x1 + m <= vx1 && y0 - m >= this.cam.y && y1 + m <= vy1;
    if (dentro && this.cam.z >= 1.4) return;
    const z = Math.max(0.3, Math.min(3, this.ancho / (x1 - x0 + 140), this.alto / (y1 - y0 + 140)));
    this.centrarEn((x0 + x1) / 2, (y0 + y1) / 2, z);
  };
  A.teclaCables = function (e, k) {
    const mc = this.modoCables;
    const mov = { arrowright: e.shiftKey ? 10 : 1, arrowleft: e.shiftKey ? -10 : -1, pagedown: 10, pageup: -10 };
    if (k in mov) { e.preventDefault(); this.irAPaso(mc.paso + mov[k]); return true; }
    if (k === 'home') { e.preventDefault(); this.irAPaso(1); return true; }
    if (k === 'end') { e.preventDefault(); this.irAPaso(1 + mc.cables.length); return true; }
    return false;
  };

  // ---------------------------------------------------------------- Paneles
  P.selectorModo = function () {
    const c = !!this.app.modoCables;
    return `<div class="modos"><button data-modo="pasos" class="${c ? '' : 'activa'}">Por pasos (8)</button><button data-modo="cables" class="${c ? 'activa' : ''}">Cable por cable</button></div>`;
  };

  P.guiaCables = function () {
    const app = this.app, mc = app.modoCables, dis = S.diseno, doc = app.doc;
    const n = mc.cables.length, total = n + 1, s = mc.paso;
    const pct = Math.round(100 * (s - 1) / n);
    let h = this.selectorModo();
    h += `<div class="cnav"><div class="cfila">
      <button data-cnav="ini" title="Al principio (Inicio)">⏮</button>
      <button data-cnav="-10" title="10 pasos atrás (Re Pág o Shift+←)">−10</button>
      <button data-cnav="-1" class="grande" title="Paso anterior (←)">◀ Anterior</button>
      <button data-cnav="1" class="prim grande" title="Paso siguiente (→)">Siguiente ▶</button>
      <button data-cnav="10" title="10 pasos adelante (Av Pág o Shift+→)">+10</button>
      <button data-cnav="fin" title="Al final (Fin)">⏭</button></div>
      <div class="cfila"><span>Paso <b>${s}</b> de ${total}</span><div class="barra-prog" style="flex:1"><span style="width:${pct}%"></span></div></div>
      <div class="cfila"><label>Ir al paso <input type="number" min="1" max="${total}" value="${s}" data-cir style="width:70px"></label>
      <label class="chk"><input type="checkbox" data-cseguir ${mc.seguir ? 'checked' : ''}> Seguir con la cámara</label></div></div>`;

    if (s === 1) {
      const piezas = doc.parts.filter(p => p.type !== 'fuente');
      h += '<h2>Paso 1 · Poner las piezas</h2>';
      h += `<p>Coloca las <b>${piezas.length} piezas</b> en las <b>${doc.boards.length} protoboards</b> como se ven, <b>sin ningún cable</b>. La fuente queda aparte. Cuando termines, pulsa <b>Siguiente</b> y sigues cable por cable (<b>${n} cables</b>).</p>`;
      h += '<div class="nota-paso">Los circuitos integrados van <b>cruzando el canal central</b>, con la <b>muesca a la izquierda</b>: el pin 1 queda abajo a la izquierda (fila f) y los pines de arriba, en la fila e. Los LEDs: pata larga (ánodo, +) en el primer agujero que se indica.</div>';
      const grupos = new Map();
      for (const p of piezas) { const g = grupoPieza(p); grupos.set(g, (grupos.get(g) || 0) + 1); }
      const porNombre = (x, y) => x[0].localeCompare(y[0], 'es', { numeric: true });
      const chips = [...grupos].filter(([g]) => /^(74LS|NE555)/.test(g)).sort(porNombre);
      const otros = [...grupos].filter(([g]) => !/^(74LS|NE555)/.test(g)).sort(porNombre);
      const totalChips = chips.reduce((a, [, c]) => a + c, 0);
      h += `<h3>Resumen de piezas</h3><table class="cpu"><tr><td colspan="2"><b>Circuitos integrados: ${totalChips}</b></td></tr>` +
        chips.map(([g, c]) => `<tr><td>${esc(g)}</td><td class="mono">× ${c}</td></tr>`).join('') +
        `<tr><td colspan="2"><b>Otras piezas</b></td></tr>` + otros.map(([g, c]) => `<tr><td>${esc(g)}</td><td class="mono">× ${c}</td></tr>`).join('') + '</table>';
      h += '<h3>Dónde va cada pieza</h3>';
      for (const b of doc.boards) {
        const lista = piezas.filter(p => enTablero(p, b.id)).sort((x, y) => colInicial(x) - colInicial(y));
        h += `<details class="mapa"><summary>${esc(b.nombre || b.id)} · ${lista.length} piezas</summary><ul class="lista compacta">` +
          lista.map(p => `<li><span class="txt">${esc(descPieza(doc, p))}</span></li>`).join('') + '</ul></details>';
      }
    } else {
      const w = mc.cables[s - 2];
      const mod = dis.pasos[w.paso - 1];
      const ea = extremo(mc, doc, w.a), eb = extremo(mc, doc, w.b);
      const lg = largo(doc, w, ea, eb);
      const color = NOMBRES_COLOR[w.color] || w.color;
      const m = mc.modulos.find(x => x.paso === w.paso);
      const lis = e => e.pines.length ? `<ul>${e.pines.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
      h += `<h2>Cable ${s - 1} de ${n}</h2>`;
      h += `<div class="cabecera-cable"><span class="muestra" style="background:${esc(w.color)}"></span><b>${esc(color)}</b> · señal <b>${esc(w.sig)}</b>${w.sig === 'VCC' ? ' (+5 V)' : w.sig === 'GND' ? ' (tierra)' : ''}</div>`;
      h += `<div class="extremo"><span class="num">1</span><div><b>${esc(ea.donde)}</b>${lis(ea)}</div></div>`;
      h += '<div class="flecha">↓</div>';
      h += `<div class="extremo"><span class="num">2</span><div><b>${esc(eb.donde)}</b>${lis(eb)}</div></div>`;
      h += `<p class="para">${esc(paraQue(w, ea, eb))}</p>`;
      h += `<table class="cpu"><tr><td>Módulo</td><td>Paso ${w.paso} · ${esc(mod.titulo)} <span class="g">(cable ${s - m.desde + 1} de ${m.n})</span></td></tr>` +
        `<tr><td>Distancia</td><td>${lg.huecos} agujeros (${lg.cm.toFixed(1)} cm)</td></tr>` +
        `<tr><td>Corta</td><td>≈ ${lg.corte} cm, con unos 7 mm pelados en cada punta${lg.entreTableros ? '. <span class="g">Aproximado: depende de cómo acomodes las protoboards</span>' : ''}</td></tr></table>`;
      if (w.cadena) h += '<p class="g">Las protoboards se alimentan en cadena. Si al final de la cadena el voltaje baja de 4.75 V, une ese riel directo a la fuente.</p>';
      if (s === m.desde) h += `<div class="nota-paso"><b>Empieza el paso ${w.paso}: ${esc(mod.titulo)}.</b> ${esc(mod.desc)}</div>`;
      if (s === m.hasta) {
        h += `<div class="nota-paso fin"><b>Fin del paso ${w.paso}.</b> Prueba: ${esc(mod.prueba)}${mod.notas.map(t => `<br><span class="g">${esc(t)}</span>`).join('')}</div>`;
      }
    }

    h += '<h3>Ir a un módulo</h3><ul class="lista compacta">';
    h += `<li data-cmod="1"><i class="st ${s === 1 ? 'ok' : 'no'}">${s === 1 ? '▶' : '·'}</i><span class="txt"><b>Poner las piezas</b><small>paso 1 · sin cables</small></span></li>`;
    for (const m of mc.modulos) {
      const aqui = s >= m.desde && s <= m.hasta;
      h += `<li data-cmod="${m.desde}"><i class="st ${aqui ? 'ok' : s > m.hasta ? 'ok' : 'no'}">${aqui ? '▶' : s > m.hasta ? '✓' : '·'}</i><span class="txt"><b>Paso ${m.paso} · ${esc(dis.pasos[m.paso - 1].titulo)}</b><small>pasos ${m.desde} a ${m.hasta} · ${m.n} cables</small></span></li>`;
    }
    h += '</ul>';
    h += '<p class="g">Es una referencia de solo lectura: tu armado no cambia. Sí puedes usar interruptores, pulsadores y la fuente.</p>';
    return h;
  };

  // Envuelve la guía de 8 pasos: le agrega el selector de modo, o la reemplaza por la del modo cable por cable.
  const guiaOriginal = P.guia;
  P.guia = function () {
    if (this.app.modoCables) { $('pest-guia').innerHTML = this.guiaCables(); return; }
    guiaOriginal.call(this);
    $('pest-guia').insertAdjacentHTML('afterbegin', this.selectorModo());
  };
  const clicOriginal = P.clic;
  P.clic = function (e) {
    const el = e.target.closest('[data-modo],[data-cnav],[data-cmod]');
    if (!el) return clicOriginal.call(this, e);
    const app = this.app, d = el.dataset;
    if (d.modo) return d.modo === 'cables' ? app.entrarModoCables() : app.salirModoCables();
    const mc = app.modoCables;
    if (!mc) return;
    if (d.cmod) return app.irAPaso(+d.cmod);
    const v = d.cnav;
    if (v === 'ini') return app.irAPaso(1);
    if (v === 'fin') return app.irAPaso(1 + mc.cables.length);
    return app.irAPaso(mc.paso + (+v));
  };
  const cambioOriginal = P.cambio;
  P.cambio = function (e) {
    const el = e.target, mc = this.app.modoCables;
    if (mc && el.dataset.cir !== undefined) return this.app.irAPaso(+el.value);
    if (mc && el.dataset.cseguir !== undefined) { mc.seguir = el.checked; if (mc.seguir) this.app.enfocarPaso(); return; }
    return cambioOriginal.call(this, e);
  };
})(globalThis);
