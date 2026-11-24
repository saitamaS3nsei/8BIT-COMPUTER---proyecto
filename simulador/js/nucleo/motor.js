// Motor eléctrico-lógico.
// 1. Conectividad: cada tira de la protoboard es un nodo; cables y contactos cerrados unen nodos en redes.
// 2. Valor de cada red: salidas fuertes (chips, fuente); si no hay, el valor que llega por una resistencia.
// 3. Simulación con retardo unitario: en cada iteración se evalúan los chips cuyas entradas cambiaron y
//    sus nuevas salidas se aplican todas juntas en la siguiente (igual que Logisim).
// 4. Tiempo simulado: el NE555 y los rebotes de los pulsadores son eventos con hora.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo;
  const { L, H, Z, X, WL, WH, WX } = S.V;
  const leer = S.leer;
  const MAX_ITER = 3000;

  class Motor {
    constructor(doc, opt = {}) {
      this.doc = doc;
      this.rnd = S.rng(opt.semilla ?? 12345);
      this.rebotes = opt.rebotes ?? true;
      this.t = 0;
      this.ev = [];
      this.seq = 0;
      this.est = new Map();    // estado persistente por pieza (chips o LED quemados)
      this.rt = new Map();     // estado de pulsadores (no se guarda en el documento)
      this.comps = [];
      this.pausado = false;
      this.oscila = false;
      this.retraso = false;
      this.construir();
    }

    estado(id) { if (!this.est.has(id)) this.est.set(id, {}); return this.est.get(id); }

    // ---------------------------------------------------------------- Conectividad
    construir() {
      const doc = this.doc;
      this.partes = new Map(doc.parts.map(p => [p.id, p]));
      this.tableros = new Map(doc.boards.map(b => [b.id, b]));
      const claveNodo = new Map(), nodoClave = [];
      let n = 0;
      const nuevo = k => { claveNodo.set(k, n); nodoClave.push(k); return n++; };
      for (const b of doc.boards) {
        for (let c = 1; c <= geo.COLS; c++) { nuevo(`${b.id}/U${c}`); nuevo(`${b.id}/L${c}`); }
        for (const r of geo.RIELES) nuevo(`${b.id}/${r}`);
      }
      const nodoDe = clave => {
        const k = clave && geo.leerClave(clave);
        if (!k) return -1;
        if (k.agujero) {
          if (!this.tableros.has(k.tablero) || !geo.agujeroValido(k.fila, k.col)) return -1;
          return claveNodo.get(`${k.tablero}/${geo.tira(k.fila, k.col)}`);
        }
        return claveNodo.has(clave) ? claveNodo.get(clave) : -1;
      };
      this.pinNodo = new Map();
      this.listaPines = [];
      for (const p of doc.parts) {
        const t = S.TIPOS[p.type];
        if (!t) continue;
        for (const h of S.huella(p)) {
          let nd = h.borne ? nuevo(h.clave) : nodoDe(h.clave);
          if (nd < 0) nd = nuevo(`${p.id}#${h.pin}`);
          this.pinNodo.set(`${p.id}#${h.pin}`, nd);
          this.listaPines.push({ id: p.id, pin: h.pin, nodo: nd });
        }
      }
      this.claveNodo = claveNodo;
      this.nodoClave = nodoClave;
      this.N = n;
      this.nodoDe = nodoDe;
      const par = new Int32Array(n);
      for (let i = 0; i < n; i++) par[i] = i;
      const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      for (const w of doc.wires) {
        const a = nodoDe(w.a), b = nodoDe(w.b);
        if (a >= 0 && b >= 0) { const ra = find(a), rb = find(b); if (ra !== rb) par[ra] = rb; }
      }
      this.base = new Int32Array(n);
      for (let i = 0; i < n; i++) this.base[i] = find(i);

      const previos = new Map(this.comps.map(c => [c.part.id, c]));
      this.comps = []; this.leds = []; this.res = []; this.caps = []; this.pots = []; this.sws = []; this.fuentes = [];
      const pn = (p, pin) => this.pinNodo.get(`${p.id}#${pin}`);
      for (const p of doc.parts) {
        const t = S.TIPOS[p.type];
        if (!t) continue;
        if (t.chip) {
          const def = S.CHIPS[p.type];
          let c = previos.get(p.id);
          if (!c || c.def !== def) c = { def, st: null, alimentado: false, drv: new Int8Array(def.n + 1).fill(Z), nd: new Int8Array(def.n + 1).fill(Z), tok: 0, tiempos: null };
          c.part = p;
          c.nodos = new Int32Array(def.n + 1);
          for (let i = 1; i <= def.n; i++) c.nodos[i] = pn(p, i);
          c.pn = new Int32Array(def.n + 1);
          c.r = q => leer(this.val[c.pn[q]]);
          c.w = (q, v) => { c.nd[q] = v; };
          this.comps.push(c);
        } else if (p.type === 'led') this.leds.push({ part: p, na: pn(p, 'a'), nk: pn(p, 'k') });
        else if (p.type === 'res') this.res.push({ part: p, n1: pn(p, '1'), n2: pn(p, '2') });
        else if (p.type === 'cap') this.caps.push({ part: p, n1: pn(p, '1'), n2: pn(p, '2') });
        else if (p.type === 'pot') this.pots.push({ part: p, n: [pn(p, 1), pn(p, 2), pn(p, 3)] });
        else if (p.type === 'fuente') this.fuentes.push({ part: p, np: pn(p, '+'), nm: pn(p, '-') });
        if (S.esInterruptor(p.type)) {
          this.sws.push(p);
          if (!this.rt.has(p.id)) this.rt.set(p.id, { c: p.type === 'btnspdt' ? 'nc' : 0, tok: 0, presionado: false });
        }
      }
      for (const id of [...this.est.keys()]) if (!this.partes.has(id)) this.est.delete(id);
      for (const id of [...this.rt.keys()]) if (!this.partes.has(id)) this.rt.delete(id);
      this.enlazar();
    }

    // Une los contactos cerrados de los interruptores y recalcula las redes. Se llama en cada cambio de interruptor.
    enlazar() {
      const n = this.N, par = Int32Array.from(this.base);
      const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      for (const p of this.sws) {
        for (const [a, b] of S.contactos(p, this.rt.get(p.id))) {
          const na = this.pinNodo.get(`${p.id}#${a}`), nb = this.pinNodo.get(`${p.id}#${b}`);
          if (na === undefined || nb === undefined) continue;
          const ra = find(na), rb = find(nb);
          if (ra !== rb) par[ra] = rb;
        }
      }
      const red = new Int32Array(n), idx = new Map();
      for (let i = 0; i < n; i++) { const r = find(i); if (!idx.has(r)) idx.set(r, idx.size); red[i] = idx.get(r); }
      const k = idx.size;
      this.red = red; this.nRedes = k; this._nodosRed = null;
      this.drvC = Array.from({ length: k }, () => []);
      this.drvP = Array.from({ length: k }, () => []);
      this.lect = Array.from({ length: k }, () => []);
      this.vecR = Array.from({ length: k }, () => []);
      this.fDrv = Array.from({ length: k }, () => []);
      this.pinesRed = Array.from({ length: k }, () => []);
      for (const q of this.listaPines) this.pinesRed[red[q.nodo]].push(q);
      for (const c of this.comps) {
        for (let i = 1; i <= c.def.n; i++) c.pn[i] = red[c.nodos[i]];
        for (const p of c.def.pinesSalida) { this.drvC[c.pn[p]].push(c); this.drvP[c.pn[p]].push(p); }
        const vistos = new Set();
        for (const p of c.def.pinesLectura) { const r = c.pn[p]; if (!vistos.has(r)) { vistos.add(r); this.lect[r].push(c); } }
      }
      for (const f of this.fuentes) {
        f.rp = red[f.np]; f.rm = red[f.nm];
        f.corto = f.rp === f.rm;
        this.fDrv[f.rp].push({ f, v: H });
        this.fDrv[f.rm].push({ f, v: L });
      }
      for (const r of this.res) {
        r.r1 = red[r.n1]; r.r2 = red[r.n2];
        if (r.r1 !== r.r2) { this.vecR[r.r1].push(r.r2); this.vecR[r.r2].push(r.r1); }
      }
      this.fuerteA = new Int8Array(k);
      this.val = new Int8Array(k);
      for (let i = 0; i < k; i++) this.fuerteA[i] = this.fuerte(i);
      for (let i = 0; i < k; i++) this.val[i] = this.valor(i);
      this.calcularTiempos();
      this.sucios = new Set(this.comps);
      this.asentar();
    }

    voltaje() {
      let v = 0;
      for (const f of this.fuentes) if (f.part.props.on && !f.corto) v = Math.max(v, f.part.props.volts);
      return v;
    }
    fuenteActiva(f) { return f.part.props.on && !f.corto && f.part.props.volts >= 0.5; }

    fuerte(n) {
      let v = Z;
      const C = this.drvC[n], P = this.drvP[n];
      for (let i = 0; i < C.length; i++) {
        const d = C[i].drv[P[i]];
        if (d === Z) continue;
        if (v === Z) v = d; else if (v !== d) return X;
      }
      for (const { f, v: d } of this.fDrv[n]) {
        if (!this.fuenteActiva(f)) continue;
        if (v === Z) v = d; else if (v !== d) return X;
      }
      return v;
    }
    valor(n) {
      const s = this.fuerteA[n];
      if (s !== Z) return s;
      let w = -1;
      for (const m of this.vecR[n]) {
        const sv = this.fuerteA[m];
        if (sv === L || sv === H) { if (w < 0) w = sv; else if (w !== sv) return WX; }
      }
      return w < 0 ? Z : (w === H ? WH : WL);
    }
    resolver(redes) {
      const cambioFuerte = [];
      for (const n of redes) {
        const s = this.fuerte(n);
        if (s !== this.fuerteA[n]) { this.fuerteA[n] = s; cambioFuerte.push(n); }
      }
      const revisar = new Set(redes);
      for (const n of cambioFuerte) for (const m of this.vecR[n]) revisar.add(m);
      const cambiaron = [];
      for (const n of revisar) {
        const v = this.valor(n);
        if (v !== this.val[n]) { this.val[n] = v; cambiaron.push(n); }
      }
      return cambiaron;
    }

    // ---------------------------------------------------------------- Simulación
    evaluar(c) {
      const def = c.def, val = this.val;
      const vv = val[c.pn[def.vcc]], vg = val[c.pn[def.gnd]];
      const e = this.estado(c.part.id);
      const V = this.voltaje();
      if (!e.quemado) {
        if (vv === L && vg === H) e.quemado = 'Alimentación invertida: VCC a GND y GND a +5 V';
        else if (vv === H && vg === L && V > 7) e.quemado = `Voltaje de ${V.toFixed(1)} V: los 74LS aguantan 7 V como máximo`;
      }
      const ok = !e.quemado && vv === H && vg === L && V >= 4.5;
      if (!ok) {
        if (c.alimentado) { c.alimentado = false; c.st = null; c.tok++; }
        for (const p of def.pinesSalida) c.nd[p] = Z;
        return;
      }
      if (!c.alimentado) {
        c.alimentado = true;
        c.st = def.init ? def.init(this.rnd) : {};
        if (def.reloj) this.iniciar555(c);
      }
      for (const p of def.pinesSalida) c.nd[p] = c.drv[p];
      def.eval(c, c.r, c.w);
    }

    asentar() {
      let it = 0;
      while (this.sucios.size) {
        if (++it > MAX_ITER) { this.oscila = true; this.sucios.clear(); break; }
        const lista = [...this.sucios];
        this.sucios.clear();
        const cambios = [];
        for (const c of lista) {
          this.evaluar(c);
          for (const p of c.def.pinesSalida) if (c.nd[p] !== c.drv[p]) cambios.push(c, p);
        }
        if (!cambios.length) continue;
        const redes = new Set();
        for (let i = 0; i < cambios.length; i += 2) {
          const c = cambios[i], p = cambios[i + 1];
          c.drv[p] = c.nd[p];
          redes.add(c.pn[p]);
        }
        for (const n of this.resolver(redes)) for (const c of this.lect[n]) this.sucios.add(c);
      }
      if (it <= MAX_ITER) this.oscila = false;
      this.iteraciones = it;
    }

    programar(t, fn) {
      const e = { t, s: this.seq++, fn };
      let i = this.ev.length;
      while (i > 0 && (this.ev[i - 1].t > t || (this.ev[i - 1].t === t && this.ev[i - 1].s > e.s))) i--;
      this.ev.splice(i, 0, e);
    }
    avanzar(dt, maxEventos = 20000) {
      const fin = this.t + dt;
      let k = 0;
      while (this.ev.length && this.ev[0].t <= fin) {
        if (++k > maxEventos) { this.retraso = true; this.t = this.ev[0].t; return false; }
        const e = this.ev.shift();
        this.t = Math.max(this.t, e.t);
        e.fn();
      }
      this.t = fin;
      this.retraso = false;
      return true;
    }

    // ---------------------------------------------------------------- NE555
    rutaResistiva(a, b, excluir) {
      const ady = this.adyR;
      const dist = new Map([[a, 0]]);
      const cola = [a];
      while (cola.length) {
        const u = cola.shift();
        if (u === b) return dist.get(u);
        for (const { to, R } of ady.get(u) || []) {
          if (dist.has(to) || excluir.includes(to)) continue;
          dist.set(to, dist.get(u) + R);
          cola.push(to);
        }
      }
      return null;
    }
    calcularTiempos() {
      const ady = new Map();
      const arista = (a, b, R) => {
        if (a === b) return;
        if (!ady.has(a)) ady.set(a, []); if (!ady.has(b)) ady.set(b, []);
        ady.get(a).push({ to: b, R }); ady.get(b).push({ to: a, R });
      };
      for (const r of this.res) arista(r.r1, r.r2, r.part.props.valor);
      for (const p of this.pots) {
        const [a, b, c] = p.n.map(x => this.red[x]), R = p.part.props.valor, pos = p.part.props.pos;
        arista(a, b, R * pos); arista(b, c, R * (1 - pos));
      }
      this.adyR = ady;
      for (const c of this.comps) {
        if (!c.def.reloj) continue;
        const ant = c.tiempos;
        c.tiempos = this.tiempos555(c);
        const cambio = !ant || ant.ok !== c.tiempos.ok || Math.abs((ant.th || 0) - (c.tiempos.th || 0)) > 1e-12 || Math.abs((ant.tl || 0) - (c.tiempos.tl || 0)) > 1e-12;
        if (cambio && c.alimentado) this.iniciar555(c);
      }
    }
    tiempos555(c) {
      const red = i => this.red[c.nodos[i]];
      const vcc = red(8), gnd = red(1), dis = red(7), trig = red(2), thr = red(6);
      if (trig !== thr) return { ok: false, msg: 'Une los pines 2 (TRIG) y 6 (THRES) del NE555' };
      const R1 = this.rutaResistiva(vcc, dis, [trig, gnd]);
      if (R1 === null) return { ok: false, msg: 'Falta R1: una resistencia entre +5 V y el pin 7' };
      const R2 = this.rutaResistiva(dis, trig, [vcc, gnd]);
      if (R2 === null) return { ok: false, msg: 'Falta R2: resistencia (y potenciómetro) entre el pin 7 y los pines 2-6' };
      let C = 0;
      for (const k of this.caps) {
        const a = this.red[k.n1], b = this.red[k.n2];
        if ((a === trig && b === gnd) || (a === gnd && b === trig)) C += k.part.props.valor;
      }
      if (!C) return { ok: false, msg: 'Falta el condensador de temporización entre los pines 2-6 y GND' };
      const th = Math.max(0.693 * (R1 + R2) * C, 2e-5), tl = Math.max(0.693 * R2 * C, 2e-5);
      return { ok: true, R1, R2, C, th, tl, f: 1 / (th + tl), msg: `Oscila a ${S.hercio(1 / (th + tl))}` };
    }
    iniciar555(c) {
      c.tok++;
      const tk = c.tok;
      if (!c.alimentado || !c.tiempos || !c.tiempos.ok) return;
      c.st.out = 1;
      this.sucios.add(c);
      const alternar = () => {
        if (c.tok !== tk || !c.alimentado) return;
        c.st.out ^= 1;
        this.sucios.add(c);
        this.asentar();
        this.programar(this.t + (c.st.out ? c.tiempos.th : c.tiempos.tl), alternar);
      };
      this.programar(this.t + c.tiempos.th, alternar);
    }

    // ---------------------------------------------------------------- Interacción
    // Un pulsador real rebota unos milisegundos. El rebote solo se simula con la simulación en marcha.
    pulsar(id, abajo) {
      const p = this.partes.get(id), rt = this.rt.get(id);
      if (!p || !rt) return;
      rt.presionado = abajo;
      const spdt = p.type === 'btnspdt';
      const final = spdt ? (abajo ? 'no' : 'nc') : (abajo ? 1 : 0);
      const tk = ++rt.tok;
      if (!this.rebotes || this.pausado) { rt.c = final; this.enlazar(); return; }
      const pasos = [];
      let t = 0;
      if (spdt) { pasos.push([0, 'open']); t = 0.0002 + this.rnd() * 0.0003; }
      const otro = spdt ? 'open' : (abajo ? 0 : 1);
      const n = 1 + Math.floor(this.rnd() * 3);
      for (let i = 0; i < n; i++) {
        pasos.push([t, final]); t += 0.0001 + this.rnd() * 0.0004;
        pasos.push([t, otro]); t += 0.0001 + this.rnd() * 0.0004;
      }
      pasos.push([t, final]);
      for (const [dt, estado] of pasos) this.programar(this.t + dt, () => { if (rt.tok !== tk) return; rt.c = estado; this.enlazar(); });
    }
    reiniciarChips() {
      for (const c of this.comps) { c.alimentado = false; c.st = null; c.tok++; c.drv.fill(Z); }
      this.ev = [];
      this.enlazar();
    }

    // ---------------------------------------------------------------- Consultas
    redDeClave(clave) { const n = this.nodoDe(clave); return n < 0 ? -1 : this.red[n]; }
    redDePin(id, pin) { const n = this.pinNodo.get(`${id}#${pin}`); return n === undefined ? -1 : this.red[n]; }
    valorRed(n) { return n < 0 ? Z : this.val[n]; }
    tieneFuente(n, polaridad) { return this.fDrv[n].some(d => d.v === polaridad && this.fuenteActiva(d.f)); }
    comp(id) { return this.comps.find(c => c.part.id === id); }

    nodosDeRed(n) {
      const out = [];
      for (let i = 0; i < this.N; i++) if (this.red[i] === n) out.push(this.nodoClave[i]);
      return out;
    }
    nodosDeRedCache(n) {
      if (!this._nodosRed || this._nodosRed.length !== this.nRedes) {
        this._nodosRed = Array.from({ length: this.nRedes }, () => []);
        for (let i = 0; i < this.N; i++) this._nodosRed[this.red[i]].push(this.nodoClave[i]);
      }
      return this._nodosRed[n] || [];
    }

    estadoLed(l) {
      const e = this.estado(l.part.id);
      const ra = this.red[l.na], rk = this.red[l.nk];
      const va = this.val[ra], vk = this.val[rk];
      const alto = va === H || va === WH, bajo = vk === L || vk === WL;
      const sinR = va === H && vk === L;
      if (!e.quemado && sinR && this.tieneFuente(ra, H) && this.tieneFuente(rk, L)) e.quemado = 'Conectado directo a la fuente sin resistencia';
      return {
        on: !e.quemado && alto && bajo && this.voltaje() >= 2,
        quemado: e.quemado || null,
        reves: (vk === H || vk === WH) && (va === L || va === WL),
        sinR: sinR && !e.quemado
      };
    }

    corriente() {
      let mA = 0;
      for (const c of this.comps) if (c.alimentado) mA += c.def.icc;
      const V = this.voltaje();
      for (const l of this.leds) {
        const s = this.estadoLed(l);
        if (!s.on) continue;
        const ra = this.red[l.na], rk = this.red[l.nk];
        const r = this.res.find(x => x.r1 === rk || x.r2 === rk || x.r1 === ra || x.r2 === ra);
        mA += r ? Math.max(0, (V - 2) / r.part.props.valor * 1000) : 20;
      }
      for (const r of this.res) {
        if (r.r1 === r.r2) continue;
        const a = this.fuerteA[r.r1], b = this.fuerteA[r.r2];
        if ((a === H && b === L) || (a === L && b === H)) mA += V / r.part.props.valor * 1000;
      }
      return mA / 1000;
    }

    describirPin(q) {
      const p = this.partes.get(q.id);
      return p ? `${S.nombrePieza(p)} ${S.nombrePin(p, q.pin)}` : q.id;
    }

    diagnostico() {
      const out = [];
      const add = (nivel, texto, ids = []) => out.push({ nivel, texto, ids });
      if (!this.fuentes.length) add('info', 'No hay fuente de alimentación. Agrégala desde la paleta.');
      for (const f of this.fuentes) {
        const p = f.part.props;
        if (f.corto) add('error', 'Cortocircuito: el + y el − de la fuente están unidos. La fuente entró en límite de corriente.', [f.part.id]);
        else if (!p.on) add('info', 'La fuente está apagada.', [f.part.id]);
        else if (p.volts > 7) add('error', `La fuente está en ${p.volts} V: quema los 74LS (máximo 7 V).`, [f.part.id]);
        else if (p.volts > 5.25 || p.volts < 4.75) add('aviso', `La fuente está en ${p.volts} V. Los 74LS trabajan entre 4.75 y 5.25 V.`, [f.part.id]);
        const I = this.corriente();
        if (p.on && I > p.limite) add('aviso', `El consumo estimado (${I.toFixed(2)} A) supera el límite de la fuente (${p.limite} A).`, [f.part.id]);
      }
      if (this.oscila) add('error', 'El circuito no se estabiliza (oscila). Revisa lazos de compuertas o salidas unidas.');
      for (let n = 0; n < this.nRedes; n++) {
        if (this.val[n] !== X) continue;
        const pines = this.pinesRed[n];
        const ids = [...new Set(pines.map(q => q.id))];
        const fuente = this.fDrv[n].length ? ' (con la fuente)' : '';
        const salidas = this.drvC[n].map((c, i) => c.drv[this.drvP[n][i]] !== Z ? this.describirPin({ id: c.part.id, pin: this.drvP[n][i] }) : null).filter(Boolean);
        add('error', `Conflicto${fuente}: dos salidas fuerzan valores distintos en la misma red. ${salidas.slice(0, 4).join(', ')}${salidas.length > 4 ? '…' : ''}`, ids);
      }
      for (const c of this.comps) {
        const e = this.estado(c.part.id), nombre = S.nombrePieza(c.part);
        if (e.quemado) { add('error', `${nombre} quemado: ${e.quemado}. Bórralo y coloca otro.`, [c.part.id]); continue; }
        if (!c.alimentado) {
          const vv = this.val[c.pn[c.def.vcc]], vg = this.val[c.pn[c.def.gnd]];
          const motivo = [];
          if (vv !== H) motivo.push(`VCC (pin ${c.def.vcc}) ${vv === Z ? 'sin conectar' : vv === L ? 'en 0 V' : 'sin 5 V'}`);
          if (vg !== L) motivo.push(`GND (pin ${c.def.gnd}) ${vg === Z ? 'sin conectar' : vg === H ? 'en 5 V' : 'sin tierra'}`);
          if (!motivo.length) motivo.push('voltaje insuficiente');
          add('aviso', `${nombre} sin alimentación: ${motivo.join(', ')}.`, [c.part.id]);
          continue;
        }
        // Un bus triestado sin nadie activo también queda flotante, y eso es normal: solo se avisa si la
        // entrada no tiene ninguna salida ni la fuente en su red (es decir, si de verdad quedó al aire).
        const libres = c.def.ent.filter(p => { const n = c.pn[p]; return this.val[n] === Z && !this.drvC[n].length && !this.fDrv[n].length; });
        if (libres.length) add('aviso', `${nombre}: ${libres.length === 1 ? 'la entrada' : 'las entradas'} ${libres.join(', ')} ${libres.length === 1 ? 'está flotante y se lee' : 'están flotantes y se leen'} como 1.`, [c.part.id]);
        if (c.def.reloj && c.tiempos && !c.tiempos.ok) add('aviso', `${nombre} no oscila: ${c.tiempos.msg}.`, [c.part.id]);
      }
      for (const l of this.leds) {
        const s = this.estadoLed(l);
        if (s.quemado) add('error', `LED quemado: ${s.quemado}.`, [l.part.id]);
        else if (s.sinR) add('aviso', 'LED sin resistencia en serie: en el montaje real se quema o daña la salida del chip.', [l.part.id]);
        else if (s.reves) add('aviso', 'LED al revés: el ánodo (+) debe ir hacia la señal y el cátodo (−) hacia GND.', [l.part.id]);
      }
      return out;
    }
  }
  S.Motor = Motor;
})(globalThis);
