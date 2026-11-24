// Modelos lógicos de los circuitos integrados, con los mismos números de pin del datasheet.
// eval(c, r, w): r(pin) lee la entrada (0/1); w(pin, v) fija la salida (0, 1 o 2 = alta impedancia).
// Los chips secuenciales guardan su estado en c.st y detectan el flanco de subida comparando con el valor anterior.
(function (G) {
  'use strict';
  const S = G.SIM8;
  const Z = 2;
  const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const RANURAS4 = [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]];
  const RANURAS6 = [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]];
  const N4 = { 1: '1A', 2: '1B', 3: '1Y', 4: '2A', 5: '2B', 6: '2Y', 7: 'GND', 8: '3Y', 9: '3A', 10: '3B', 11: '4Y', 12: '4A', 13: '4B', 14: 'VCC' };
  const D8 = [3, 4, 7, 8, 13, 14, 17, 18], Q8 = [2, 5, 6, 9, 12, 15, 16, 19];
  const N377 = { 1: '/E', 2: '1Q', 3: '1D', 4: '2D', 5: '2Q', 6: '3Q', 7: '3D', 8: '4D', 9: '4Q', 10: 'GND', 11: 'CLK', 12: '5Q', 13: '5D', 14: '6D', 15: '6Q', 16: '7Q', 17: '7D', 18: '8D', 19: '8Q', 20: 'VCC' };
  const byte = () => rnd => Math.floor(rnd() * 256);
  const leerByte = (r, pines) => pines.reduce((a, p, i) => a | (r(p) << i), 0);

  function compuerta4(nombre, desc, icc, f) {
    return {
      nombre, desc, n: 14, icc, ent: [1, 2, 4, 5, 9, 10, 12, 13], sal: [3, 6, 8, 11], nombres: N4,
      eval(c, r, w) { for (const [a, b, y] of RANURAS4) w(y, f(r(a), r(b))); }
    };
  }

  const FF74 = [{ clr: 1, d: 2, clk: 3, pre: 4, q: 5, nq: 6 }, { clr: 13, d: 12, clk: 11, pre: 10, q: 9, nq: 8 }];

  const CHIPS = {
    '7400': compuerta4('74LS00', '4 compuertas NAND de 2 entradas', 1.6, (a, b) => (a & b) ^ 1),
    '7408': compuerta4('74LS08', '4 compuertas AND de 2 entradas', 4.4, (a, b) => a & b),
    '7432': compuerta4('74LS32', '4 compuertas OR de 2 entradas', 4.9, (a, b) => a | b),
    '7486': compuerta4('74LS86', '4 compuertas XOR de 2 entradas', 6.1, (a, b) => a ^ b),
    '7404': {
      nombre: '74LS04', desc: '6 inversores (NOT)', n: 14, icc: 2.4, ent: [1, 3, 5, 9, 11, 13], sal: [2, 4, 6, 8, 10, 12],
      nombres: { 1: '1A', 2: '1Y', 3: '2A', 4: '2Y', 5: '3A', 6: '3Y', 7: 'GND', 8: '4Y', 9: '4A', 10: '5Y', 11: '5A', 12: '6Y', 13: '6A', 14: 'VCC' },
      eval(c, r, w) { for (const [a, y] of RANURAS6) w(y, r(a) ^ 1); }
    },
    '7430': {
      nombre: '74LS30', desc: 'NAND de 8 entradas', n: 14, icc: 0.5, ent: [1, 2, 3, 4, 5, 6, 11, 12], sal: [8],
      nombres: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'GND', 8: 'Y', 9: 'NC', 10: 'NC', 11: 'G', 12: 'H', 13: 'NC', 14: 'VCC' },
      eval(c, r, w) { w(8, (r(1) & r(2) & r(3) & r(4) & r(5) & r(6) & r(11) & r(12)) ^ 1); }
    },
    '7474': {
      nombre: '74LS74', desc: '2 flip-flops D con preset y clear', n: 14, icc: 4, ent: [1, 2, 3, 4, 10, 11, 12, 13], sal: [5, 6, 8, 9], sec: true,
      nombres: { 1: '/1CLR', 2: '1D', 3: '1CLK', 4: '/1PRE', 5: '1Q', 6: '/1Q', 7: 'GND', 8: '/2Q', 9: '2Q', 10: '/2PRE', 11: '2CLK', 12: '2D', 13: '/2CLR', 14: 'VCC' },
      init: rnd => ({ q: [rnd() < 0.5 ? 1 : 0, rnd() < 0.5 ? 1 : 0], lc: [-1, -1] }),
      eval(c, r, w) {
        const st = c.st;
        FF74.forEach((f, i) => {
          const clr = r(f.clr), pre = r(f.pre), clk = r(f.clk);
          if (!clr && !pre) { st.lc[i] = clk; st.q[i] = 1; w(f.q, 1); w(f.nq, 1); return; }
          if (!clr) st.q[i] = 0;
          else if (!pre) st.q[i] = 1;
          else if (st.lc[i] === 0 && clk === 1) st.q[i] = r(f.d);
          st.lc[i] = clk;
          w(f.q, st.q[i]); w(f.nq, st.q[i] ^ 1);
        });
      }
    },
    '74138': {
      nombre: '74LS138', desc: 'Decodificador / DEMUX de 3 a 8 (salidas activas en bajo)', n: 16, icc: 6.3, ent: [1, 2, 3, 4, 5, 6], sal: [15, 14, 13, 12, 11, 10, 9, 7],
      nombres: { 1: 'A', 2: 'B', 3: 'C', 4: '/G2A', 5: '/G2B', 6: 'G1', 7: 'Y7', 8: 'GND', 9: 'Y6', 10: 'Y5', 11: 'Y4', 12: 'Y3', 13: 'Y2', 14: 'Y1', 15: 'Y0', 16: 'VCC' },
      eval(c, r, w) {
        const Y = [15, 14, 13, 12, 11, 10, 9, 7];
        const en = r(6) && !r(4) && !r(5);
        const s = r(1) | (r(2) << 1) | (r(3) << 2);
        Y.forEach((p, i) => w(p, en && i === s ? 0 : 1));
      }
    },
    '74151': {
      nombre: '74LS151', desc: 'Multiplexor de 8 a 1', n: 16, icc: 6, ent: [1, 2, 3, 4, 7, 9, 10, 11, 12, 13, 14, 15], sal: [5, 6],
      nombres: { 1: 'D3', 2: 'D2', 3: 'D1', 4: 'D0', 5: 'Y', 6: 'W (/Y)', 7: '/E', 8: 'GND', 9: 'C', 10: 'B', 11: 'A', 12: 'D7', 13: 'D6', 14: 'D5', 15: 'D4', 16: 'VCC' },
      eval(c, r, w) {
        if (r(7)) { w(5, 0); w(6, 1); return; }
        const D = [4, 3, 2, 1, 15, 14, 13, 12];
        const y = r(D[r(11) | (r(10) << 1) | (r(9) << 2)]);
        w(5, y); w(6, y ^ 1);
      }
    },
    '74157': {
      nombre: '74LS157', desc: '4 multiplexores de 2 a 1', n: 16, icc: 9.7, ent: [1, 2, 3, 5, 6, 10, 11, 13, 14, 15], sal: [4, 7, 9, 12],
      nombres: { 1: 'S', 2: '1A', 3: '1B', 4: '1Y', 5: '2A', 6: '2B', 7: '2Y', 8: 'GND', 9: '3Y', 10: '3B', 11: '3A', 12: '4Y', 13: '4B', 14: '4A', 15: '/G', 16: 'VCC' },
      eval(c, r, w) {
        const grupos = [[2, 3, 4], [5, 6, 7], [11, 10, 9], [14, 13, 12]];
        if (r(15)) { for (const g of grupos) w(g[2], 0); return; }
        const s = r(1);
        for (const [a, b, y] of grupos) w(y, s ? r(b) : r(a));
      }
    },
    '74161': {
      nombre: '74LS161', desc: 'Contador binario síncrono de 4 bits', n: 16, icc: 19, ent: [1, 2, 3, 4, 5, 6, 7, 9, 10], sal: [14, 13, 12, 11, 15], sec: true,
      nombres: { 1: '/CLR', 2: 'CLK', 3: 'A', 4: 'B', 5: 'C', 6: 'D', 7: 'ENP', 8: 'GND', 9: '/LOAD', 10: 'ENT', 11: 'QD', 12: 'QC', 13: 'QB', 14: 'QA', 15: 'RCO', 16: 'VCC' },
      init: rnd => ({ q: Math.floor(rnd() * 16), lc: -1 }),
      eval(c, r, w) {
        const st = c.st, clk = r(2);
        if (!r(1)) st.q = 0;
        else if (st.lc === 0 && clk === 1) {
          if (!r(9)) st.q = r(3) | (r(4) << 1) | (r(5) << 2) | (r(6) << 3);
          else if (r(7) && r(10)) st.q = (st.q + 1) & 15;
        }
        st.lc = clk;
        w(14, st.q & 1); w(13, (st.q >> 1) & 1); w(12, (st.q >> 2) & 1); w(11, (st.q >> 3) & 1);
        w(15, (r(10) && st.q === 15) ? 1 : 0);
      }
    },
    '74283': {
      nombre: '74LS283', desc: 'Sumador completo de 4 bits', n: 16, icc: 19, ent: [2, 3, 5, 6, 7, 11, 12, 14, 15], sal: [1, 4, 9, 10, 13],
      nombres: { 1: 'S2', 2: 'B2', 3: 'A2', 4: 'S1', 5: 'A1', 6: 'B1', 7: 'C0', 8: 'GND', 9: 'C4', 10: 'S4', 11: 'B4', 12: 'A4', 13: 'S3', 14: 'A3', 15: 'B3', 16: 'VCC' },
      eval(c, r, w) {
        const a = r(5) | (r(3) << 1) | (r(14) << 2) | (r(12) << 3);
        const b = r(6) | (r(2) << 1) | (r(15) << 2) | (r(11) << 3);
        const s = a + b + r(7);
        w(4, s & 1); w(1, (s >> 1) & 1); w(13, (s >> 2) & 1); w(10, (s >> 3) & 1); w(9, (s >> 4) & 1);
      }
    },
    '74245': {
      nombre: '74LS245', desc: 'Buffer bidireccional de 8 bits con salida triestado', n: 20, icc: 48, ent: [1, 19], sal: [], io: [...rango(2, 9), ...rango(11, 18)],
      nombres: Object.assign({ 1: 'DIR', 10: 'GND', 19: '/OE', 20: 'VCC' }, ...rango(2, 9).map(p => ({ [p]: `A${p - 1}` })), ...rango(11, 18).map(p => ({ [p]: `B${19 - p}` }))),
      eval(c, r, w) {
        const A = rango(2, 9), B = [18, 17, 16, 15, 14, 13, 12, 11];
        if (r(19)) { for (const p of A) w(p, Z); for (const p of B) w(p, Z); return; }
        if (r(1)) { A.forEach((p, i) => { w(p, Z); w(B[i], r(p)); }); }
        else { B.forEach((p, i) => { w(p, Z); w(A[i], r(p)); }); }
      }
    },
    '74377': {
      nombre: '74LS377', desc: 'Registro de 8 bits con habilitación (/E)', n: 20, icc: 17, ent: [1, 11, ...D8], sal: Q8, sec: true, nombres: N377,
      init: rnd => ({ q: byte()(rnd), lc: -1 }),
      eval(c, r, w) {
        const st = c.st, clk = r(11);
        if (st.lc === 0 && clk === 1 && !r(1)) st.q = leerByte(r, D8);
        st.lc = clk;
        Q8.forEach((p, i) => w(p, (st.q >> i) & 1));
      }
    },
    '74374': {
      nombre: '74LS374', desc: 'Registro de 8 bits con salida triestado (/OC)', n: 20, icc: 27, ent: [1, 11, ...D8], sal: Q8, sec: true,
      nombres: Object.assign({}, N377, { 1: '/OC' }),
      init: rnd => ({ q: byte()(rnd), lc: -1 }),
      eval(c, r, w) {
        const st = c.st, clk = r(11);
        if (st.lc === 0 && clk === 1) st.q = leerByte(r, D8);
        st.lc = clk;
        const sale = !r(1);
        Q8.forEach((p, i) => w(p, sale ? (st.q >> i) & 1 : Z));
      }
    },
    'ne555': {
      // Los pines 2, 5, 6 y 7 son analógicos: el motor calcula la frecuencia a partir de las resistencias y el condensador.
      nombre: 'NE555', desc: 'Temporizador (reloj astable)', n: 8, vcc: 8, gnd: 1, icc: 3, ent: [4], analogicos: [2, 5, 6, 7], sal: [3], reloj: true,
      nombres: { 1: 'GND', 2: 'TRIG', 3: 'OUT', 4: '/RESET', 5: 'CTRL', 6: 'THRES', 7: 'DISCH', 8: 'VCC' },
      init: () => ({ out: 1 }),
      eval(c, r, w) { w(3, (r(4) && c.st.out) ? 1 : 0); }
    }
  };

  for (const [tipo, d] of Object.entries(CHIPS)) {
    d.tipo = tipo;
    d.vcc = d.vcc || d.n;
    d.gnd = d.gnd || d.n / 2;
    d.io = d.io || [];
    d.pinesSalida = [...d.sal, ...d.io];
    d.pinesLectura = [...new Set([...d.ent, ...d.io, d.vcc, d.gnd])];
    d.esEntrada = new Set([...d.ent, ...d.io]);
    d.esSalida = new Set(d.pinesSalida);
  }
  S.CHIPS = CHIPS;
})(globalThis);
