// El diseño esperado: qué piezas lleva cada paso del plan y a qué señal va cada pin.
// Los chips salen de la netlist verificada en Logisim (datos.js). Los interruptores, LEDs y pasivos se añaden aquí.
(function (G) {
  'use strict';
  const S = G.SIM8;
  const roles = new Map();
  const pasos = [];

  const PASOS = [
    {
      n: 1, titulo: 'Alimentación',
      desc: 'Coloca la fuente de laboratorio y una protoboard. Une el borne + de la fuente al riel rojo (+) y el borne − al riel azul (−). Une también los rieles de arriba con los de abajo: rojo con rojo y azul con azul. En la fuente, ajusta 5.0 V y enciéndela.',
      prueba: 'Con la punta lógica (tecla P), toca un agujero de cada riel. El riel + debe marcar 5 V y el riel −, 0 V.',
      notas: ['En esta protoboard el riel + de arriba es el interior (junto a la fila a) y el riel − de abajo es el interior (junto a la fila j). Así VCC (arriba a la izquierda de cada chip) y GND (abajo a la derecha) quedan a un cable corto.']
    },
    {
      n: 2, titulo: 'Reloj y reset',
      desc: 'El NE555 genera el reloj automático; el potenciómetro cambia su velocidad. El pulsador PASO (conmutado) y su latch de 74LS00 dan un pulso limpio por pulsación. El interruptor AUTO elige entre los dos relojes. RESET y PROG forman el reset general. El 74LS74 detiene el reloj con la instrucción HLT.',
      prueba: 'Pon AUTO en 1: el LED de prueba en CLK555 o SYSCLK parpadea, y el potenciómetro cambia la velocidad. Pon AUTO en 0: cada pulsación de PASO da un solo pulso en SYSCLK, aunque el pulsador rebote.',
      notas: [
        'El interruptor PROG aparece en el paso 5 del plan. Aquí se coloca antes porque el reset de este paso (compuerta nRST_TOTAL) lo usa.',
        'HALT_D (pin 2 del 74LS74) lo maneja el paso 7. Mientras tanto queda flotante, se lee como 1 y detiene el reloj tras el primer pulso con PROG en 0. Para probar los pasos 2 a 6 con PROG en 0, une ese pin a GND con un cable temporal y quítalo en el paso 7.'
      ]
    },
    {
      n: 3, titulo: 'Contador de programa (PC)',
      desc: 'Un 74LS161 cuenta de 0 a 7 con QA, QB y QC. Carga una dirección con /LOAD (para JMP y JZ) y se pone en 0 con /CLR.',
      prueba: 'Con PROG en 0 y el reloj en marcha, los LEDs PC0 a PC2 cuentan 0 a 7. ENP y ENT (T1) y /LOAD aún están flotantes y se leen como 1: el contador cuenta en cada pulso y no carga.',
      notas: []
    },
    {
      n: 4, titulo: 'Registros y bus',
      desc: 'Los registros MAR, IR, A, B, OUT y MDR son 74LS377: cargan con el flanco de subida de SYSCLK cuando su pin /E vale 0. Los tres 74LS245 ponen en el bus los interruptores de datos, el registro A o la ALU. Nunca deben estar dos activos a la vez.',
      prueba: 'Con PROG en 1, el valor de los interruptores de datos aparece en los LEDs del bus. Para cargar un registro a mano, une su pin 1 (/E) a GND un momento y da un pulso de reloj.',
      notas: []
    },
    {
      n: 5, titulo: 'Memoria',
      desc: 'Ocho 74LS374 son las 8 posiciones de memoria. Un 74LS157 elige la dirección (MAR o los interruptores de dirección) y dos 74LS138 hacen de DEMUX: uno elige qué celda se lee y otro cuál se escribe.',
      prueba: 'Con PROG en 1, pon una dirección y un dato y pulsa ESCRIBIR: la celda se escribe al soltar el pulsador. Selecciona la celda para ver su contenido en el panel de propiedades.',
      notas: ['MEM_RD (pin 6 del 74LS138 de lectura) lo maneja el paso 7. Mientras está flotante se lee como 1 y la memoria pone su dato en el bus junto con los interruptores (conflicto). Para programar antes del paso 7, une ese pin a GND con un cable temporal.']
    },
    {
      n: 6, titulo: 'ALU y banderas',
      desc: 'Dos 74LS283 suman; para restar, los XOR invierten B y entra un 1 como acarreo. Las compuertas hacen AND, OR, XOR y NOT. Ocho 74LS151, uno por bit, eligen el resultado con IR4 a IR6. SHL y SHR son solo cableado. El 74LS30 detecta el resultado cero y un 74LS377 guarda las banderas Z, C, N y V.',
      prueba: 'Selecciona los chips para ver sus entradas y salidas en vivo. La comprobación completa de la ALU se hace con los programas del paso 8.',
      notas: []
    },
    {
      n: 7, titulo: 'Unidad de control',
      desc: 'Un 74LS161 cuenta las fases T0 a T3 y un 74LS138 las decodifica. Otro 74LS138 decodifica la instrucción. Las compuertas generan las señales de control. Quita los cables temporales de HALT_D y MEM_RD.',
      prueba: 'En paso a paso, los LEDs PH0 y PH1 muestran la fase. Comprueba con la punta lógica que las señales de control se activan en la fase indicada en el plan.',
      notas: []
    },
    {
      n: 8, titulo: 'Programas',
      desc: 'Carga un programa en memoria con los interruptores y ejecútalo. El panel de programas lo hace por ti moviendo los interruptores y el pulsador ESCRIBIR, igual que lo harías a mano.',
      prueba: 'Programa 1: 5 + 3. Con PROG en 0 y el reloj en marcha, OUT termina en 00001000 y el reloj se detiene (HLT).',
      notas: []
    }
  ];

  function agregarRol(r) {
    r.paso = r.paso || 1;
    r.nombre = r.nombre || r.label;
    roles.set(r.id, r);
    pasos[r.paso - 1].roles.push(r.id);
  }

  PASOS.forEach(p => pasos.push(Object.assign({ roles: [], revisiones: [] }, p)));

  // Chips de la netlist.
  for (const m of S.NETLIST.modulos) {
    const paso = +/PASO (\d)/.exec(m.modulo)[1];
    for (const ch of m.chips) {
      const def = S.CHIPS[ch.type];
      const nets = Object.assign({}, ch.nets);
      nets[def.vcc] = 'VCC';
      nets[def.gnd] = 'GND';
      const nombre = ch.label.includes('compuertas') ? `${ch.label} (paso ${paso})` : ch.label;
      agregarRol({ id: `${paso}:${ch.label}`, tipo: ch.type, label: ch.label, nombre, paso, nets });
    }
  }
  // Las 8 celdas de memoria (en Logisim son un subcircuito aparte).
  for (let i = 0; i < 8; i++) {
    const nets = { 1: `nRD${i}`, 11: `nWE${i}`, 10: 'GND', 20: 'VCC' };
    [3, 4, 7, 8, 13, 14, 17, 18].forEach((p, k) => { nets[p] = `BUS${k}`; });
    [2, 5, 6, 9, 12, 15, 16, 19].forEach((p, k) => { nets[p] = `BUS${k}`; });
    agregarRol({ id: `5:74LS374 celda ${i}`, tipo: '74374', label: `74LS374 celda ${i}`, paso: 5, nets });
  }
  // Fuente, reloj e interruptores.
  agregarRol({ id: '1:FUENTE', tipo: 'fuente', label: 'Fuente de laboratorio', paso: 1, nets: { '+': 'VCC', '-': 'GND' } });
  agregarRol({ id: '2:NE555', tipo: 'ne555', label: 'NE555 reloj', paso: 2, nets: { 1: 'GND', 8: 'VCC', 4: 'VCC', 3: 'CLK555', 2: 'RC555', 6: 'RC555', 7: 'DIS555', 5: 'CV555' } });
  agregarRol({ id: '2:POT', tipo: 'pot', label: 'Potenciómetro velocidad', paso: 2, nets: { 1: 'POT_A', 2: 'RC555', 3: 'RC555' } });
  agregarRol({ id: '2:PASO', tipo: 'btnspdt', label: 'Pulsador PASO', paso: 2, nets: { 1: 'STEP_A', 2: 'GND', 3: 'STEP_B' } });
  agregarRol({ id: '2:RESET', tipo: 'btn2', label: 'Pulsador RESET', paso: 2, nets: { 1: 'nRESET', 2: 'GND' } });
  agregarRol({ id: '2:AUTO', tipo: 'slide', label: 'Interruptor AUTO', paso: 2, nets: { 1: 'VCC', 2: 'AUTO', 3: 'GND' } });
  agregarRol({ id: '2:PROG', tipo: 'slide', label: 'Interruptor PROG', paso: 2, nets: { 1: 'VCC', 2: 'PROG', 3: 'GND' } });
  {
    const nets = {};
    for (let i = 1; i <= 8; i++) { nets[i] = `DIPD${i - 1}`; nets[17 - i] = 'VCC'; }
    agregarRol({ id: '4:DIP DATOS', tipo: 'dip8', label: 'DIP de datos (DIPD0-7)', paso: 4, nets });
  }
  {
    const nets = {};
    for (let i = 1; i <= 3; i++) { nets[i] = `DIPA${i - 1}`; nets[9 - i] = 'VCC'; }
    agregarRol({ id: '5:DIP DIRECCION', tipo: 'dip4', label: 'DIP de dirección (DIPA0-2)', paso: 5, nets });
  }
  agregarRol({ id: '5:ESCRIBIR', tipo: 'btnspdt', label: 'Pulsador ESCRIBIR', paso: 5, nets: { 1: 'WR_A', 2: 'GND', 3: 'WR_B' } });

  // Revisiones de piezas sin función asignada (resistencias, condensadores, LEDs).
  const rev = (paso, r) => pasos[paso - 1].revisiones.push(r);
  rev(1, { tipo: 'rieles' });
  rev(1, { tipo: 'fuente' });
  rev(2, { tipo: 'res', a: 'VCC', b: 'DIS555', valor: 1000, desc: 'R1 del 555: 1 kΩ entre +5 V y el pin 7' });
  rev(2, { tipo: 'res', a: 'DIS555', b: 'POT_A', valor: 1000, desc: 'R2 del 555: 1 kΩ entre el pin 7 y el potenciómetro' });
  rev(2, { tipo: 'cap', a: 'RC555', b: 'GND', valor: 1e-6, desc: 'Condensador de 1 µF entre los pines 2-6 del 555 y GND' });
  rev(2, { tipo: 'cap', a: 'CV555', b: 'GND', valor: 1e-8, desc: 'Condensador de 10 nF entre el pin 5 del 555 y GND' });
  rev(2, { tipo: 'res', a: 'STEP_A', b: 'VCC', valor: 10000, desc: 'Pull-up de 10 kΩ en STEP_A (NC del pulsador PASO)' });
  rev(2, { tipo: 'res', a: 'STEP_B', b: 'VCC', valor: 10000, desc: 'Pull-up de 10 kΩ en STEP_B (NA del pulsador PASO)' });
  rev(2, { tipo: 'res', a: 'nRESET', b: 'VCC', valor: 10000, desc: 'Pull-up de 10 kΩ en nRESET' });
  for (let i = 0; i < 3; i++) rev(3, { tipo: 'led', sig: `PC${i}` });
  for (let i = 0; i < 8; i++) rev(4, { tipo: 'res', a: `DIPD${i}`, b: 'GND', valor: 10000, desc: `Pull-down de 10 kΩ en DIPD${i}` });
  for (const g of ['BUS', 'A', 'IR', 'OUT']) for (let i = 0; i < 8; i++) rev(4, { tipo: 'led', sig: `${g}${i}` });
  for (let i = 0; i < 3; i++) rev(5, { tipo: 'res', a: `DIPA${i}`, b: 'GND', valor: 10000, desc: `Pull-down de 10 kΩ en DIPA${i}` });
  rev(5, { tipo: 'res', a: 'WR_A', b: 'VCC', valor: 10000, desc: 'Pull-up de 10 kΩ en WR_A (NC del pulsador ESCRIBIR)' });
  rev(5, { tipo: 'res', a: 'WR_B', b: 'VCC', valor: 10000, desc: 'Pull-up de 10 kΩ en WR_B (NA del pulsador ESCRIBIR)' });
  for (const s of ['Zf', 'Cf', 'Nf', 'Vf']) rev(6, { tipo: 'led', sig: s });
  for (const s of ['PH0', 'PH1']) rev(7, { tipo: 'led', sig: s });
  rev(8, { tipo: 'desacople' });

  // Cables temporales permitidos mientras el paso que maneja la señal no esté armado.
  const temporales = [
    { sig: 'HALT_D', con: 'GND', hasta: 6 },
    { sig: 'MEM_RD', con: 'GND', hasta: 6 }
  ];

  // Miembros de cada señal en el diseño completo.
  const miembros = new Map();
  for (const r of roles.values()) for (const [pin, sig] of Object.entries(r.nets)) {
    if (!miembros.has(sig)) miembros.set(sig, []);
    miembros.get(sig).push({ rol: r.id, pin });
  }

  const COLOR_LED = { BUS: 'amarillo', A: 'rojo', IR: 'verde', OUT: 'rojo', PC: 'azul', PH: 'blanco', Zf: 'verde', Cf: 'verde', Nf: 'verde', Vf: 'verde' };
  const colorLed = sig => { for (const [k, v] of Object.entries(COLOR_LED)) if (sig.startsWith(k)) return v; return 'rojo'; };

  // Rol de cada registro de la CPU, para leer su contenido.
  const CPU = {
    A: '4:74LS377 A', B: '4:74LS377 B', IR: '4:74LS377 IR', OUT: '4:74LS377 OUT', MAR: '4:74LS377 MAR', MDR: '4:74LS377 MDR',
    PC: '3:74LS161 PC', FASE: '7:74LS161 fases T0-T3', BANDERAS: '6:74LS377 BANDERAS (Z C N V)', HLT: '2:74LS74 bandera HLT'
  };

  S.diseno = { roles, pasos, miembros, temporales, colorLed, CPU };
})(globalThis);
