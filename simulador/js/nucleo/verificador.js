// Compara lo armado con el diseño esperado. Usa la conectividad "en reposo" (interruptores abiertos y
// pulsadores sueltos), porque así está definido el diseño.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo, D = () => S.diseno;

  function push(m, k, v) { if (!m.has(k)) m.set(k, []); m.get(k).push(v); }

  S.verificar = function (doc, motor) {
    const dis = D();
    const base = motor.base;
    const redPin = (id, pin) => { const n = motor.pinNodo.get(`${id}#${pin}`); return n === undefined ? -1 : base[n]; };
    const posPin = (id, pin) => {
      const p = motor.partes.get(id);
      const h = S.huella(p).find(x => String(x.pin) === String(pin));
      return h ? S.posClave(doc, h.clave) : null;
    };

    // 1. Piezas con función asignada.
    const porRol = new Map(), duplicados = [];
    for (const p of doc.parts) {
      const rol = p.type === 'fuente' ? '1:FUENTE' : p.rol;
      if (!rol) continue;
      const R = dis.roles.get(rol);
      if (!R || R.tipo !== p.type) continue;
      if (porRol.has(rol)) duplicados.push({ rol, id: p.id }); else porRol.set(rol, p);
    }
    // Paso de armado: el mayor paso con alguna pieza colocada.
    let etapa = 1;
    for (const rol of porRol.keys()) etapa = Math.max(etapa, dis.roles.get(rol).paso);

    // 2. Miembros colocados de cada señal.
    const miembros = new Map();
    for (const [rol, p] of porRol) {
      for (const [pin, sig] of Object.entries(dis.roles.get(rol).nets)) {
        const red = redPin(p.id, pin);
        if (red < 0) continue;
        push(miembros, sig, { rol, id: p.id, pin, red, sig });
      }
    }
    const senalesRed = new Map();
    for (const [sig, lista] of miembros) for (const m of lista) {
      if (!senalesRed.has(m.red)) senalesRed.set(m.red, new Set());
      senalesRed.get(m.red).add(sig);
    }

    // 3. Cortos entre señales distintas. Un cable temporal (por ejemplo HALT_D a GND antes del paso 7)
    //    no cuenta como corto mientras el paso que maneja esa señal no esté armado.
    const cortos = [], temporales = [], redCorto = new Set();
    const efectivas = new Map();
    for (const [red, set] of senalesRed) {
      let sigs = [...set];
      if (sigs.length > 1) {
        const tmp = dis.temporales.filter(t => etapa <= t.hasta && set.has(t.sig) && set.has(t.con));
        for (const t of tmp) temporales.push([t.sig, t.con]);
        sigs = sigs.filter(s => !tmp.some(t => t.sig === s));
      }
      efectivas.set(red, sigs);
      if (sigs.length < 2) continue;
      redCorto.add(red);
      const pines = sigs.flatMap(s => miembros.get(s).filter(m => m.red === red));
      cortos.push({ red, senales: sigs, pines });
    }

    // 4. Estado de cada pin y conexiones que faltan (árbol mínimo entre grupos desconectados).
    const estadoPin = new Map(), faltan = [], senal = new Map();
    for (const [sig, lista] of miembros) {
      const grupos = [...S.agrupar(lista, m => m.red).values()].sort((a, b) => b.length - a.length);
      senal.set(sig, grupos[0][0].red);
      const totalDiseno = (dis.miembros.get(sig) || []).length;
      for (const g of grupos) for (const m of g) {
        let st;
        if (redCorto.has(m.red)) st = 'corto';
        else if (grupos.length === 1) st = lista.length >= 2 || totalDiseno <= 1 ? 'ok' : 'pendiente';
        else st = (g === grupos[0] && g.length > 1) ? 'incompleto' : 'falta';
        estadoPin.set(`${m.id}#${m.pin}`, { st, sig });
      }
      if (grupos.length > 1) {
        const pos = new Map(lista.map(m => [m, posPin(m.id, m.pin)]));
        const dentro = [grupos[0]], fuera = grupos.slice(1);
        while (fuera.length) {
          let mejor = null;
          for (const gi of dentro) for (const m1 of gi) for (let k = 0; k < fuera.length; k++) for (const m2 of fuera[k]) {
            const a = pos.get(m1), b = pos.get(m2);
            const d = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 1e9;
            if (!mejor || d < mejor.d) mejor = { d, m1, m2, k };
          }
          faltan.push({ sig, a: mejor.m1, b: mejor.m2 });
          dentro.push(fuera.splice(mejor.k, 1)[0]);
        }
      }
    }
    for (const d of duplicados) estadoPin.set(`${d.id}#dup`, { st: 'duplicado' });

    // 5. Entradas sin usar de los chips: conviene llevarlas a GND.
    const entradasLibres = [];
    for (const [rol, p] of porRol) {
      const def = S.CHIPS[p.type];
      if (!def) continue;
      const nets = dis.roles.get(rol).nets;
      for (const pin of def.ent) {
        if (nets[pin] !== undefined) continue;
        const red = redPin(p.id, pin);
        const sigs = efectivas.get(red);
        let st;
        if (sigs && sigs.length === 1 && sigs[0] === 'GND') st = 'ok';
        else if (sigs && sigs.length) st = 'corto';
        else st = 'libre';
        estadoPin.set(`${p.id}#${pin}`, { st, sig: null, sinUso: true, unidoA: sigs || [] });
        if (st !== 'ok') entradasLibres.push({ id: p.id, pin, rol, st });
      }
    }

    // 6. Revisiones de pasivos y LEDs.
    const redRes = motor.res.map(r => ({ r, a: base[r.n1], b: base[r.n2], v: r.part.props.valor }));
    const redCap = motor.caps.map(c => ({ c, a: base[c.n1], b: base[c.n2], v: c.part.props.valor }));
    const redLed = motor.leds.map(l => ({ l, a: base[l.na], k: base[l.nk] }));
    const entre = (lista, x, y) => lista.filter(e => (e.a === x && e.b === y) || (e.a === y && e.b === x));
    const fuente = doc.parts.find(p => p.type === 'fuente');
    const redVCC = fuente ? redPin(fuente.id, '+') : senal.get('VCC');
    const redGND = fuente ? redPin(fuente.id, '-') : senal.get('GND');
    const redSig = s => s === 'VCC' ? redVCC : s === 'GND' ? redGND : senal.get(s);
    const usadas = new Set();

    function revisar(r) {
      if (r.tipo === 'fuente') {
        if (!fuente) return { st: 'falta', msg: 'Coloca la fuente de laboratorio' };
        const p = fuente.props;
        if (!p.on) return { st: 'falta', msg: 'Enciende la fuente' };
        if (p.volts < 4.75 || p.volts > 5.25) return { st: 'aviso', msg: `La fuente está en ${p.volts} V: ajústala a 5.0 V` };
        return { st: 'ok', msg: 'Fuente encendida en 5 V' };
      }
      if (r.tipo === 'rieles') {
        if (!fuente) return { st: 'pendiente', msg: 'Rieles: falta la fuente' };
        if (!doc.boards.length) return { st: 'falta', msg: 'Agrega una protoboard' };
        const mal = [];
        for (const b of doc.boards) {
          const n = rail => base[motor.claveNodo.get(`${b.id}/${rail}`)];
          const ok = n('T+') === redVCC && n('B+') === redVCC && n('T-') === redGND && n('B-') === redGND;
          if (!ok) mal.push(b.nombre || b.id);
        }
        if (redVCC === redGND) return { st: 'corto', msg: 'El + y el − de la fuente están unidos' };
        return mal.length ? { st: 'falta', msg: `Rieles sin unir a la fuente: ${mal.join(', ')}. Los 4 rieles de cada protoboard deben llegar a la fuente (+ con +, − con −)` } : { st: 'ok', msg: 'Los rieles de todas las protoboards llegan a la fuente' };
      }
      if (r.tipo === 'res' || r.tipo === 'cap') {
        const x = redSig(r.a), y = redSig(r.b);
        if (x === undefined || y === undefined || x < 0 || y < 0) return { st: 'pendiente', msg: `${r.desc} (faltan piezas para revisarla)` };
        const hallados = entre(r.tipo === 'res' ? redRes : redCap, x, y);
        if (!hallados.length) return { st: 'falta', msg: r.desc };
        const bien = hallados.find(h => Math.abs(h.v - r.valor) / r.valor < 0.01);
        const h = bien || hallados[0];
        usadas.add((h.r || h.c).part.id);
        if (!bien) return { st: 'aviso', msg: `${r.desc}: la que pusiste es de ${r.tipo === 'res' ? S.ohm(h.v) : S.faradio(h.v)}`, ids: [(h.r || h.c).part.id] };
        return { st: 'ok', msg: r.desc, ids: [(h.r || h.c).part.id] };
      }
      if (r.tipo === 'led') {
        const desc = `LED en ${r.sig} con resistencia a GND`;
        const x = redSig(r.sig);
        if (x === undefined || x < 0 || redGND === undefined || redGND < 0) return { st: 'pendiente', msg: `${desc} (falta colocar la señal)` };
        for (const e of redLed) {
          if (e.a === x) {
            if (e.k === redGND) { usadas.add(e.l.part.id); return { st: 'aviso', msg: `${desc}: le falta la resistencia de 330 Ω`, ids: [e.l.part.id] }; }
            const rs = entre(redRes, e.k, redGND);
            if (rs.length) { usadas.add(e.l.part.id); usadas.add(rs[0].r.part.id); return { st: 'ok', msg: desc, ids: [e.l.part.id, rs[0].r.part.id] }; }
          }
          if (e.k === redGND) {
            const rs = entre(redRes, x, e.a);
            if (rs.length) { usadas.add(e.l.part.id); usadas.add(rs[0].r.part.id); return { st: 'ok', msg: desc, ids: [e.l.part.id, rs[0].r.part.id] }; }
          }
          if (e.k === x) return { st: 'aviso', msg: `${desc}: el LED está al revés (el ánodo + va hacia la señal)`, ids: [e.l.part.id] };
        }
        return { st: 'falta', msg: desc };
      }
      if (r.tipo === 'desacople') {
        const n = redCap.filter(e => Math.abs(e.v - 1e-7) < 1e-9 && ((e.a === redVCC && e.b === redGND) || (e.a === redGND && e.b === redVCC))).length;
        return { st: n >= 40 ? 'ok' : 'aviso', msg: `Condensadores de desacople de 100 nF entre +5 V y GND: ${n} de 40 recomendados. No cambian la simulación, pero en la protoboard real evitan fallos por ruido` };
      }
      return { st: 'pendiente', msg: '' };
    }

    // 7. Resumen por paso.
    const resumenPasos = dis.pasos.map(paso => {
      const rolesPaso = paso.roles.map(rol => {
        const R = dis.roles.get(rol), p = porRol.get(rol);
        const pines = Object.keys(R.nets);
        const cuenta = { ok: 0, pendiente: 0, falta: 0, incompleto: 0, corto: 0 };
        if (p) for (const pin of pines) { const e = estadoPin.get(`${p.id}#${pin}`); cuenta[e ? e.st : 'falta']++; }
        return { rol, nombre: R.nombre, tipo: R.tipo, id: p ? p.id : null, pines: pines.length, cuenta };
      });
      const revisiones = paso.revisiones.map(r => Object.assign({ def: r }, revisar(r)));
      let total = 0, hechos = 0;
      for (const r of rolesPaso) {
        total += 1 + r.pines;
        if (r.id) hechos += 1 + r.cuenta.ok + r.cuenta.pendiente;
      }
      for (const r of revisiones) { if (r.def.tipo === 'desacople') continue; total += 1; if (r.st === 'ok') hechos += 1; }
      const faltanPaso = faltan.filter(f => dis.roles.get(f.a.rol).paso === paso.n || dis.roles.get(f.b.rol).paso === paso.n);
      const cortosPaso = cortos.filter(c => c.pines.some(m => dis.roles.get(m.rol).paso === paso.n));
      const libresPaso = entradasLibres.filter(e => dis.roles.get(e.rol).paso === paso.n);
      return { n: paso.n, roles: rolesPaso, revisiones, faltan: faltanPaso, cortos: cortosPaso, libres: libresPaso, total, hechos, completo: hechos === total && !cortosPaso.length && !libresPaso.length };
    });

    // El paso 8 (programas) no tiene piezas propias: está listo cuando los pasos 1 a 7 lo están.
    const ultimo = resumenPasos[resumenPasos.length - 1];
    const previos = resumenPasos.slice(0, -1);
    ultimo.total = 1;
    ultimo.hechos = previos.every(p => p.completo) ? 1 : 0;
    ultimo.completo = ultimo.hechos === 1;

    return { porRol, etapa, estadoPin, faltan, cortos, temporales, entradasLibres, duplicados, pasos: resumenPasos, senal, usadas };
  };

  // Pieza con la función indicada (o null).
  S.parteDeRol = (doc, rol) => doc.parts.find(p => (p.type === 'fuente' ? '1:FUENTE' : p.rol) === rol) || null;
})(globalThis);
