// Simulación numérica del rectificador de onda completa + filtro + 7805.
// Modelo: transformador (Voc, Rs), 2 diodos en conducción (Vf), capacitor C con ESR, carga de corriente constante.
const f = 60, w = 2 * Math.PI * f;
const T = { Voc: 14.0, Rs: 1.0 };     // 12 Vrms a plena carga (24 VA), ~14 Vrms en vacío
const D = { Vf: 0.85 };               // 1N5401 con picos de corriente
const VREG = 5, DROP = 2.0;           // 7805: salida y caída mínima (dropout)
function simular(C, I, Voc = T.Voc) {
  const dt = 1e-6, N = Math.round(8 / f / dt);
  let vc = 0, vmin = 1e9, vmax = 0, ipk = 0, irms2 = 0, n = 0;
  for (let k = 0; k < N; k++) {
    const t = k * dt, vs = Math.abs(Voc * Math.SQRT2 * Math.sin(w * t));
    const i = Math.max(0, (vs - 2 * D.Vf - vc) / T.Rs);
    vc += (i - I) / C * dt;
    if (t > 4 / f) { vmin = Math.min(vmin, vc); vmax = Math.max(vmax, vc); ipk = Math.max(ipk, i); irms2 += i * i; n++; }
  }
  return { vmin, vmax, ripple: vmax - vmin, ipk, iaRms: Math.sqrt(irms2 / n) };
}
const filas = [];
for (const C of [2200e-6, 4700e-6, 6800e-6]) for (const I of [0.5, 1.0, 1.5]) {
  const r = simular(C, I), vprom = (r.vmax + r.vmin) / 2;
  filas.push({ C_uF: C * 1e6, I_A: I, Vmax: +r.vmax.toFixed(2), Vmin: +r.vmin.toFixed(2), rizado_Vpp: +r.ripple.toFixed(2),
    reguladoOK: r.vmin > VREG + DROP, I_pico_diodo_A: +r.ipk.toFixed(1), P_7805_W: +((vprom - VREG) * I).toFixed(1) });
}
console.table(filas);
const vac = simular(4700e-6, 0.01, 14.0);
console.log('En vacío (14 Vrms): Vcap =', vac.vmax.toFixed(1), 'V  -> capacitor de 25 V sobra:', vac.vmax < 25);
const alta = simular(4700e-6, 1.0, 14 * 1.1);
console.log('Red +10 % y 1 A: Vmax =', alta.vmax.toFixed(1), 'V, P_7805 =', (((alta.vmax + alta.vmin) / 2 - 5) * 1).toFixed(1), 'W');
const baja = simular(4700e-6, 1.0, 12 * 0.9);
console.log('Red -10 % y 1 A: Vmin =', baja.vmin.toFixed(2), 'V (necesita >', VREG + DROP, ')');
