// Paneles HTML: barra de herramientas, paleta de piezas, guía de armado, propiedades y problemas.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo, UI = S.UI;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.esc = esc;
  const $ = id => document.getElementById(id);

  const ESTADO_PIN = {
    ok: ['ok', '✓', 'Conectado bien'], pendiente: ['pend', '·', 'Pendiente: la otra punta es de otro paso o aún no está colocada'],
    falta: ['mal', '✗', 'Falta conectar'], incompleto: ['medio', '◐', 'Conectado en parte: faltan otros pines de la misma señal'],
    corto: ['mal', '⚠', 'En corto con otra señal'], libre: ['medio', '○', 'Entrada sin usar flotante: conviene llevarla a GND'],
    duplicado: ['mal', '⚠', 'Hay otra pieza con la misma función']
  };
  UI.textoEstadoPin = function (ep) {
    const [cls, ico, txt] = ESTADO_PIN[ep.st] || ESTADO_PIN.pendiente;
    if (ep.sinUso) return `<div class="ep ${cls}">${ico} Sin uso en el diseño: va a GND${ep.st === 'ok' ? ' ✓' : ep.st === 'corto' ? ` (está unida a ${esc(ep.unidoA.join(', '))})` : ' (ahora está flotante)'}</div>`;
    return `<div class="ep ${cls}">${ico} Debe ir a <b>${esc(ep.sig)}</b> · ${txt}</div>`;
  };
  const valorHTML = v => `<i class="punto" style="background:${UI.colorValor(v)}"></i>${esc(UI.textoValor(v).split(' (')[0])}`;

  const PALETA = [
    ['Alimentación', [
      { tipo: 'fuente', nombre: 'Fuente de laboratorio', ico: 'fuente' },
      { tipo: '__tablero', nombre: 'Protoboard 830 puntos', ico: 'tablero' }
    ]],
    ['Circuitos integrados', ['7400', '7404', '7408', '7432', '7486', '7474', '7430', '74138', '74151', '74157', '74161', '74283', '74245', '74377', '74374', 'ne555'].map(t => ({ tipo: t, nombre: S.TIPOS[t].nombre, sub: S.TIPOS[t].desc, ico: 'chip' }))],
    ['Interruptores', [
      { tipo: 'dip8', nombre: 'DIP switch 8', ico: 'dip' }, { tipo: 'dip4', nombre: 'DIP switch 4', ico: 'dip' },
      { tipo: 'slide', nombre: 'Interruptor deslizante', ico: 'slide' }, { tipo: 'btnspdt', nombre: 'Pulsador conmutado (SPDT)', ico: 'btn' },
      { tipo: 'btn2', nombre: 'Pulsador de 2 patas', ico: 'btn' }, { tipo: 'pot', nombre: 'Potenciómetro 100 kΩ', ico: 'pot' }
    ]],
    ['LEDs', ['rojo', 'verde', 'amarillo', 'azul', 'blanco'].map(c => ({ tipo: 'led', props: { color: c }, nombre: `LED ${c}`, ico: 'led', color: UI.COLOR_LED[c][0] }))],
    ['Resistencias', [330, 1000, 10000].map(v => ({ tipo: 'res', props: { valor: v }, nombre: `Resistencia ${S.ohm(v)}`, ico: 'res' }))],
    ['Condensadores', [[1e-7, 'desacople'], [1e-6, 'reloj 555'], [1e-8, 'pin 5 del 555']].map(([v, uso]) => ({ tipo: 'cap', props: { valor: v }, nombre: `Condensador ${S.faradio(v)}`, sub: uso, ico: 'cap' }))]
  ];

  class Paneles {
    constructor(app) {
      this.app = app;
      this.pest = 'guia';
      this.barra();
      this.paleta();
      this.colores();
      document.querySelectorAll('[data-pest]').forEach(b => b.addEventListener('click', () => this.mostrar(b.dataset.pest)));
      for (const id of ['pest-guia', 'pest-props', 'pest-diag']) {
        $(id).addEventListener('click', e => this.clic(e));
        $(id).addEventListener('change', e => this.cambio(e));
        $(id).addEventListener('input', e => this.entrada(e));
      }
    }

    barra() {
      const app = this.app;
      document.querySelectorAll('[data-herr]').forEach(b => b.addEventListener('click', () => app.cambiarHerramienta(b.dataset.herr)));
      const acc = {
        nuevo: () => { if (confirm('¿Empezar un proyecto nuevo? El actual se puede recuperar con Deshacer.')) app.reemplazarDoc(S.docInicial()); },
        abrir: () => $('archivo').click(),
        guardar: () => app.descargar(),
        deshacer: () => app.deshacer(),
        rehacer: () => app.rehacer(),
        protoboard: () => app.agregarTablero(),
        ajustar: () => app.ajustarVista(),
        pausa: () => { app.pausado = !app.pausado; $('btnPausa').textContent = app.pausado ? '▶ Seguir' : '⏸ Pausa'; $('btnPausa').classList.toggle('activa', app.pausado); },
        reiniciar: () => { app.motor.reiniciarChips(); app.sucio = true; app.aviso('Chips reiniciados: como apagar y encender. Los registros y la memoria toman valores al azar'); }
      };
      document.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => acc[b.dataset.acc] && acc[b.dataset.acc]()));
      $('archivo').addEventListener('change', e => { if (e.target.files[0]) app.abrirArchivo(e.target.files[0]); e.target.value = ''; });
      $('velocidad').addEventListener('change', e => { app.velocidad = +e.target.value; });
      $('vistaCables').addEventListener('change', e => { app.vistaCables = e.target.value; app.sucio = true; });
      $('verFaltantes').addEventListener('change', e => { app.verFaltantes = e.target.checked; app.sucio = true; });
      $('verValores').addEventListener('change', e => { app.verValores = e.target.checked; app.sucio = true; });
    }
    colores() {
      const c = $('colores'), app = this.app;
      c.innerHTML = S.COLORES_CABLE.map(([col, nom], i) => `<button class="color${col === app.colorCable ? ' activa' : ''}" data-color="${col}" title="${nom} (${i + 1})" style="background:${col}"></button>`).join('');
      c.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { app.colorCable = b.dataset.color; if (app.herr !== 'cable') app.cambiarHerramienta('cable'); this.colores(); }));
    }
    paleta() {
      const el = $('paleta'), app = this.app;
      el.innerHTML = PALETA.map(([cat, items]) => `<h4>${cat}</h4>` + items.map((it, i) =>
        `<button class="item" data-tipo="${it.tipo}" data-props='${JSON.stringify(it.props || {})}' title="${esc(it.sub || (S.TIPOS[it.tipo] || {}).desc || '')}">` +
        `<span class="ico ${it.ico}"${it.color ? ` style="--c:${it.color}"` : ''}>${it.ico === 'chip' ? esc(it.nombre.replace('74LS', '')) : ''}</span>` +
        `<span class="nom">${esc(it.nombre)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')).join('') +
        `<p class="nota">Clic en una pieza y luego en la protoboard. Con Shift colocas varias seguidas. R gira el chip.</p>`;
      el.querySelectorAll('.item').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.tipo === '__tablero') return app.agregarTablero();
        app.iniciarColocacion(b.dataset.tipo, JSON.parse(b.dataset.props));
      }));
    }

    mostrar(p) {
      this.pest = p;
      document.querySelectorAll('[data-pest]').forEach(b => b.classList.toggle('activa', b.dataset.pest === p));
      document.querySelectorAll('.pest').forEach(s => s.classList.toggle('activa', s.id === `pest-${p}`));
      this.actualizar();
    }
    actualizar() {
      this.guia();
      this.props();
      this.diag();
    }
    refrescarVivo(todo) {
      const app = this.app, m = app.motor;
      document.querySelectorAll('[data-vpin]').forEach(el => {
        const [id, pin] = el.dataset.vpin.split('#');
        el.innerHTML = valorHTML(m.valorRed(m.redDePin(id, pin)));
      });
      const cpu = S.leerCPU(app.doc, m);
      document.querySelectorAll('[data-cpu]').forEach(el => {
        const k = el.dataset.cpu, v = cpu[k];
        el.textContent = k === 'FLAGS' ? (v === null ? '—' : S.bin(v, 4)) : k === 'PC' || k === 'MAR' || k === 'FASE' ? (v === null ? '—' : String(v)) : k === 'HALTED' ? (v === null ? '—' : v ? 'sí' : 'no') : `${S.hex(v)}  ${S.bin(v)}`;
      });
      document.querySelectorAll('[data-mem]').forEach(el => { const v = cpu.memoria[+el.dataset.mem]; el.innerHTML = `${S.hex(v)} <small>${esc(S.desensamblar(v))}</small>`; });
      document.querySelectorAll('[data-espera]').forEach(el => {
        const k = el.dataset.espera, prog = S.PROGRAMAS[k];
        const cargado = app.ultimoPrograma === k;
        const okOut = cargado && cpu.OUT === prog.expect.OUT && cpu.HALTED === 1;
        el.className = 'espera ' + (okOut ? 'ok' : cargado ? 'cargado' : '');
        el.textContent = okOut ? '✓ OUT ' + S.hex(cpu.OUT) : cargado ? (cpu.HALTED === 1 ? '✗ OUT ' + S.hex(cpu.OUT) : 'cargado') : '';
      });
      document.querySelectorAll('[data-vivo]').forEach(el => { el.innerHTML = this.vivo(el.dataset.vivo); });
      $('tiempo').textContent = `t = ${m.t.toFixed(2)} s${m.retraso ? ' · lento' : ''}`;
      if (todo || !this.tDiag || performance.now() - this.tDiag > 700) { this.tDiag = performance.now(); this.contarDiag(); if (this.pest === 'diag') this.diag(); }
    }
    vivo(k) {
      const m = this.app.motor;
      if (k === 'corriente') return `${m.corriente().toFixed(2)} A`;
      if (k.startsWith('chip:')) return this.estadoChip(k.slice(5));
      return '';
    }
    contarDiag() {
      const d = this.app.motor.diagnostico();
      const err = d.filter(x => x.nivel === 'error').length, av = d.filter(x => x.nivel === 'aviso').length;
      const v = this.app.verif;
      // En el modo «Cable por cable» el circuito está a medias a propósito: no se muestra el conteo.
      const n = this.app.modoCables ? 0 : err + av + v.cortos.length;
      $('nDiag').textContent = n ? String(n) : '';
      $('nDiag').className = err || v.cortos.length ? 'err' : n ? 'av' : '';
      this.ultDiag = d;
    }

    // Marca el botón «Colocar» de la pieza que se está colocando.
    marcarColocar() {
      const rol = this.app.colocar && this.app.colocar.rol;
      document.querySelectorAll('[data-colocar]').forEach(b => {
        const on = !!rol && b.dataset.colocar === rol;
        b.classList.toggle('colocando', on);
        b.textContent = on ? 'Colocando…' : 'Colocar';
      });
    }

    // ------------------------------------------------------------------ Guía
    guia() {
      const app = this.app, v = app.verif, dis = S.diseno, n = app.pasoGuia;
      const paso = dis.pasos[n - 1], r = v.pasos[n - 1];
      const pct = r.total ? Math.round(100 * r.hechos / r.total) : 100;
      let h = '<div class="pasos">' + v.pasos.map(p => {
        const q = p.total ? Math.round(100 * p.hechos / p.total) : 100;
        return `<button data-paso="${p.n}" class="${p.n === n ? 'activa' : ''} ${p.completo ? 'hecho' : ''}" title="${esc(dis.pasos[p.n - 1].titulo)} · ${q} %"><b>${p.n}</b><span style="width:${q}%"></span></button>`;
      }).join('') + '</div>';
      h += `<h2>Paso ${n} · ${esc(paso.titulo)}</h2>`;
      const textoPct = n === 8 ? (r.completo ? '✓ La computadora está completa: ya puedes cargar programas' : 'Termina los pasos 1 a 7 para cargar programas')
        : r.completo ? '✓ Paso completo' : `${pct} % · ${r.hechos} de ${r.total} puntos revisados`;
      h += `<div class="barra-prog"><span style="width:${pct}%"></span></div><div class="pct">${textoPct}</div>`;
      h += `<p>${esc(paso.desc)}</p>`;
      for (const nota of paso.notas) h += `<div class="nota-paso">${esc(nota)}</div>`;
      if (r.roles.length) {
        h += '<h3>Piezas del paso</h3><ul class="lista">';
        for (const x of r.roles) {
          const listo = x.id && x.cuenta.ok + x.cuenta.pendiente === x.pines;
          const ico = !x.id ? '<i class="st no">○</i>' : x.cuenta.corto ? '<i class="st mal">⚠</i>' : listo ? '<i class="st ok">✓</i>' : '<i class="st medio">◐</i>';
          const det = !x.id ? 'sin colocar' : `${x.cuenta.ok + x.cuenta.pendiente}/${x.pines} pines${x.cuenta.falta ? ` · faltan ${x.cuenta.falta}` : ''}${x.cuenta.incompleto ? ` · ${x.cuenta.incompleto} a medias` : ''}${x.cuenta.corto ? ` · ${x.cuenta.corto} en corto` : ''}`;
          h += `<li>${ico}<span class="txt">${esc(x.nombre)}<small>${esc(S.TIPOS[x.tipo].nombre)} · ${det}</small></span>` +
            (x.id ? `<button data-ir="${x.id}">Ver</button>` : `<button class="prim" data-colocar="${esc(x.rol)}">Colocar</button>`) + '</li>';
        }
        h += '</ul>';
      }
      const revs = r.revisiones;
      if (revs.length) {
        h += '<h3>Resistencias, condensadores, LEDs y revisiones</h3><ul class="lista">';
        for (const x of revs) {
          const ico = x.st === 'ok' ? '<i class="st ok">✓</i>' : x.st === 'pendiente' ? '<i class="st no">·</i>' : x.st === 'aviso' ? '<i class="st medio">!</i>' : '<i class="st mal">✗</i>';
          let boton = '';
          if (x.st !== 'ok' && x.st !== 'pendiente') {
            const d = x.def;
            if (d.tipo === 'res') boton = `<button data-pasivo="res" data-valor="${d.valor}">+ ${S.ohm(d.valor)}</button>`;
            else if (d.tipo === 'cap') boton = `<button data-pasivo="cap" data-valor="${d.valor}">+ ${S.faradio(d.valor)}</button>`;
            else if (d.tipo === 'led') boton = `<button data-pasivo="led" data-color="${dis.colorLed(d.sig)}">+ LED</button>`;
            else if (d.tipo === 'fuente' && !S.parteDeRol(app.doc, '1:FUENTE')) boton = `<button class="prim" data-colocar="1:FUENTE">Colocar</button>`;
            else if (d.tipo === 'fuente') boton = `<button data-ir="${S.parteDeRol(app.doc, '1:FUENTE').id}">Ver</button>`;
            else if (d.tipo === 'rieles' && !app.doc.boards.length) boton = `<button data-acc2="protoboard">+ Protoboard</button>`;
          }
          if (x.ids && x.ids.length) boton += `<button data-ir="${x.ids[0]}">Ver</button>`;
          h += `<li>${ico}<span class="txt">${esc(x.msg)}</span>${boton}</li>`;
        }
        h += '</ul>';
      }
      if (r.cortos.length) {
        h += `<h3 class="mal">Cortos entre señales (${r.cortos.length})</h3><ul class="lista">`;
        for (const c of r.cortos.slice(0, 20)) {
          const pin = c.pines[0];
          h += `<li><i class="st mal">⚠</i><span class="txt"><b>${esc(c.senales.join(' + '))}</b> están unidas<small>${esc(c.pines.slice(0, 4).map(m => this.descPin(m)).join(' · '))}${c.pines.length > 4 ? ' …' : ''}</small></span><button data-foco="${pin.id}#${pin.pin}">Ver</button></li>`;
        }
        h += '</ul>';
      }
      const faltan = r.faltan;
      if (faltan.length) {
        h += `<h3>Conexiones que faltan (${faltan.length})</h3><ul class="lista compacta">`;
        faltan.slice(0, 60).forEach(f => {
          h += `<li data-falta="${f.a.id}#${f.a.pin}|${f.b.id}#${f.b.pin}"><i class="st mal">↔</i><span class="txt"><b>${esc(f.sig)}</b><small>${esc(this.descPin(f.a))} ↔ ${esc(this.descPin(f.b))}</small></span></li>`;
        });
        if (faltan.length > 60) h += `<li class="g">… y ${faltan.length - 60} más</li>`;
        h += '</ul>';
      }
      if (r.libres.length) {
        h += `<h3>Entradas sin usar (${r.libres.length})</h3><p class="g">No cambian el resultado (una entrada TTL al aire se lee como 1), pero en la protoboard es mejor llevarlas a GND para evitar ruido.</p><ul class="lista compacta">`;
        for (const e of r.libres.slice(0, 30)) h += `<li><i class="st medio">○</i><span class="txt">${esc(this.descPin(e))}${e.st === 'corto' ? ' · está unida a otra señal' : ''}</span><button data-foco="${e.id}#${e.pin}">Ver</button></li>`;
        h += '</ul>';
      }
      if (n === 8) h += this.panelProgramas();
      h += `<h3>Prueba</h3><p>${esc(paso.prueba)}</p>`;
      if (n > 1 && v.temporales.length) h += `<div class="nota-paso">Cables temporales detectados: ${esc([...new Set(v.temporales.map(t => t.join(' a ')))].join(', '))}. Quítalos al armar el paso 7.</div>`;
      h += this.mapaTableros();
      h += `<div class="acciones"><button data-sol="${n}">Ver solución hasta el paso ${n}</button><button data-acc2="ajustar">Ajustar vista</button></div>`;
      h += `<p class="g">«Ver solución» arma todo automáticamente (reemplaza tu armado; Ctrl+Z lo recupera). Sirve para comparar con lo tuyo.</p>`;
      $('pest-guia').innerHTML = h;
      this.marcarColocar();
    }
    // Qué módulo lleva cada protoboard (según las secciones del armado, o según las piezas con función).
    contenidoTablero(b) {
      const doc = this.app.doc, dis = S.diseno;
      const secs = (doc.secciones || []).filter(s => s.board === b.id);
      const pasos = new Map();
      for (const s of secs) if (s.lado === 'modulo') pasos.set(s.paso, s);
      if (!secs.length) {
        for (const p of doc.parts) {
          const R = p.rol && dis.roles.get(p.rol);
          if (R && ((p.at && p.at.board === b.id) || (p.leads && Object.values(p.leads).some(k => k.startsWith(b.id + '/'))))) pasos.set(R.paso, { paso: R.paso, texto: `Paso ${R.paso} · ${dis.pasos[R.paso - 1].titulo}` });
        }
      }
      const chips = doc.parts.filter(p => p.at && p.at.board === b.id && p.rol).map(p => S.diseno.roles.get(p.rol)).filter(Boolean)
        .map(R => R.label.replace(/^74LS(\d+) /, '$1 ').replace(/ \(latch SR\)/, ''));
      const leds = secs.filter(s => s.detalle).map(s => s.texto);
      return { pasos: [...pasos.values()].sort((a, b) => a.paso - b.paso), chips, leds };
    }
    mapaTableros() {
      const doc = this.app.doc;
      if (doc.boards.length < 2) return '';
      let h = `<details class="mapa"${this.mapaAbierto ? ' open' : ''}><summary>Mapa de las protoboards (${doc.boards.length})</summary><ul class="lista">`;
      for (const b of doc.boards) {
        const c = this.contenidoTablero(b);
        const mods = c.pasos.map(s => `<span class="mod" style="--c:${UI.COLOR_PASO[s.paso]}">${esc(s.texto.replace(/^Paso (\d) · /, '$1 · '))}</span>`).join(' ');
        h += `<li><span class="txt"><b>${esc((b.nombre || b.id).split(' · ')[0])}</b> ${mods}<small>${esc(c.chips.join(', '))}${c.leds.length ? ` · ${esc(c.leds.join(', '))}` : ''}</small></span><button data-tablero="${b.id}">Ver</button></li>`;
      }
      return h + '</ul></details>';
    }
    panelProgramas() {
      const app = this.app;
      const falta = S.faltaParaProgramar(app.doc);
      let h = '<h3>Programas</h3>';
      if (falta.length) h += `<div class="nota-paso">Para cargar programas con los interruptores falta: ${esc(falta.join(', '))}.</div>`;
      h += '<ul class="lista programas">';
      for (const [k, p] of Object.entries(S.PROGRAMAS)) {
        h += `<li><span class="txt"><b>${esc(p.title)}</b><small>${p.words.map(w => S.hex(w)).join(' ')} · OUT esperado ${S.hex(p.expect.OUT)}</small></span><span class="espera" data-espera="${k}">✓</span><button class="prim" data-prog="${k}">Cargar</button></li>`;
      }
      h += '</ul><div class="acciones"><button class="prim" data-ejecutar="1">Ejecutar (PROG 0, AUTO 1)</button></div>';
      h += '<p class="g">Para ir instrucción por instrucción: pon AUTO en 0 y pulsa PASO cuatro veces por instrucción (fases T0 a T3).</p>';
      h += '<h3>Estado de la CPU</h3><table class="cpu">';
      for (const [k, nom] of [['PC', 'PC'], ['FASE', 'Fase (T0-T3)'], ['IR', 'IR'], ['MAR', 'MAR'], ['MDR', 'MDR'], ['A', 'A'], ['B', 'B'], ['OUT', 'OUT'], ['FLAGS', 'Banderas V N C Z'], ['HALTED', 'Detenida (HLT)']]) h += `<tr><td>${nom}</td><td data-cpu="${k}" class="mono"></td></tr>`;
      h += '</table><table class="cpu mem"><tr><td colspan="2">Memoria</td></tr>';
      for (let i = 0; i < 8; i++) h += `<tr><td>${i}</td><td data-mem="${i}" class="mono"></td></tr>`;
      return h + '</table><p class="g">Los valores salen del estado interno de cada chip. En la protoboard real solo ves los registros que tienen LEDs.</p>';
    }
    descPin(m) {
      const p = this.app.doc.parts.find(x => x.id === m.id);
      return p ? `${S.nombrePieza(p)} ${S.nombrePin(p, m.pin)}` : '';
    }

    // ------------------------------------------------------------------ Propiedades
    props() {
      const app = this.app, el = $('pest-props'), s = app.sel;
      if (!s) {
        el.innerHTML = `<p class="g">Selecciona una pieza, un cable o una protoboard para ver sus datos. Con la punta lógica (P) mides cualquier agujero.</p>` + this.ayudaTeclas();
        return;
      }
      if (s.tipo === 'cable') return this.propsCable(el, s.id);
      if (s.tipo === 'tablero') return this.propsTablero(el, s.id);
      const p = app.doc.parts.find(x => x.id === s.id);
      if (!p) { el.innerHTML = ''; return; }
      const t = S.TIPOS[p.type], dis = S.diseno;
      let h = `<h2>${esc(S.nombrePieza(p))}</h2><p class="g">${esc(t.nombre)} · ${esc(t.desc || '')}</p>`;
      const roles = [...dis.roles.values()].filter(r => r.tipo === p.type);
      if (roles.length && p.type !== 'fuente') {
        const usados = new Map(app.doc.parts.filter(q => q.rol && q.id !== p.id).map(q => [q.rol, q]));
        h += `<label class="campo">Función en el diseño<select data-rol="${p.id}"><option value="">— sin función (pieza libre) —</option>` +
          roles.map(r => `<option value="${esc(r.id)}"${p.rol === r.id ? ' selected' : ''}>Paso ${r.paso} · ${esc(r.nombre)}${usados.has(r.id) ? ' (ya usada)' : ''}</option>`).join('') + '</select></label>';
        if (!p.rol) h += '<p class="g">Asígnale una función para que la guía revise sus conexiones.</p>';
      }
      h += `<div data-vivo="chip:${p.id}">${this.estadoChip(p.id)}</div>`;
      h += this.controles(p);
      h += this.tablaPines(p);
      h += `<div class="acciones">${t.cat !== 'libre' ? '<button data-girar="1">Girar (R)</button>' : ''}<button data-borrar="1" class="peligro">Borrar</button></div>`;
      el.innerHTML = h;
    }
    estadoChip(id) {
      const app = this.app, m = app.motor, p = app.doc.parts.find(x => x.id === id);
      if (!p) return '';
      const c = m.comp(id), e = m.estado(id);
      if (e.quemado) return `<div class="nota-paso mal">Quemado: ${esc(e.quemado)}. Bórralo y coloca otro.</div>`;
      if (p.type === 'fuente') return `<p>Consumo estimado del circuito: <b data-vivo="corriente">${m.corriente().toFixed(2)} A</b> <span class="g">(valores típicos de datasheet; en la protoboard puede variar)</span></p>`;
      if (p.type === 'led') {
        const l = m.leds.find(x => x.part.id === id), st = l && m.estadoLed(l);
        return st ? `<p>${st.on ? '💡 Encendido' : 'Apagado'}${st.reves ? ' · <span class="mal">al revés</span>' : ''}${st.sinR ? ' · <span class="medio">sin resistencia</span>' : ''}</p>` : '';
      }
      if (!c) return '';
      if (!c.alimentado) return '<p class="medio">Sin alimentación: revisa VCC y GND.</p>';
      const st = c.st;
      if (p.type === '74374') return `<p>Contenido: <b class="mono">${S.hex(st.q)} · ${S.bin(st.q)}</b> <span class="g">(${esc(S.desensamblar(st.q))})</span></p>`;
      if (p.type === '74377') return `<p>Valor guardado: <b class="mono">${S.hex(st.q)} · ${S.bin(st.q)}</b></p>`;
      if (p.type === '74161') return `<p>Cuenta: <b class="mono">${st.q} (${S.bin(st.q, 4)})</b></p>`;
      if (p.type === '7474') return `<p>Flip-flop 1: Q = <b>${st.q[0]}</b> · Flip-flop 2: Q = <b>${st.q[1]}</b></p>`;
      if (p.type === 'ne555') {
        const ti = c.tiempos;
        return ti && ti.ok ? `<p>Oscila a <b>${S.hercio(ti.f)}</b> <span class="g">R1 = ${S.ohm(ti.R1)}, R2 = ${S.ohm(ti.R2)}, C = ${S.faradio(ti.C)}</span></p>` : `<p class="medio">No oscila: ${esc(ti ? ti.msg : '')}</p>`;
      }
      return '<p class="ok">Alimentado</p>';
    }
    controles(p) {
      const t = S.TIPOS[p.type];
      let h = '';
      if (p.type === 'fuente') {
        h += `<label class="campo"><input type="checkbox" data-prop="on" ${p.props.on ? 'checked' : ''}> Encendida</label>`;
        h += `<label class="campo">Voltaje (V)<input type="number" step="0.1" min="0" max="15" value="${p.props.volts}" data-prop="volts"></label>`;
        h += `<label class="campo">Límite de corriente (A)<input type="number" step="0.1" min="0.1" max="5" value="${p.props.limite}" data-prop="limite"></label>`;
        h += '<p class="g">Los 74LS trabajan entre 4.75 y 5.25 V. Por encima de 7 V se queman.</p>';
      } else if (p.type === 'res') {
        h += `<label class="campo">Valor<select data-prop="valor">${[100, 220, 330, 470, 1000, 2200, 4700, 10000, 47000, 100000].map(v => `<option value="${v}"${v === p.props.valor ? ' selected' : ''}>${S.ohm(v)}</option>`).join('')}</select></label>`;
      } else if (p.type === 'cap') {
        h += `<label class="campo">Valor<select data-prop="valor">${[1e-9, 1e-8, 1e-7, 1e-6, 1e-5].map(v => `<option value="${v}"${Math.abs(v - p.props.valor) < v * 1e-3 ? ' selected' : ''}>${S.faradio(v)}</option>`).join('')}</select></label>`;
      } else if (p.type === 'led') {
        h += `<label class="campo">Color<select data-prop="color">${Object.keys(UI.COLOR_LED).map(c => `<option${c === p.props.color ? ' selected' : ''}>${c}</option>`).join('')}</select></label>`;
        h += '<p class="g">Girar (R) intercambia el ánodo y el cátodo.</p>';
      } else if (p.type === 'pot') {
        h += `<label class="campo">Posición <b>${Math.round(p.props.pos * 100)} %</b> · ${S.ohm(p.props.valor * p.props.pos)} entre 1 y 2<input type="range" min="0" max="1" step="0.01" value="${p.props.pos}" data-prop="pos"></label>`;
      } else if (t.sw) {
        h += '<div class="campo">Interruptores (también puedes hacer clic sobre ellos)<div class="sws">' + p.props.sw.map((on, i) => `<label><input type="checkbox" data-sw="${i}" ${on ? 'checked' : ''}>${i + 1}</label>`).join('') + '</div></div>';
      } else if (p.type === 'slide') {
        h += `<label class="campo"><input type="checkbox" data-prop="pos" ${p.props.pos ? 'checked' : ''}> En posición 1 (común unido a la pata 1)</label>`;
      } else if (S.esPulsador(p.type)) {
        h += `<label class="campo"><input type="checkbox" data-prop="mantener" ${p.props.mantener ? 'checked' : ''}> Enclavado: cada clic lo deja presionado o lo suelta</label>`;
      }
      return h;
    }
    tablaPines(p) {
      const app = this.app, t = S.TIPOS[p.type];
      const R = p.rol && S.diseno.roles.get(p.rol);
      const pines = S.huella(p).map(h => h.pin).sort((a, b) => (+a || 0) - (+b || 0));
      let h = '<h3>Pines</h3><table class="pines"><tr><th>Pin</th><th>Nombre</th><th>Debe ir a</th><th>Valor</th></tr>';
      for (const pin of pines) {
        const ep = app.verif.estadoPin.get(`${p.id}#${pin}`);
        const esperado = R && R.nets[pin] !== undefined ? R.nets[pin] : (S.CHIPS[p.type] && S.CHIPS[p.type].ent.includes(+pin) && R ? 'GND (sin uso)' : '');
        const [cls, ico] = ep ? (ESTADO_PIN[ep.st] || ESTADO_PIN.pendiente) : ['', ''];
        const nombre = t.nombres ? t.nombres[pin] : '';
        h += `<tr data-foco="${p.id}#${pin}" class="fila-pin"><td>${esc(pin)}</td><td>${esc(nombre || '')}</td><td class="${cls}">${ico} ${esc(esperado)}</td><td data-vpin="${p.id}#${pin}"></td></tr>`;
      }
      return h + '</table><p class="g">Clic en una fila para resaltar la red de ese pin y sus conexiones pendientes.</p>';
    }
    propsCable(el, id) {
      const w = this.app.doc.wires.find(x => x.id === id);
      if (!w) { el.innerHTML = ''; return; }
      const desc = k => { const x = geo.leerClave(k); if (!x) return k; if (!x.agujero) return `Fuente, borne ${x.pin}`; const b = S.tablero(this.app.doc, x.tablero); return `${b ? b.nombre : x.tablero} · ${geo.esRiel(x.fila) ? `riel ${x.fila}` : `${x.fila}${x.col}`}`; };
      el.innerHTML = `<h2>Cable${w.temporal ? ' temporal' : ''}</h2><p>${esc(desc(w.a))} → ${esc(desc(w.b))}</p>` +
        `<p data-vpin="${id}#x"></p>` +
        `<label class="campo">Color<select data-cable-color="${id}">${S.COLORES_CABLE.map(([c, n]) => `<option value="${c}"${c === w.color ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` +
        '<p class="g">Selecciona el cable y arrastra uno de sus extremos (círculo) para cambiarlo de agujero.</p>' +
        '<div class="acciones"><button data-borrar="1" class="peligro">Borrar cable</button></div>';
      const n = this.app.motor.redDeClave(w.a);
      el.querySelector('[data-vpin]').innerHTML = valorHTML(this.app.motor.valorRed(n));
      el.querySelector('[data-vpin]').removeAttribute('data-vpin');
    }
    propsTablero(el, id) {
      const b = this.app.doc.boards.find(x => x.id === id);
      if (!b) { el.innerHTML = ''; return; }
      el.innerHTML = `<h2>${esc(b.nombre || b.id)}</h2><label class="campo">Nombre<input type="text" value="${esc(b.nombre || '')}" data-tablero-nombre="${id}"></label>` +
        (() => { const c = this.contenidoTablero(b); return c.pasos.length || c.chips.length ? `<h3>Contenido</h3><p>${c.pasos.map(s => `<span class="mod" style="--c:${UI.COLOR_PASO[s.paso]}">${esc(s.texto)}</span>`).join(' ')}</p><p class="g">${esc(c.chips.join(' · '))}</p>${c.leds.length ? `<p class="g">${esc(c.leds.join(' · '))}</p>` : ''}` : ''; })() +
        '<p class="g">830 puntos: 63 columnas de 5 agujeros en cada mitad y 4 rieles. Arriba, el riel + es el interior; abajo, el − es el interior.</p>' +
        '<div class="acciones"><button data-borrar="1" class="peligro">Borrar protoboard</button></div>';
    }
    ayudaTeclas() {
      return `<h3>Controles</h3><table class="teclas">
        <tr><td>Rueda</td><td>Acercar y alejar</td></tr><tr><td>Arrastrar el fondo</td><td>Mover la vista</td></tr>
        <tr><td>V · W · P · D</td><td>Mover · Cable · Punta lógica · Borrar</td></tr><tr><td>1 a 8</td><td>Color del cable</td></tr>
        <tr><td>R</td><td>Girar la pieza</td></tr><tr><td>Supr</td><td>Borrar la selección</td></tr>
        <tr><td>Ctrl+Z · Ctrl+Y</td><td>Deshacer · Rehacer</td></tr><tr><td>F</td><td>Ajustar la vista</td></tr>
        <tr><td>Esc</td><td>Cancelar</td></tr><tr><td>Shift al colocar</td><td>Colocar varias seguidas</td></tr></table>`;
    }

    // ------------------------------------------------------------------ Problemas
    diag() {
      const app = this.app, el = $('pest-diag');
      if (app.modoCables) { el.innerHTML = '<h2>Problemas</h2><p class="g">En el modo «Cable por cable» el circuito está a medias a propósito, así que no se muestran avisos. Vuelve a «Por pasos» para ver los problemas de tu armado.</p>'; return; }
      const d = this.ultDiag || app.motor.diagnostico();
      const v = app.verif;
      let h = '<h2>Problemas eléctricos</h2>';
      if (!d.length) h += '<p class="ok">Sin problemas eléctricos.</p>';
      h += '<ul class="lista">' + d.slice(0, 80).map((x, i) => `<li${x.ids.length ? ` data-ir="${x.ids[0]}"` : ''} class="clic"><i class="st ${x.nivel === 'error' ? 'mal' : x.nivel === 'aviso' ? 'medio' : 'no'}">${x.nivel === 'error' ? '✗' : x.nivel === 'aviso' ? '!' : 'i'}</i><span class="txt">${esc(x.texto)}</span></li>`).join('') + '</ul>';
      if (d.length > 80) h += `<p class="g">… y ${d.length - 80} más.</p>`;
      h += `<h2>Contra el diseño</h2><p>${v.cortos.length ? `<span class="mal">${v.cortos.length} corto(s) entre señales</span>` : 'Sin cortos entre señales.'} ${v.faltan.length} conexión(es) por hacer en las piezas colocadas.</p>`;
      if (v.duplicados.length) h += `<p class="mal">${v.duplicados.length} pieza(s) repiten una función ya usada: cámbiales la función.</p>`;
      el.innerHTML = h;
    }

    // ------------------------------------------------------------------ Eventos de los paneles
    clic(e) {
      const app = this.app, el = e.target.closest('[data-paso],[data-colocar],[data-ir],[data-pasivo],[data-sol],[data-falta],[data-foco],[data-prog],[data-ejecutar],[data-girar],[data-borrar],[data-acc2],[data-tablero]');
      if (!el) return;
      const d = el.dataset;
      if (d.paso) { app.pasoGuia = +d.paso; app.guardarLocal(); app.sucio = true; return this.guia(); }
      if (d.colocar) return app.iniciarColocacion(S.diseno.roles.get(d.colocar).tipo, {}, d.colocar);
      if (d.ir) return app.irAPieza(d.ir);
      if (d.tablero) { this.mapaAbierto = true; return app.irATablero(d.tablero); }
      if (d.pasivo) return app.iniciarColocacion(d.pasivo, d.pasivo === 'led' ? { color: d.color } : { valor: +d.valor }, null);
      if (d.sol) return app.cargarSolucion(+d.sol);
      if (d.prog) return app.programar(d.prog);
      if (d.ejecutar) return app.ejecutar();
      if (d.girar) return app.girar();
      if (d.borrar) return app.borrar(app.sel);
      if (d.acc2 === 'protoboard') return app.agregarTablero();
      if (d.acc2 === 'ajustar') return app.ajustarVista();
      if (d.falta) {
        const [a, b] = d.falta.split('|').map(x => x.split('#'));
        const pa = app.posPin(a[0], a[1]), pb = app.posPin(b[0], b[1]);
        app.pinFoco = { id: a[0], pin: a[1] };
        app.redFijada = app.motor.redDePin(a[0], a[1]);
        app.verFaltantes = true; $('verFaltantes').checked = true;
        if (pa && pb) app.encuadrar(Math.min(pa.x, pb.x), Math.min(pa.y, pb.y), Math.max(pa.x, pb.x), Math.max(pa.y, pb.y), 3);
        return;
      }
      if (d.foco) {
        const [id, pin] = d.foco.split('#');
        app.pinFoco = { id, pin };
        app.redFijada = app.motor.redDePin(id, pin);
        const q = app.posPin(id, pin);
        if (q && el.tagName !== 'TR') app.centrarEn(q.x, q.y, Math.max(app.cam.z, 2.5));
        app.sucio = true;
      }
    }
    cambio(e) {
      const app = this.app, el = e.target, d = el.dataset;
      const p = app.sel && app.sel.tipo === 'pieza' ? app.doc.parts.find(x => x.id === app.sel.id) : null;
      if (d.rol !== undefined) return app.asignarRol(d.rol, el.value || null);
      if (d.cableColor) return app.editar(doc => { doc.wires.find(w => w.id === d.cableColor).color = el.value; });
      if (d.tableroNombre) return app.editar(doc => { doc.boards.find(b => b.id === d.tableroNombre).nombre = el.value; });
      if (!p) return;
      if (d.sw !== undefined) return app.cambiarEstado(() => { p.props.sw[+d.sw] = el.checked; });
      if (d.prop) {
        const k = d.prop;
        if (k === 'on' || k === 'pos' && p.type === 'slide') app.cambiarEstado(() => { p.props[k] = el.checked ? (k === 'pos' ? 1 : true) : (k === 'pos' ? 0 : false); });
        else if (k === 'mantener') app.editar(() => { p.props.mantener = el.checked; });
        else if (k === 'volts' || k === 'limite') app.cambiarEstado(() => { p.props[k] = Math.max(0, +el.value || 0); });
        else if (k === 'valor') app.editar(() => { p.props.valor = +el.value; });
        else if (k === 'color') app.editar(() => { p.props.color = el.value; });
        else if (k === 'pos') app.cambiarEstado(() => { p.props.pos = +el.value; });
        this.props();
      }
    }
    entrada(e) {
      const el = e.target, app = this.app;
      if (el.dataset.prop === 'pos' && el.type === 'range' && app.sel) {
        const p = app.doc.parts.find(x => x.id === app.sel.id);
        app.cambiarEstado(() => { p.props.pos = +el.value; });
        const b = el.parentElement.querySelector('b');
        if (b) b.textContent = `${Math.round(p.props.pos * 100)} %`;
      }
    }
  }
  UI.Paneles = Paneles;
})(globalThis);
