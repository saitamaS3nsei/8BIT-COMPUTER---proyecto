// Núcleo del simulador de protoboard. No usa el DOM: funciona en el navegador y en Node (pruebas).
(function (G) {
  'use strict';
  const S = G.SIM8 = G.SIM8 || {};

  // Valores de una red.
  // L/H: manejada con fuerza (salida de un chip o fuente). WL/WH: solo a través de una resistencia.
  // Z: nadie la maneja (flotante). X: dos salidas fuertes en conflicto. WX: resistencias hacia 0 y 1 a la vez.
  S.V = { L: 0, H: 1, Z: 2, X: 3, WL: 4, WH: 5, WX: 6 };

  // Lo que lee una entrada TTL: una entrada flotante se lee como 1; en un conflicto gana el 0.
  S.leer = v => (v === 0 || v === 3 || v === 4) ? 0 : 1;

  S.rng = function (semilla) {
    let s = (semilla >>> 0) || 0x9e3779b9;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  S.hex = (v, w = 2) => (v === null || v === undefined) ? '—' : v.toString(16).toUpperCase().padStart(w, '0');
  S.bin = (v, w = 8) => (v === null || v === undefined) ? '—' : v.toString(2).padStart(w, '0');

  S.ohm = v => v >= 1e6 ? `${+(v / 1e6).toFixed(2)} MΩ` : v >= 1e3 ? `${+(v / 1e3).toFixed(2)} kΩ` : `${+v.toFixed(1)} Ω`;
  S.faradio = v => v >= 1e-6 ? `${+(v / 1e-6).toFixed(2)} µF` : v >= 1e-9 ? `${+(v / 1e-9).toFixed(2)} nF` : `${+(v / 1e-12).toFixed(1)} pF`;
  S.hercio = v => v >= 1e3 ? `${+(v / 1e3).toFixed(2)} kHz` : `${+v.toFixed(v < 10 ? 2 : 1)} Hz`;

  S.agrupar = function (lista, clave) {
    const m = new Map();
    for (const x of lista) { const k = clave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  };
})(globalThis);
