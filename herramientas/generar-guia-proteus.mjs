// Escribe GUIA_PROTEUS.md a partir de fisico/netlist.json (la misma netlist que simula Logisim).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const nl=JSON.parse(fs.readFileSync(path.join(root,'fisico/netlist.json'),'utf8'));

const rng=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const NAMES={
 '7400':{1:'1A',2:'1B',3:'1Y',4:'2A',5:'2B',6:'2Y',7:'GND',8:'3Y',9:'3A',10:'3B',11:'4Y',12:'4A',13:'4B',14:'VCC'},
 '7404':{1:'1A',2:'1Y',3:'2A',4:'2Y',5:'3A',6:'3Y',7:'GND',8:'4Y',9:'4A',10:'5Y',11:'5A',12:'6Y',13:'6A',14:'VCC'},
 '7474':{1:'/1CLR',2:'1D',3:'1CLK',4:'/1PRE',5:'1Q',6:'/1Q',7:'GND',8:'/2Q',9:'2Q',10:'/2PRE',11:'2CLK',12:'2D',13:'/2CLR',14:'VCC'},
 '7430':{1:'A',2:'B',3:'C',4:'D',5:'E',6:'F',7:'GND',8:'Y',9:'NC',10:'NC',11:'G',12:'H',13:'NC',14:'VCC'},
 '74138':{1:'A',2:'B',3:'C',4:'/G2A',5:'/G2B',6:'G1',7:'Y7',8:'GND',9:'Y6',10:'Y5',11:'Y4',12:'Y3',13:'Y2',14:'Y1',15:'Y0',16:'VCC'},
 '74151':{1:'D3',2:'D2',3:'D1',4:'D0',5:'Y',6:'W (/Y)',7:'/E',8:'GND',9:'C',10:'B',11:'A',12:'D7',13:'D6',14:'D5',15:'D4',16:'VCC'},
 '74157':{1:'S',2:'1A',3:'1B',4:'1Y',5:'2A',6:'2B',7:'2Y',8:'GND',9:'3Y',10:'3B',11:'3A',12:'4Y',13:'4B',14:'4A',15:'/G',16:'VCC'},
 '74161':{1:'/CLR',2:'CLK',3:'A',4:'B',5:'C',6:'D',7:'ENP',8:'GND',9:'/LOAD',10:'ENT',11:'QD',12:'QC',13:'QB',14:'QA',15:'RCO',16:'VCC'},
 '74283':{1:'S2',2:'B2',3:'A2',4:'S1',5:'A1',6:'B1',7:'C0',8:'GND',9:'C4',10:'S4',11:'B4',12:'A4',13:'S3',14:'A3',15:'B3',16:'VCC'},
 '74245':{1:'DIR',...Object.fromEntries(rng(2,9).map(p=>[p,`A${p-1}`])),10:'GND',...Object.fromEntries(rng(11,18).map(p=>[p,`B${19-p}`])),19:'/OE',20:'VCC'},
 '74377':{1:'/E',2:'1Q',3:'1D',4:'2D',5:'2Q',6:'3Q',7:'3D',8:'4D',9:'4Q',10:'GND',11:'CLK',12:'5Q',13:'5D',14:'6D',15:'6Q',16:'7Q',17:'7D',18:'8D',19:'8Q',20:'VCC'},
 '74374':{1:'/OC',2:'1Q',3:'1D',4:'2D',5:'2Q',6:'3Q',7:'3D',8:'4D',9:'4Q',10:'GND',11:'CLK',12:'5Q',13:'5D',14:'6D',15:'6Q',16:'7Q',17:'7D',18:'8D',19:'8Q',20:'VCC'}
};
const GATE4=['7400','7408','7432','7486'];
for(const t of ['7408','7432','7486'])NAMES[t]=NAMES['7400'];
const REAL={'7400':'74LS00','7404':'74LS04','7408':'74LS08','7432':'74LS32','7486':'74LS86','7474':'74LS74','7430':'74LS30','74138':'74LS138','74151':'74LS151','74157':'74LS157','74161':'74LS161','74283':'74LS283','74245':'74LS245','74377':'74LS377','74374':'74LS374'};
const SPEC={...nl.spec,'74374':{N:20,i:[1,3,4,7,8,11,13,14,17,18],o:[2,5,6,9,12,15,16,19]}};

