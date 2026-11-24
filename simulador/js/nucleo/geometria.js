// Geometría de una protoboard de 830 puntos (unidades: 1 = 0.01 pulgadas; un agujero cada 10).
(function (G) {
  'use strict';
  const S = G.SIM8;
  const FILAS_ARRIBA = ['a', 'b', 'c', 'd', 'e'];
  const FILAS_ABAJO = ['f', 'g', 'h', 'i', 'j'];
  // Rieles: T = arriba, B = abajo. Arriba el + es el interior (junto a la fila a); abajo el − es el interior (junto a la fila j).
  const RIELES = ['T-', 'T+', 'B-', 'B+'];
  const FILA_Y = { 'T-': 14, 'T+': 26, a: 50, b: 60, c: 70, d: 80, e: 90, f: 120, g: 130, h: 140, i: 150, j: 160, 'B-': 184, 'B+': 196 };
  const COLS = 63;
  const colX = c => 25 + (c - 1) * 10;
  const COLS_RIEL = [];
  for (let g = 0; g < 10; g++) for (let k = 0; k < 5; k++) COLS_RIEL.push(3 + g * 6 + k);
  const ES_COL_RIEL = new Set(COLS_RIEL);

  const geo = {
    W: 670, H: 210, COLS, FILAS_ARRIBA, FILAS_ABAJO, RIELES, FILA_Y, colX, COLS_RIEL,
    filas: ['T-', 'T+', ...FILAS_ARRIBA, ...FILAS_ABAJO, 'B-', 'B+'],
    esRiel: f => f.length === 2,
    polaridadRiel: f => f[1],
    agujeroValido(fila, col) {
      if (!(fila in FILA_Y) || !Number.isInteger(col) || col < 1 || col > COLS) return false;
      return fila.length === 2 ? ES_COL_RIEL.has(col) : true;
    },
    clave: (tablero, fila, col) => `${tablero}/${fila}${col}`,
    // Clave de agujero: "b1/a12". Clave de borne de una pieza libre (fuente): "p3:+".
    leerClave(k) {
      const m = /^([^/:]+)\/(T-|T\+|B-|B\+|[a-j])(\d+)$/.exec(k);
      if (m) return { agujero: true, tablero: m[1], fila: m[2], col: +m[3] };
      const t = /^([^/:]+):(.+)$/.exec(k);
      if (t) return { agujero: false, parte: t[1], pin: t[2] };
      return null;
    },
    // Tira de conexión: las 5 filas de una columna en cada mitad, o un riel completo.
    tira(fila, col) {
      if (fila.length === 2) return fila;
      return (FILAS_ARRIBA.includes(fila) ? 'U' : 'L') + col;
    },
    agujerosDeTira(tira) {
      if (tira.length === 2 && (tira[0] === 'T' || tira[0] === 'B') && (tira[1] === '+' || tira[1] === '-')) return COLS_RIEL.map(c => [tira, c]);
      const col = +tira.slice(1);
      return (tira[0] === 'U' ? FILAS_ARRIBA : FILAS_ABAJO).map(f => [f, col]);
    },
    mitad: fila => fila.length === 2 ? fila[0] : (FILAS_ARRIBA.includes(fila) ? 'U' : 'L'),
    posLocal: (fila, col) => ({ x: colX(col), y: FILA_Y[fila] }),
    // Agujero más cercano a un punto local del tablero.
    agujeroEn(lx, ly, tol = 5.5) {
      const col = Math.round((lx - 25) / 10) + 1;
      if (Math.abs(lx - colX(col)) > tol) return null;
      for (const f of geo.filas) {
        if (Math.abs(ly - FILA_Y[f]) <= tol && geo.agujeroValido(f, col)) return { fila: f, col };
      }
      return null;
    }
  };
  S.geo = geo;
})(globalThis);
