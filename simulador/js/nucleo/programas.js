// Programación de la memoria con los interruptores (igual que a mano) y lectura del estado de la CPU.
(function (G) {
  'use strict';
  const S = G.SIM8;

  // Lista de acciones para escribir 8 palabras: PROG=1, por cada dirección pone DIP y pulsa ESCRIBIR, PROG=0.
  S.accionesProgramar = function (palabras) {
    const a = [];
    a.push({ tipo: 'slide', rol: '2:PROG', pos: 1, texto: 'PROG en 1 (modo programación)' });
    a.push({ tipo: 'esperar', s: 0.05 });
    palabras.forEach((w, dir) => {
      for (let i = 0; i < 3; i++) a.push({ tipo: 'dip', rol: '5:DIP DIRECCION', i, on: !!((dir >> i) & 1) });
      for (let i = 0; i < 8; i++) a.push({ tipo: 'dip', rol: '4:DIP DATOS', i, on: !!((w >> i) & 1) });
      a.push({ tipo: 'esperar', s: 0.03, texto: `Dirección ${dir}: dato ${S.hex(w)}` });
      a.push({ tipo: 'pulsar', rol: '5:ESCRIBIR', abajo: true });
      a.push({ tipo: 'esperar', s: 0.04 });
      a.push({ tipo: 'pulsar', rol: '5:ESCRIBIR', abajo: false });
      a.push({ tipo: 'esperar', s: 0.04 });
    });
    for (let i = 0; i < 8; i++) a.push({ tipo: 'dip', rol: '4:DIP DATOS', i, on: false });
    a.push({ tipo: 'esperar', s: 0.02 });
    return a;
  };

  // Qué piezas hacen falta para programar con los interruptores.
  S.faltaParaProgramar = function (doc) {
    const necesarios = ['2:PROG', '4:DIP DATOS', '5:DIP DIRECCION', '5:ESCRIBIR'];
    return necesarios.filter(r => !S.parteDeRol(doc, r)).map(r => S.diseno.roles.get(r).nombre);
  };

  // Ejecuta una acción sobre el documento y el motor. Devuelve los segundos a esperar.
  S.ejecutarAccion = function (doc, motor, acc) {
    if (acc.tipo === 'esperar') return acc.s;
    const p = S.parteDeRol(doc, acc.rol);
    if (!p) throw new Error(`Falta ${S.diseno.roles.get(acc.rol).nombre}`);
    if (acc.tipo === 'slide') { p.props.pos = acc.pos; motor.enlazar(); }
    else if (acc.tipo === 'dip') { if (p.props.sw[acc.i] !== acc.on) { p.props.sw[acc.i] = acc.on; motor.enlazar(); } }
    else if (acc.tipo === 'pulsar') motor.pulsar(p.id, acc.abajo);
    return 0;
  };

  // Contenido de los registros, leído del estado interno de cada chip.
  S.leerCPU = function (doc, motor) {
    const C = S.diseno.CPU;
    const comp = rol => { const p = S.parteDeRol(doc, rol); const c = p && motor.comp(p.id); return c && c.alimentado && c.st ? c : null; };
    const q = (rol, m = 255) => { const c = comp(rol); return c ? c.st.q & m : null; };
    const hlt = comp(C.HLT);
    const memoria = [];
    for (let i = 0; i < 8; i++) memoria.push(q(`5:74LS374 celda ${i}`));
    return {
      A: q(C.A), B: q(C.B), IR: q(C.IR), OUT: q(C.OUT), MAR: q(C.MAR, 7), MDR: q(C.MDR),
      PC: q(C.PC, 7), FASE: q(C.FASE, 3), FLAGS: q(C.BANDERAS, 15),
      HALTED: hlt ? hlt.st.q[0] : null, memoria
    };
  };

  // Desensambla una palabra con la codificación del plan.
  const NOMBRES = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR', 'LDA', 'LDB', 'STA', 'JMP', 'JZ', 'OUT', 'HLT', '—'];
  S.desensamblar = function (w) {
    if (w === null || w === undefined) return '—';
    const op = w >> 4, n = w & 7;
    return op >= 8 && op <= 12 ? `${NOMBRES[op]} ${n}` : NOMBRES[op];
  };
})(globalThis);