function table(type,nets){
 const s=SPEC[type],n=NAMES[type],N=s.N;const rows=['| Pin | Nombre | Señal |','|---|---|---|'];
 const used=[...(s.i??[]),...(s.o??[]),...(s.io??[])];
 for(let p=1;p<=N;p++){
  let sig;
  if(p===N)sig='+5 V (VCC)';else if(p===N/2)sig='GND';
  else if(!used.includes(p))sig='sin conectar';
  else if(nets[p]!==undefined)sig=`\`${nets[p]}\``;
  else sig=(s.i??[]).includes(p)?'`GND` (entrada sin usar)':'sin conectar (salida sin usar)';
  rows.push(`| ${p} | ${n[p]} | ${sig} |`);
 }
 return rows.join('\n');
}
// Una línea resumen por chip: para tablas largas de compuertas.
const out=[];
const w=(...t)=>out.push(...t);

w('# Guía para armar la computadora en Proteus (Windows)','',
'Esta guía te lleva a dibujar en **Proteus ISIS** el mismo circuito que simulé en Logisim, chip por chip y con los mismos números de pin. Las tablas de conexión están generadas de la misma netlist que usa la simulación de Logisim (`fisico/netlist.json`), que pasa las 12 pruebas de `fisico/evidencias/`.','',
'Sirve para dos cosas: comprobar el diseño antes de armarlo y ver cómo se conecta cada chip antes de poner cables en la protoboard. Los pines de las tablas son los del chip real.','',
'---','','## 0. Antes de empezar','',
'### 0.1 Reglas de lectura','',
'- Cada tabla de chip dice qué **señal** va a cada **pin**. Una señal es un nombre como `SYSCLK`, `BUS3` o `nT1`.',
'- **Todos los pines con la misma señal van conectados entre sí.** En Proteus eso se hace con **etiquetas de cable** (ver 0.3), no con cables largos.',
'- Una `n` al inicio del nombre (`nT1`, `nA_LD`, `nRESET`) significa **activa en bajo**: la señal actúa cuando vale 0.',
'- `GND` y `VCC` son tierra y +5 V. En Proteus se conectan con terminales (ver 0.3).',
'- Las filas de VCC y GND de cada chip son para la **protoboard**. En Proteus esos pines de alimentación se conectan solos y no se dibujan.',
'- Las **entradas sin usar de un chip van a GND**, como dice cada tabla. Las **salidas sin usar se dejan sin conectar**.','',
'### 0.2 Componentes que debes buscar','',
'En Proteus, pulsa **P** (Pick Devices) y escribe el nombre. Para cada chip comprueba que el panel de la derecha **no diga "No Simulation Model"**. Si algún chip no tiene modelo de simulación, usa el equivalente de la familia **74HC** (mismos pines): por ejemplo `74HC377` en lugar de `74LS377`. Los nombres exactos pueden variar un poco según la versión de Proteus.','',
'| Para qué | Buscar |','|---|---|',
'| Compuertas | `74LS00`, `74LS04`, `74LS08`, `74LS32`, `74LS86` |',
'| Flip-flop D | `74LS74` |','| NAND de 8 entradas | `74LS30` |',
'| Decodificador | `74LS138` |','| Multiplexores | `74LS151`, `74LS157` |',
'| Contador | `74LS161` |','| Sumador | `74LS283` |',
'| Buffer de bus | `74LS245` |','| Registros | `74LS377` |',
'| Memoria (celdas) | `74LS374` |',
'| Reloj | `DCLOCK` (generador) o `NE555` |',
'| Interruptores | `LOGICSTATE` (cada uno es un 0 o 1 que cambias con el ratón) o `SW-SPST`, `SW-SPDT`, `BUTTON` |',
'| Visualización | `LED-GREEN` o `LED-RED`, y `LOGICPROBE` para ver un valor |',
'| Resistencias | `RES` |','',
'### 0.3 Cómo dibujar sin cables largos','',
'1. Coloca el chip. Doble clic para ponerle el nombre (por ejemplo `PC`).',
'2. Desde cada pin que se use, dibuja un **cable corto** (clic en el pin, mueve unos centímetros, doble clic para terminar).',
'3. Con el cable seleccionado, usa la herramienta **Wire Label** (icono `LBL` de la barra izquierda, o tecla **A**) y escribe el nombre de la señal. Dos cables con la misma etiqueta quedan conectados.',
'4. Para `GND` y `VCC`, entra al modo **Terminals** (icono de la barra izquierda), elige `GROUND` o `POWER`, y colócalo al final del cable corto. El terminal `POWER` es +5 V.',
'5. **No dibujes los pines de alimentación de los chips** (VCC y GND de cada chip): Proteus los conecta solo.',
'6. Para ahorrar tiempo, copia un chip ya cableado (Ctrl+C, Ctrl+V) y solo cambia las etiquetas.','',
'### 0.4 Simular','',
'- El botón **Play** (triángulo, abajo a la izquierda) arranca la simulación. Con los `LOGICSTATE` cambias entradas haciendo clic mientras corre.',
'- Pon el `DCLOCK` en una frecuencia baja (1 Hz) para ver cada paso. Doble clic en el generador y cambia **Frequency**.',
'- Los LEDs y `LOGICPROBE` muestran el valor de una señal.',
'- Arma y prueba **un módulo a la vez**, en el orden de esta guía.','',
'---','','## 1. Dispositivos de entrada y salida','',
'Las señales que entran al circuito desde fuera. Pon cada una una vez y etiquétala con el nombre indicado.','',
'| Señal | Qué es | Cómo dibujarla |','|---|---|---|',
'| `CLK555` | Reloj automático | **Opción simple:** un `DCLOCK` a 1 Hz con su salida etiquetada `CLK555`. **Opción fiel:** un `NE555` astable: pines 4 y 8 a `VCC`, 1 a `GND`, 1 kΩ de `VCC` al pin 7, 1 kΩ más un potenciómetro de 100 kΩ en serie del pin 7 a los pines 2 y 6 (unidos), 1 µF de 2/6 a `GND`, 10 nF del pin 5 a `GND`. La salida es el pin 3 |',
'| `AUTO` | Modo del reloj: 1 = reloj automático, 0 = paso a paso | Un `LOGICSTATE` |',
'| `STEP_A`, `STEP_B` | Pulsador de paso a paso (SPDT) | Un `SW-SPDT` con el **común a GND**. El contacto **normalmente cerrado** va a `STEP_A` y el **normalmente abierto** a `STEP_B`. Cada uno lleva una resistencia de 10 kΩ a `VCC`. En reposo `STEP_A`=0 y `STEP_B`=1 |',
'| `WR_A`, `WR_B` | Pulsador de escritura (SPDT) | Igual que el anterior: normalmente cerrado a `WR_A`, normalmente abierto a `WR_B`, ambos con 10 kΩ a `VCC` |',
'| `nRESET` | Reset, activo en bajo | Un `BUTTON` entre `nRESET` y `GND`, con 10 kΩ de `nRESET` a `VCC`. En reposo vale 1. Para simular sin soltar el botón, usa un `LOGICSTATE` que empiece en 0 y pásalo a 1 |',
'| `PROG` | 1 = modo programación, 0 = ejecutar | Un `LOGICSTATE` |',
'| `DIPD0` a `DIPD7` | Dato a escribir en memoria | Ocho `LOGICSTATE` (o un DIP de 8). En la protoboard cada uno lleva 10 kΩ a GND |',
'| `DIPA0` a `DIPA2` | Dirección a escribir | Tres `LOGICSTATE` |','',
'**Salidas (LEDs).** Para ver una señal, conecta un LED con una resistencia de 330 Ω desde la señal a `GND`. Las señales que conviene ver: `BUS0`..`BUS7`, `A0`..`A7`, `IR0`..`IR7`, `OUT0`..`OUT7`, `PC0`..`PC2`, `PH0`, `PH1`, `Zf`, `Cf`, `Nf` y `Vf`. Son los 41 LEDs de la lista de materiales.','',
'---','');

const INTRO={
 'PASO 2 | RELOJ Y RESET':['## Paso 2. Reloj y reset','','Dos latch SR con 74LS00 para quitar el rebote de los pulsadores de **paso a paso** y de **escritura**, inversores y compuertas que mezclan el reloj automático con el manual, la señal de reset y el flip-flop de HLT.','','Algunas señales de este módulo (`nHALTQ`, `HALT_D`, `MEM_WE`) las produce un módulo de más adelante. Déjalas etiquetadas aunque aún no estén conectadas.','',
 '**Prueba:** con `AUTO`=1, `SYSCLK` es un reloj (ponle un LED). Con `AUTO`=0, cada pulsación de `STEP` da **un solo** pulso en `SYSCLK`, sin rebotes.'],
 'PASO 3 | CONTADOR DE PROGRAMA':['## Paso 3. Contador de programa (PC)','','Un 74LS161 cuenta de 0 a 7 usando solo QA, QB y QC.','',
 '**Prueba:** pon `T1`=1 (con un `LOGICSTATE` temporal, porque aún no existe), `nPC_LOAD`=1 y `nRST_TOTAL`=1: los LEDs de `PC0`..`PC2` cuentan 0 a 7. Con `T1`=0 se mantienen. Con `IR0`..`IR2`=101 y `nPC_LOAD`=0, el siguiente pulso salta a 5.'],
 'PASO 4 | REGISTROS Y BUS':['## Paso 4. Registros, bus y selector de dirección','','Los registros MAR, IR, A, B, OUT y MDR son 74LS377: cargan en el flanco de subida de `SYSCLK` cuando su pin `/E` vale 0. Los tres 74LS245 son los buffers que ponen datos en el bus: interruptores, registro A y ALU. **Nunca habilites dos a la vez.** `BUS0`..`BUS7` es el bus de datos.','',
 '**Prueba:** con `PROG`=1 los interruptores `DIPD` aparecen en los LEDs del bus. Carga un valor en A (con `nA_LD`=0 y un pulso de reloj) y comprueba que se mantiene al cambiar los interruptores.'],
 'PASO 5 | MEMORIA':['## Paso 5. Memoria 8 × 8 y modo de programación','','Un 74LS157 elige la dirección normal (`MAR`) o la manual (`DIPA`). Dos 74LS138 son el **DEMUX**: uno elige qué celda se lee y otro cuál se escribe. Las 8 celdas son 74LS374 (tabla al final de este paso). La señal `WE_PULSE` es el pulso de escritura.','',
 '**Prueba:** con `PROG`=1, escribe 0x01 en la dirección 0, 0x02 en la 1, 0x04 en la 2 … 0x80 en la 7 (dato en `DIPD`, dirección en `DIPA`, pulsa `WRITE`). La celda se escribe al **soltar** el pulsador. Después apaga el buffer de los interruptores y lee cada dirección con `MEM_RD`=1.'],
 'PASO 6 | ALU Y BANDERAS':['## Paso 6. ALU y banderas','','Dos 74LS283 suman (y restan invirtiendo B con XOR y metiendo un 1 como acarreo). Las compuertas hacen AND, OR, XOR y NOT bit a bit. Ocho 74LS151, uno por bit, eligen el resultado según `IR4`..`IR6`. SHL y SHR son solo cableado: la entrada D6 de cada 74LS151 toma el bit de la derecha de A y la D7 el de la izquierda. El 74LS30 detecta resultado cero. Un 74LS377 guarda las banderas Z, C, N y V.','',
 'El bit `i` de la ALU es igual en los 8 casos. Si dibujas bien el bit 0, copia y pega el 74LS151 y las compuertas y cambia las etiquetas.','',
 '**Prueba:** con los valores del PDF en A y B y la operación en `IR4`..`IR6` (ADD=000 … SHR=111), comprueba `RES0`..`RES7` contra la tabla del paso 6 de `PLAN_CONSTRUCCION.md`.'],
 'PASO 7 | UNIDAD DE CONTROL':['## Paso 7. Unidad de control','','Un 74LS161 cuenta las fases T0 a T3. Un 74LS138 las decodifica y otro 74LS138 decodifica la instrucción. Las compuertas generan las señales de control según las ecuaciones de `PLAN_CONSTRUCCION.md`.','',
 '**Prueba:** primero conecta LEDs a las señales de control, sin conectarlas aún a los registros. Pon una instrucción en IR y, en paso a paso, comprueba que las señales se activan en la fase indicada en la tabla del plan. Después conéctalas.']
};
const labelType=t=>REAL[t]??t;
for(const m of nl.modulos){
 const intro=INTRO[m.modulo];w(...intro,'');
 // Los chips de compuertas se numeran por tipo dentro del módulo.
 for(const ch of m.chips){
  const paso=m.modulo.match(/PASO (\d)/)[1];w(`### ${ch.label}${ch.label.includes('compuertas')?` (paso ${paso})`:''}`,'',table(ch.type,ch.nets),'');
 }
 if(m.modulo.startsWith('PASO 5')){
  w('### Celdas de memoria: 8 × 74LS374','',
  'Hazlas iguales y cambia solo las etiquetas de los pines 1 y 11. Los pines de datos (D y Q) van **todos a las mismas señales `BUS0`..`BUS7`**: cada celda lee y escribe por el mismo bus.','');
  w('| Pin | Nombre | Señal |','|---|---|---|');
  const D=[3,4,7,8,13,14,17,18],Q=[2,5,6,9,12,15,16,19];
  w('| 1 | /OC | `nRDi` (celda i: `nRD0`..`nRD7`) |','| 11 | CLK | `nWEi` (celda i: `nWE0`..`nWE7`) |');
  D.forEach((p,i)=>w(`| ${p} | ${NAMES['74374'][p]} | \`BUS${i}\` |`));
  Q.forEach((p,i)=>w(`| ${p} | ${NAMES['74374'][p]} | \`BUS${i}\` |`));
  w('| 10 | GND | GND |','| 20 | VCC | +5 V (VCC) |','');
  w('| Celda | `/OC` (pin 1) | `CLK` (pin 11) |','|---|---|---|');
  for(let i=0;i<8;i++)w(`| ${i} | \`nRD${i}\` | \`nWE${i}\` |`);
  w('');
 }
 w('---','');
}
w('## Glosario de señales','',
'| Señal | Significado |','|---|---|',
'| `SYSCLK` | Reloj del sistema. Todos los registros cargan en su flanco de subida |',
'| `CLKsrc` | Reloj elegido (automático o paso a paso), antes de la compuerta de HLT |',
'| `nRST_TOTAL` | Reset general: se activa con el botón de reset o con `PROG`=1 |',
'| `PH0`, `PH1` | Número de fase (T0 a T3) |',
'| `nT0`..`nT3` | La fase activa vale 0 en su línea. `T1` y `T3` son las versiones invertidas |',
'| `IR0`..`IR7` | Instrucción: `IR7`..`IR4` es el opcode y `IR2`..`IR0` es la dirección |',
'| `nLDA`, `nLDB`, `nSTA`, `nJMP`, `nJZ`, `nOUT`, `nHLT` | Instrucción decodificada (activas en bajo) |',
'| `MAR0`..`MAR2` | Dirección de memoria |',
'| `ADDR_SEL` | 0 = el MAR carga el PC, 1 = el MAR carga el operando del IR |',
'| `ADDR0`..`ADDR2` | Dirección final que entra a los decodificadores de memoria |',
'| `MEM_RD`, `MEM_WE` | Lectura y escritura de memoria |',
'| `WE_PULSE` | Pulso de escritura (de `PROG`·botón o de `MEM_WE`·reloj) |',
'| `nRD0`..`nRD7`, `nWE0`..`nWE7` | Selección de cada celda para leer y para escribir |',
'| `nMAR_LD`, `nIR_LD`, `nA_LD`, `nB_LD`, `nOUT_LD`, `nMDR_LD` | Habilitación de carga de cada registro (activa en bajo) |',
'| `nA_OUT`, `nALU_OUT` | Habilitan el buffer de A y el de la ALU hacia el bus |',
'| `nPC_LOAD` | Carga el PC con el operando del IR (JMP, JZ) |',
'| `Zf`, `Cf`, `Nf`, `Vf` | Banderas guardadas: cero, acarreo, negativo y desbordamiento |',
'| `RES0`..`RES7` | Resultado de la ALU |',
'| `HALTQ`, `nHALTQ` | La CPU está detenida / no lo está |','',
'## Dónde mirar si algo falla','',
'- **Valores `X` o líneas en conflicto:** dos buffers de bus están activos a la vez. Revisa `nA_OUT`, `nALU_OUT`, `PROG` y `MEM_RD`.',
'- **Nada cambia:** revisa que cada `/E` y cada `/OE` tengan la señal correcta. Una entrada sin conectar en Proteus se comporta distinto que en la protoboard.',
'- **STA no guarda en memoria:** esta es la ruta más delicada, porque el pulso de escritura sale del propio reloj. Proteus simula retardos reales. Ese retardo también existe en la protoboard, así que si falla aquí, probablemente falle allí.',
'- **Programas de prueba:** están en hexadecimal en el paso 8 de `PLAN_CONSTRUCCION.md`. Para el programa 1 (5 + 3) la memoria lleva `86 97 00 D0 E0 00 05 03`, y `OUT` debe terminar en `08`.','');
fs.writeFileSync(path.join(root,'GUIA_PROTEUS.md'),out.join('\n'));
console.log('GUIA_PROTEUS.md:',out.length,'líneas');
