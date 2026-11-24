# Guía para armar la computadora en Proteus (Windows)

Esta guía te lleva a dibujar en **Proteus ISIS** el mismo circuito que simulé en Logisim, chip por chip y con los mismos números de pin. Las tablas de conexión están generadas de la misma netlist que usa la simulación de Logisim (`fisico/netlist.json`), que pasa las 12 pruebas de `fisico/evidencias/`.

Sirve para dos cosas: comprobar el diseño antes de armarlo y ver cómo se conecta cada chip antes de poner cables en la protoboard. Los pines de las tablas son los del chip real.

---

## 0. Antes de empezar

### 0.1 Reglas de lectura

- Cada tabla de chip dice qué **señal** va a cada **pin**. Una señal es un nombre como `SYSCLK`, `BUS3` o `nT1`.
- **Todos los pines con la misma señal van conectados entre sí.** En Proteus eso se hace con **etiquetas de cable** (ver 0.3), no con cables largos.
- Una `n` al inicio del nombre (`nT1`, `nA_LD`, `nRESET`) significa **activa en bajo**: la señal actúa cuando vale 0.
- `GND` y `VCC` son tierra y +5 V. En Proteus se conectan con terminales (ver 0.3).
- Las filas de VCC y GND de cada chip son para la **protoboard**. En Proteus esos pines de alimentación se conectan solos y no se dibujan.
- Las **entradas sin usar de un chip van a GND**, como dice cada tabla. Las **salidas sin usar se dejan sin conectar**.

### 0.2 Componentes que debes buscar

En Proteus, pulsa **P** (Pick Devices) y escribe el nombre. Para cada chip comprueba que el panel de la derecha **no diga "No Simulation Model"**. Si algún chip no tiene modelo de simulación, usa el equivalente de la familia **74HC** (mismos pines): por ejemplo `74HC377` en lugar de `74LS377`. Los nombres exactos pueden variar un poco según la versión de Proteus.

| Para qué | Buscar |
|---|---|
| Compuertas | `74LS00`, `74LS04`, `74LS08`, `74LS32`, `74LS86` |
| Flip-flop D | `74LS74` |
| NAND de 8 entradas | `74LS30` |
| Decodificador | `74LS138` |
| Multiplexores | `74LS151`, `74LS157` |
| Contador | `74LS161` |
| Sumador | `74LS283` |
| Buffer de bus | `74LS245` |
| Registros | `74LS377` |
| Memoria (celdas) | `74LS374` |
| Reloj | `DCLOCK` (generador) o `NE555` |
| Interruptores | `LOGICSTATE` (cada uno es un 0 o 1 que cambias con el ratón) o `SW-SPST`, `SW-SPDT`, `BUTTON` |
| Visualización | `LED-GREEN` o `LED-RED`, y `LOGICPROBE` para ver un valor |
| Resistencias | `RES` |

### 0.3 Cómo dibujar sin cables largos

1. Coloca el chip. Doble clic para ponerle el nombre (por ejemplo `PC`).
2. Desde cada pin que se use, dibuja un **cable corto** (clic en el pin, mueve unos centímetros, doble clic para terminar).
3. Con el cable seleccionado, usa la herramienta **Wire Label** (icono `LBL` de la barra izquierda, o tecla **A**) y escribe el nombre de la señal. Dos cables con la misma etiqueta quedan conectados.
4. Para `GND` y `VCC`, entra al modo **Terminals** (icono de la barra izquierda), elige `GROUND` o `POWER`, y colócalo al final del cable corto. El terminal `POWER` es +5 V.
5. **No dibujes los pines de alimentación de los chips** (VCC y GND de cada chip): Proteus los conecta solo.
6. Para ahorrar tiempo, copia un chip ya cableado (Ctrl+C, Ctrl+V) y solo cambia las etiquetas.

### 0.4 Simular

- El botón **Play** (triángulo, abajo a la izquierda) arranca la simulación. Con los `LOGICSTATE` cambias entradas haciendo clic mientras corre.
- Pon el `DCLOCK` en una frecuencia baja (1 Hz) para ver cada paso. Doble clic en el generador y cambia **Frequency**.
- Los LEDs y `LOGICPROBE` muestran el valor de una señal.
- Arma y prueba **un módulo a la vez**, en el orden de esta guía.

---

## 1. Dispositivos de entrada y salida

Las señales que entran al circuito desde fuera. Pon cada una una vez y etiquétala con el nombre indicado.

| Señal | Qué es | Cómo dibujarla |
|---|---|---|
| `CLK555` | Reloj automático | **Opción simple:** un `DCLOCK` a 1 Hz con su salida etiquetada `CLK555`. **Opción fiel:** un `NE555` astable: pines 4 y 8 a `VCC`, 1 a `GND`, 1 kΩ de `VCC` al pin 7, 1 kΩ más un potenciómetro de 100 kΩ en serie del pin 7 a los pines 2 y 6 (unidos), 1 µF de 2/6 a `GND`, 10 nF del pin 5 a `GND`. La salida es el pin 3 |
| `AUTO` | Modo del reloj: 1 = reloj automático, 0 = paso a paso | Un `LOGICSTATE` |
| `STEP_A`, `STEP_B` | Pulsador de paso a paso (SPDT) | Un `SW-SPDT` con el **común a GND**. El contacto **normalmente cerrado** va a `STEP_A` y el **normalmente abierto** a `STEP_B`. Cada uno lleva una resistencia de 10 kΩ a `VCC`. En reposo `STEP_A`=0 y `STEP_B`=1 |
| `WR_A`, `WR_B` | Pulsador de escritura (SPDT) | Igual que el anterior: normalmente cerrado a `WR_A`, normalmente abierto a `WR_B`, ambos con 10 kΩ a `VCC` |
| `nRESET` | Reset, activo en bajo | Un `BUTTON` entre `nRESET` y `GND`, con 10 kΩ de `nRESET` a `VCC`. En reposo vale 1. Para simular sin soltar el botón, usa un `LOGICSTATE` que empiece en 0 y pásalo a 1 |
| `PROG` | 1 = modo programación, 0 = ejecutar | Un `LOGICSTATE` |
| `DIPD0` a `DIPD7` | Dato a escribir en memoria | Ocho `LOGICSTATE` (o un DIP de 8). En la protoboard cada uno lleva 10 kΩ a GND |
| `DIPA0` a `DIPA2` | Dirección a escribir | Tres `LOGICSTATE` |

**Salidas (LEDs).** Para ver una señal, conecta un LED con una resistencia de 330 Ω desde la señal a `GND`. Las señales que conviene ver: `BUS0`..`BUS7`, `A0`..`A7`, `IR0`..`IR7`, `OUT0`..`OUT7`, `PC0`..`PC2`, `PH0`, `PH1`, `Zf`, `Cf`, `Nf` y `Vf`. Son los 41 LEDs de la lista de materiales.

---

## Paso 2. Reloj y reset

Dos latch SR con 74LS00 para quitar el rebote de los pulsadores de **paso a paso** y de **escritura**, inversores y compuertas que mezclan el reloj automático con el manual, la señal de reset y el flip-flop de HLT.

Algunas señales de este módulo (`nHALTQ`, `HALT_D`, `MEM_WE`) las produce un módulo de más adelante. Déjalas etiquetadas aunque aún no estén conectadas.

**Prueba:** con `AUTO`=1, `SYSCLK` es un reloj (ponle un LED). Con `AUTO`=0, cada pulsación de `STEP` da **un solo** pulso en `SYSCLK`, sin rebotes.

### 74LS00 antirrebote PASO A PASO (latch SR)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `STEP_A` |
| 2 | 1B | `STEPQ` |
| 3 | 1Y | `STEP_nQ` |
| 4 | 2A | `STEP_B` |
| 5 | 2B | `STEP_nQ` |
| 6 | 2Y | `STEPQ` |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS00 antirrebote ESCRIBIR (latch SR)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `WR_A` |
| 2 | 1B | `BTN_WRITE` |
| 3 | 1Y | `WR_nQ` |
| 4 | 2A | `WR_B` |
| 5 | 2B | `WR_nQ` |
| 6 | 2Y | `BTN_WRITE` |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS04 compuertas 1 (paso 2)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `AUTO` |
| 2 | 1Y | `nAUTO` |
| 3 | 2A | `PROG` |
| 4 | 2Y | `nPROG` |
| 5 | 3A | `SYSCLK` |
| 6 | 3Y | `nSYSCLK` |
| 7 | GND | GND |
| 8 | 4Y | `nCLKsrc` |
| 9 | 4A | `CLKsrc` |
| 10 | 5Y | sin conectar (salida sin usar) |
| 11 | 5A | `GND` (entrada sin usar) |
| 12 | 6Y | sin conectar (salida sin usar) |
| 13 | 6A | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS08 compuertas 1 (paso 2)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `AUTO` |
| 2 | 1B | `CLK555` |
| 3 | 1Y | `clk_auto` |
| 4 | 2A | `nAUTO` |
| 5 | 2B | `STEPQ` |
| 6 | 2Y | `clk_step` |
| 7 | GND | GND |
| 8 | 3Y | `nRST_TOTAL` |
| 9 | 3A | `nRESET` |
| 10 | 3B | `nPROG` |
| 11 | 4Y | `SYSCLK` |
| 12 | 4A | `CLKsrc` |
| 13 | 4B | `nHALTQ` |
| 14 | VCC | +5 V (VCC) |

### 74LS32 compuertas 1 (paso 2)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `clk_auto` |
| 2 | 1B | `clk_step` |
| 3 | 1Y | `CLKsrc` |
| 4 | 2A | `GND` (entrada sin usar) |
| 5 | 2B | `GND` (entrada sin usar) |
| 6 | 2Y | sin conectar (salida sin usar) |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS74 bandera HLT

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /1CLR | `nRST_TOTAL` |
| 2 | 1D | `HALT_D` |
| 3 | 1CLK | `nCLKsrc` |
| 4 | /1PRE | `VCC` |
| 5 | 1Q | `HALTQ` |
| 6 | /1Q | `nHALTQ` |
| 7 | GND | GND |
| 8 | /2Q | sin conectar (salida sin usar) |
| 9 | 2Q | sin conectar (salida sin usar) |
| 10 | /2PRE | `VCC` |
| 11 | 2CLK | `GND` (entrada sin usar) |
| 12 | 2D | `GND` (entrada sin usar) |
| 13 | /2CLR | `VCC` |
| 14 | VCC | +5 V (VCC) |

---

## Paso 3. Contador de programa (PC)

Un 74LS161 cuenta de 0 a 7 usando solo QA, QB y QC.

**Prueba:** pon `T1`=1 (con un `LOGICSTATE` temporal, porque aún no existe), `nPC_LOAD`=1 y `nRST_TOTAL`=1: los LEDs de `PC0`..`PC2` cuentan 0 a 7. Con `T1`=0 se mantienen. Con `IR0`..`IR2`=101 y `nPC_LOAD`=0, el siguiente pulso salta a 5.

### 74LS161 PC

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /CLR | `nRST_TOTAL` |
| 2 | CLK | `SYSCLK` |
| 3 | A | `IR0` |
| 4 | B | `IR1` |
| 5 | C | `IR2` |
| 6 | D | `GND` |
| 7 | ENP | `T1` |
| 8 | GND | GND |
| 9 | /LOAD | `nPC_LOAD` |
| 10 | ENT | `T1` |
| 11 | QD | sin conectar (salida sin usar) |
| 12 | QC | `PC2` |
| 13 | QB | `PC1` |
| 14 | QA | `PC0` |
| 15 | RCO | sin conectar (salida sin usar) |
| 16 | VCC | +5 V (VCC) |

---

## Paso 4. Registros, bus y selector de dirección

Los registros MAR, IR, A, B, OUT y MDR son 74LS377: cargan en el flanco de subida de `SYSCLK` cuando su pin `/E` vale 0. Los tres 74LS245 son los buffers que ponen datos en el bus: interruptores, registro A y ALU. **Nunca habilites dos a la vez.** `BUS0`..`BUS7` es el bus de datos.

**Prueba:** con `PROG`=1 los interruptores `DIPD` aparecen en los LEDs del bus. Carga un valor en A (con `nA_LD`=0 y un pulso de reloj) y comprueba que se mantiene al cambiar los interruptores.

### 74LS157 PC o IR a MAR

| Pin | Nombre | Señal |
|---|---|---|
| 1 | S | `ADDR_SEL` |
| 2 | 1A | `PC0` |
| 3 | 1B | `IR0` |
| 4 | 1Y | `MARD0` |
| 5 | 2A | `PC1` |
| 6 | 2B | `IR1` |
| 7 | 2Y | `MARD1` |
| 8 | GND | GND |
| 9 | 3Y | `MARD2` |
| 10 | 3B | `IR2` |
| 11 | 3A | `PC2` |
| 12 | 4Y | sin conectar (salida sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | 4A | `GND` (entrada sin usar) |
| 15 | /G | `GND` |
| 16 | VCC | +5 V (VCC) |

### 74LS377 MAR

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nMAR_LD` |
| 2 | 1Q | `MAR0` |
| 3 | 1D | `MARD0` |
| 4 | 2D | `MARD1` |
| 5 | 2Q | `MAR1` |
| 6 | 3Q | `MAR2` |
| 7 | 3D | `MARD2` |
| 8 | 4D | `GND` |
| 9 | 4Q | sin conectar (salida sin usar) |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | sin conectar (salida sin usar) |
| 13 | 5D | `GND` |
| 14 | 6D | `GND` |
| 15 | 6Q | sin conectar (salida sin usar) |
| 16 | 7Q | sin conectar (salida sin usar) |
| 17 | 7D | `GND` |
| 18 | 8D | `GND` |
| 19 | 8Q | sin conectar (salida sin usar) |
| 20 | VCC | +5 V (VCC) |

### 74LS377 IR

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nT1` |
| 2 | 1Q | `IR0` |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 5 | 2Q | `IR1` |
| 6 | 3Q | `IR2` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 9 | 4Q | `IR3` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | `IR4` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 15 | 6Q | `IR5` |
| 16 | 7Q | `IR6` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 19 | 8Q | `IR7` |
| 20 | VCC | +5 V (VCC) |

### 74LS377 A

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nA_LD` |
| 2 | 1Q | `A0` |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 5 | 2Q | `A1` |
| 6 | 3Q | `A2` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 9 | 4Q | `A3` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | `A4` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 15 | 6Q | `A5` |
| 16 | 7Q | `A6` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 19 | 8Q | `A7` |
| 20 | VCC | +5 V (VCC) |

### 74LS377 B

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nB_LD` |
| 2 | 1Q | `B0` |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 5 | 2Q | `B1` |
| 6 | 3Q | `B2` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 9 | 4Q | `B3` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | `B4` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 15 | 6Q | `B5` |
| 16 | 7Q | `B6` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 19 | 8Q | `B7` |
| 20 | VCC | +5 V (VCC) |

### 74LS377 OUT

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nOUT_LD` |
| 2 | 1Q | `OUT0` |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 5 | 2Q | `OUT1` |
| 6 | 3Q | `OUT2` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 9 | 4Q | `OUT3` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | `OUT4` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 15 | 6Q | `OUT5` |
| 16 | 7Q | `OUT6` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 19 | 8Q | `OUT7` |
| 20 | VCC | +5 V (VCC) |

### 74LS377 MDR

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nMDR_LD` |
| 2 | 1Q | `MDR0` |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 5 | 2Q | `MDR1` |
| 6 | 3Q | `MDR2` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 9 | 4Q | `MDR3` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | `MDR4` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 15 | 6Q | `MDR5` |
| 16 | 7Q | `MDR6` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 19 | 8Q | `MDR7` |
| 20 | VCC | +5 V (VCC) |

### 74LS245 interruptores al bus

| Pin | Nombre | Señal |
|---|---|---|
| 1 | DIR | `VCC` |
| 2 | A1 | `DIPD0` |
| 3 | A2 | `DIPD1` |
| 4 | A3 | `DIPD2` |
| 5 | A4 | `DIPD3` |
| 6 | A5 | `DIPD4` |
| 7 | A6 | `DIPD5` |
| 8 | A7 | `DIPD6` |
| 9 | A8 | `DIPD7` |
| 10 | GND | GND |
| 11 | B8 | `BUS7` |
| 12 | B7 | `BUS6` |
| 13 | B6 | `BUS5` |
| 14 | B5 | `BUS4` |
| 15 | B4 | `BUS3` |
| 16 | B3 | `BUS2` |
| 17 | B2 | `BUS1` |
| 18 | B1 | `BUS0` |
| 19 | /OE | `nPROG` |
| 20 | VCC | +5 V (VCC) |

### 74LS245 A al bus

| Pin | Nombre | Señal |
|---|---|---|
| 1 | DIR | `VCC` |
| 2 | A1 | `A0` |
| 3 | A2 | `A1` |
| 4 | A3 | `A2` |
| 5 | A4 | `A3` |
| 6 | A5 | `A4` |
| 7 | A6 | `A5` |
| 8 | A7 | `A6` |
| 9 | A8 | `A7` |
| 10 | GND | GND |
| 11 | B8 | `BUS7` |
| 12 | B7 | `BUS6` |
| 13 | B6 | `BUS5` |
| 14 | B5 | `BUS4` |
| 15 | B4 | `BUS3` |
| 16 | B3 | `BUS2` |
| 17 | B2 | `BUS1` |
| 18 | B1 | `BUS0` |
| 19 | /OE | `nA_OUT` |
| 20 | VCC | +5 V (VCC) |

### 74LS245 ALU al bus

| Pin | Nombre | Señal |
|---|---|---|
| 1 | DIR | `VCC` |
| 2 | A1 | `RES0` |
| 3 | A2 | `RES1` |
| 4 | A3 | `RES2` |
| 5 | A4 | `RES3` |
| 6 | A5 | `RES4` |
| 7 | A6 | `RES5` |
| 8 | A7 | `RES6` |
| 9 | A8 | `RES7` |
| 10 | GND | GND |
| 11 | B8 | `BUS7` |
| 12 | B7 | `BUS6` |
| 13 | B6 | `BUS5` |
| 14 | B5 | `BUS4` |
| 15 | B4 | `BUS3` |
| 16 | B3 | `BUS2` |
| 17 | B2 | `BUS1` |
| 18 | B1 | `BUS0` |
| 19 | /OE | `nALU_OUT` |
| 20 | VCC | +5 V (VCC) |

---

## Paso 5. Memoria 8 × 8 y modo de programación

Un 74LS157 elige la dirección normal (`MAR`) o la manual (`DIPA`). Dos 74LS138 son el **DEMUX**: uno elige qué celda se lee y otro cuál se escribe. Las 8 celdas son 74LS374 (tabla al final de este paso). La señal `WE_PULSE` es el pulso de escritura.

**Prueba:** con `PROG`=1, escribe 0x01 en la dirección 0, 0x02 en la 1, 0x04 en la 2 … 0x80 en la 7 (dato en `DIPD`, dirección en `DIPA`, pulsa `WRITE`). La celda se escribe al **soltar** el pulsador. Después apaga el buffer de los interruptores y lee cada dirección con `MEM_RD`=1.

### 74LS157 dirección normal o manual

| Pin | Nombre | Señal |
|---|---|---|
| 1 | S | `PROG` |
| 2 | 1A | `MAR0` |
| 3 | 1B | `DIPA0` |
| 4 | 1Y | `ADDR0` |
| 5 | 2A | `MAR1` |
| 6 | 2B | `DIPA1` |
| 7 | 2Y | `ADDR1` |
| 8 | GND | GND |
| 9 | 3Y | `ADDR2` |
| 10 | 3B | `DIPA2` |
| 11 | 3A | `MAR2` |
| 12 | 4Y | sin conectar (salida sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | 4A | `GND` (entrada sin usar) |
| 15 | /G | `GND` |
| 16 | VCC | +5 V (VCC) |

### 74LS138 lectura (decodificador)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | A | `ADDR0` |
| 2 | B | `ADDR1` |
| 3 | C | `ADDR2` |
| 4 | /G2A | `GND` |
| 5 | /G2B | `GND` |
| 6 | G1 | `MEM_RD` |
| 7 | Y7 | `nRD7` |
| 8 | GND | GND |
| 9 | Y6 | `nRD6` |
| 10 | Y5 | `nRD5` |
| 11 | Y4 | `nRD4` |
| 12 | Y3 | `nRD3` |
| 13 | Y2 | `nRD2` |
| 14 | Y1 | `nRD1` |
| 15 | Y0 | `nRD0` |
| 16 | VCC | +5 V (VCC) |

### 74LS138 escritura (DEMUX)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | A | `ADDR0` |
| 2 | B | `ADDR1` |
| 3 | C | `ADDR2` |
| 4 | /G2A | `GND` |
| 5 | /G2B | `GND` |
| 6 | G1 | `WE_PULSE` |
| 7 | Y7 | `nWE7` |
| 8 | GND | GND |
| 9 | Y6 | `nWE6` |
| 10 | Y5 | `nWE5` |
| 11 | Y4 | `nWE4` |
| 12 | Y3 | `nWE3` |
| 13 | Y2 | `nWE2` |
| 14 | Y1 | `nWE1` |
| 15 | Y0 | `nWE0` |
| 16 | VCC | +5 V (VCC) |

### 74LS08 compuertas 1 (paso 5)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `PROG` |
| 2 | 1B | `BTN_WRITE` |
| 3 | 1Y | `we_prog` |
| 4 | 2A | `MEM_WE` |
| 5 | 2B | `nSYSCLK` |
| 6 | 2Y | `we_run` |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS32 compuertas 1 (paso 5)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `we_prog` |
| 2 | 1B | `we_run` |
| 3 | 1Y | `WE_PULSE` |
| 4 | 2A | `GND` (entrada sin usar) |
| 5 | 2B | `GND` (entrada sin usar) |
| 6 | 2Y | sin conectar (salida sin usar) |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### Celdas de memoria: 8 × 74LS374

Hazlas iguales y cambia solo las etiquetas de los pines 1 y 11. Los pines de datos (D y Q) van **todos a las mismas señales `BUS0`..`BUS7`**: cada celda lee y escribe por el mismo bus.

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /OC | `nRDi` (celda i: `nRD0`..`nRD7`) |
| 11 | CLK | `nWEi` (celda i: `nWE0`..`nWE7`) |
| 3 | 1D | `BUS0` |
| 4 | 2D | `BUS1` |
| 7 | 3D | `BUS2` |
| 8 | 4D | `BUS3` |
| 13 | 5D | `BUS4` |
| 14 | 6D | `BUS5` |
| 17 | 7D | `BUS6` |
| 18 | 8D | `BUS7` |
| 2 | 1Q | `BUS0` |
| 5 | 2Q | `BUS1` |
| 6 | 3Q | `BUS2` |
| 9 | 4Q | `BUS3` |
| 12 | 5Q | `BUS4` |
| 15 | 6Q | `BUS5` |
| 16 | 7Q | `BUS6` |
| 19 | 8Q | `BUS7` |
| 10 | GND | GND |
| 20 | VCC | +5 V (VCC) |

| Celda | `/OC` (pin 1) | `CLK` (pin 11) |
|---|---|---|
| 0 | `nRD0` | `nWE0` |
| 1 | `nRD1` | `nWE1` |
| 2 | `nRD2` | `nWE2` |
| 3 | `nRD3` | `nWE3` |
| 4 | `nRD4` | `nWE4` |
| 5 | `nRD5` | `nWE5` |
| 6 | `nRD6` | `nWE6` |
| 7 | `nRD7` | `nWE7` |

---

## Paso 6. ALU y banderas

Dos 74LS283 suman (y restan invirtiendo B con XOR y metiendo un 1 como acarreo). Las compuertas hacen AND, OR, XOR y NOT bit a bit. Ocho 74LS151, uno por bit, eligen el resultado según `IR4`..`IR6`. SHL y SHR son solo cableado: la entrada D6 de cada 74LS151 toma el bit de la derecha de A y la D7 el de la izquierda. El 74LS30 detecta resultado cero. Un 74LS377 guarda las banderas Z, C, N y V.

El bit `i` de la ALU es igual en los 8 casos. Si dibujas bien el bit 0, copia y pega el 74LS151 y las compuertas y cambia las etiquetas.

**Prueba:** con los valores del PDF en A y B y la operación en `IR4`..`IR6` (ADD=000 … SHR=111), comprueba `RES0`..`RES7` contra la tabla del paso 6 de `PLAN_CONSTRUCCION.md`.

### 74LS04 compuertas 1 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `IR5` |
| 2 | 1Y | `nIR5` |
| 3 | 2A | `IR6` |
| 4 | 2Y | `nIR6` |
| 5 | 3A | `A0` |
| 6 | 3Y | `NOT0` |
| 7 | GND | GND |
| 8 | 4Y | `NOT1` |
| 9 | 4A | `A1` |
| 10 | 5Y | `NOT2` |
| 11 | 5A | `A2` |
| 12 | 6Y | `NOT3` |
| 13 | 6A | `A3` |
| 14 | VCC | +5 V (VCC) |

### 74LS08 compuertas 1 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `nIR5` |
| 2 | 1B | `nIR6` |
| 3 | 1Y | `sub_t` |
| 4 | 2A | `sub_t` |
| 5 | 2B | `IR4` |
| 6 | 2Y | `SUB` |
| 7 | GND | GND |
| 8 | 3Y | `AND0` |
| 9 | 3A | `A0` |
| 10 | 3B | `B0` |
| 11 | 4Y | `AND1` |
| 12 | 4A | `A1` |
| 13 | 4B | `B1` |
| 14 | VCC | +5 V (VCC) |

### 74LS86 compuertas 1 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `B0` |
| 2 | 1B | `SUB` |
| 3 | 1Y | `Bx0` |
| 4 | 2A | `B1` |
| 5 | 2B | `SUB` |
| 6 | 2Y | `Bx1` |
| 7 | GND | GND |
| 8 | 3Y | `Bx2` |
| 9 | 3A | `B2` |
| 10 | 3B | `SUB` |
| 11 | 4Y | `Bx3` |
| 12 | 4A | `B3` |
| 13 | 4B | `SUB` |
| 14 | VCC | +5 V (VCC) |

### 74LS86 compuertas 2 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `B4` |
| 2 | 1B | `SUB` |
| 3 | 1Y | `Bx4` |
| 4 | 2A | `B5` |
| 5 | 2B | `SUB` |
| 6 | 2Y | `Bx5` |
| 7 | GND | GND |
| 8 | 3Y | `Bx6` |
| 9 | 3A | `B6` |
| 10 | 3B | `SUB` |
| 11 | 4Y | `Bx7` |
| 12 | 4A | `B7` |
| 13 | 4B | `SUB` |
| 14 | VCC | +5 V (VCC) |

### 74LS283 bits 0-3

| Pin | Nombre | Señal |
|---|---|---|
| 1 | S2 | `S1` |
| 2 | B2 | `Bx1` |
| 3 | A2 | `A1` |
| 4 | S1 | `S0` |
| 5 | A1 | `A0` |
| 6 | B1 | `Bx0` |
| 7 | C0 | `SUB` |
| 8 | GND | GND |
| 9 | C4 | `C4A` |
| 10 | S4 | `S3` |
| 11 | B4 | `Bx3` |
| 12 | A4 | `A3` |
| 13 | S3 | `S2` |
| 14 | A3 | `A2` |
| 15 | B3 | `Bx2` |
| 16 | VCC | +5 V (VCC) |

### 74LS283 bits 4-7

| Pin | Nombre | Señal |
|---|---|---|
| 1 | S2 | `S5` |
| 2 | B2 | `Bx5` |
| 3 | A2 | `A5` |
| 4 | S1 | `S4` |
| 5 | A1 | `A4` |
| 6 | B1 | `Bx4` |
| 7 | C0 | `C4A` |
| 8 | GND | GND |
| 9 | C4 | `CARRY` |
| 10 | S4 | `S7` |
| 11 | B4 | `Bx7` |
| 12 | A4 | `A7` |
| 13 | S3 | `S6` |
| 14 | A3 | `A6` |
| 15 | B3 | `Bx6` |
| 16 | VCC | +5 V (VCC) |

### 74LS32 compuertas 1 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A0` |
| 2 | 1B | `B0` |
| 3 | 1Y | `OR0` |
| 4 | 2A | `A1` |
| 5 | 2B | `B1` |
| 6 | 2Y | `OR1` |
| 7 | GND | GND |
| 8 | 3Y | `OR2` |
| 9 | 3A | `A2` |
| 10 | 3B | `B2` |
| 11 | 4Y | `OR3` |
| 12 | 4A | `A3` |
| 13 | 4B | `B3` |
| 14 | VCC | +5 V (VCC) |

### 74LS86 compuertas 3 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A0` |
| 2 | 1B | `B0` |
| 3 | 1Y | `XOR0` |
| 4 | 2A | `A1` |
| 5 | 2B | `B1` |
| 6 | 2Y | `XOR1` |
| 7 | GND | GND |
| 8 | 3Y | `XOR2` |
| 9 | 3A | `A2` |
| 10 | 3B | `B2` |
| 11 | 4Y | `XOR3` |
| 12 | 4A | `A3` |
| 13 | 4B | `B3` |
| 14 | VCC | +5 V (VCC) |

### 74LS08 compuertas 2 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A2` |
| 2 | 1B | `B2` |
| 3 | 1Y | `AND2` |
| 4 | 2A | `A3` |
| 5 | 2B | `B3` |
| 6 | 2Y | `AND3` |
| 7 | GND | GND |
| 8 | 3Y | `AND4` |
| 9 | 3A | `A4` |
| 10 | 3B | `B4` |
| 11 | 4Y | `AND5` |
| 12 | 4A | `A5` |
| 13 | 4B | `B5` |
| 14 | VCC | +5 V (VCC) |

### 74LS32 compuertas 2 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A4` |
| 2 | 1B | `B4` |
| 3 | 1Y | `OR4` |
| 4 | 2A | `A5` |
| 5 | 2B | `B5` |
| 6 | 2Y | `OR5` |
| 7 | GND | GND |
| 8 | 3Y | `OR6` |
| 9 | 3A | `A6` |
| 10 | 3B | `B6` |
| 11 | 4Y | `OR7` |
| 12 | 4A | `A7` |
| 13 | 4B | `B7` |
| 14 | VCC | +5 V (VCC) |

### 74LS86 compuertas 4 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A4` |
| 2 | 1B | `B4` |
| 3 | 1Y | `XOR4` |
| 4 | 2A | `A5` |
| 5 | 2B | `B5` |
| 6 | 2Y | `XOR5` |
| 7 | GND | GND |
| 8 | 3Y | `XOR6` |
| 9 | 3A | `A6` |
| 10 | 3B | `B6` |
| 11 | 4Y | `XOR7` |
| 12 | 4A | `A7` |
| 13 | 4B | `B7` |
| 14 | VCC | +5 V (VCC) |

### 74LS04 compuertas 2 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A4` |
| 2 | 1Y | `NOT4` |
| 3 | 2A | `A5` |
| 4 | 2Y | `NOT5` |
| 5 | 3A | `A6` |
| 6 | 3Y | `NOT6` |
| 7 | GND | GND |
| 8 | 4Y | `NOT7` |
| 9 | 4A | `A7` |
| 10 | 5Y | `Zn` |
| 11 | 5A | `nZALL` |
| 12 | 6Y | `v_n` |
| 13 | 6A | `v_x1` |
| 14 | VCC | +5 V (VCC) |

### 74LS08 compuertas 3 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A6` |
| 2 | 1B | `B6` |
| 3 | 1Y | `AND6` |
| 4 | 2A | `A7` |
| 5 | 2B | `B7` |
| 6 | 2Y | `AND7` |
| 7 | GND | GND |
| 8 | 3Y | `Vn` |
| 9 | 3A | `v_n` |
| 10 | 3B | `v_x2` |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS151 bit 0

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR0` |
| 2 | D2 | `AND0` |
| 3 | D1 | `S0` |
| 4 | D0 | `S0` |
| 5 | Y | `RES0` |
| 6 | W (/Y) | `nRES0` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A1` |
| 13 | D6 | `GND` |
| 14 | D5 | `NOT0` |
| 15 | D4 | `XOR0` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 1

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR1` |
| 2 | D2 | `AND1` |
| 3 | D1 | `S1` |
| 4 | D0 | `S1` |
| 5 | Y | `RES1` |
| 6 | W (/Y) | `nRES1` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A2` |
| 13 | D6 | `A0` |
| 14 | D5 | `NOT1` |
| 15 | D4 | `XOR1` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 2

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR2` |
| 2 | D2 | `AND2` |
| 3 | D1 | `S2` |
| 4 | D0 | `S2` |
| 5 | Y | `RES2` |
| 6 | W (/Y) | `nRES2` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A3` |
| 13 | D6 | `A1` |
| 14 | D5 | `NOT2` |
| 15 | D4 | `XOR2` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 3

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR3` |
| 2 | D2 | `AND3` |
| 3 | D1 | `S3` |
| 4 | D0 | `S3` |
| 5 | Y | `RES3` |
| 6 | W (/Y) | `nRES3` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A4` |
| 13 | D6 | `A2` |
| 14 | D5 | `NOT3` |
| 15 | D4 | `XOR3` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 4

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR4` |
| 2 | D2 | `AND4` |
| 3 | D1 | `S4` |
| 4 | D0 | `S4` |
| 5 | Y | `RES4` |
| 6 | W (/Y) | `nRES4` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A5` |
| 13 | D6 | `A3` |
| 14 | D5 | `NOT4` |
| 15 | D4 | `XOR4` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 5

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR5` |
| 2 | D2 | `AND5` |
| 3 | D1 | `S5` |
| 4 | D0 | `S5` |
| 5 | Y | `RES5` |
| 6 | W (/Y) | `nRES5` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A6` |
| 13 | D6 | `A4` |
| 14 | D5 | `NOT5` |
| 15 | D4 | `XOR5` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 6

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR6` |
| 2 | D2 | `AND6` |
| 3 | D1 | `S6` |
| 4 | D0 | `S6` |
| 5 | Y | `RES6` |
| 6 | W (/Y) | `nRES6` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `A7` |
| 13 | D6 | `A5` |
| 14 | D5 | `NOT6` |
| 15 | D4 | `XOR6` |
| 16 | VCC | +5 V (VCC) |

### 74LS151 bit 7

| Pin | Nombre | Señal |
|---|---|---|
| 1 | D3 | `OR7` |
| 2 | D2 | `AND7` |
| 3 | D1 | `S7` |
| 4 | D0 | `S7` |
| 5 | Y | `RES7` |
| 6 | W (/Y) | `nRES7` |
| 7 | /E | `GND` |
| 8 | GND | GND |
| 9 | C | `IR6` |
| 10 | B | `IR5` |
| 11 | A | `IR4` |
| 12 | D7 | `GND` |
| 13 | D6 | `A6` |
| 14 | D5 | `NOT7` |
| 15 | D4 | `XOR7` |
| 16 | VCC | +5 V (VCC) |

### 74LS30 detector de cero

| Pin | Nombre | Señal |
|---|---|---|
| 1 | A | `nRES0` |
| 2 | B | `nRES1` |
| 3 | C | `nRES2` |
| 4 | D | `nRES3` |
| 5 | E | `nRES4` |
| 6 | F | `nRES5` |
| 7 | GND | GND |
| 8 | Y | `nZALL` |
| 9 | NC | sin conectar |
| 10 | NC | sin conectar |
| 11 | G | `nRES6` |
| 12 | H | `nRES7` |
| 13 | NC | sin conectar |
| 14 | VCC | +5 V (VCC) |

### 74LS86 compuertas 5 (paso 6)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `A7` |
| 2 | 1B | `Bx7` |
| 3 | 1Y | `v_x1` |
| 4 | 2A | `A7` |
| 5 | 2B | `S7` |
| 6 | 2Y | `v_x2` |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS377 BANDERAS (Z C N V)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /E | `nALU_OUT` |
| 2 | 1Q | `Zf` |
| 3 | 1D | `Zn` |
| 4 | 2D | `CARRY` |
| 5 | 2Q | `Cf` |
| 6 | 3Q | `Nf` |
| 7 | 3D | `RES7` |
| 8 | 4D | `Vn` |
| 9 | 4Q | `Vf` |
| 10 | GND | GND |
| 11 | CLK | `SYSCLK` |
| 12 | 5Q | sin conectar (salida sin usar) |
| 13 | 5D | `GND` |
| 14 | 6D | `GND` |
| 15 | 6Q | sin conectar (salida sin usar) |
| 16 | 7Q | sin conectar (salida sin usar) |
| 17 | 7D | `GND` |
| 18 | 8D | `GND` |
| 19 | 8Q | sin conectar (salida sin usar) |
| 20 | VCC | +5 V (VCC) |

---

## Paso 7. Unidad de control

Un 74LS161 cuenta las fases T0 a T3. Un 74LS138 las decodifica y otro 74LS138 decodifica la instrucción. Las compuertas generan las señales de control según las ecuaciones de `PLAN_CONSTRUCCION.md`.

**Prueba:** primero conecta LEDs a las señales de control, sin conectarlas aún a los registros. Pon una instrucción en IR y, en paso a paso, comprueba que las señales se activan en la fase indicada en la tabla del plan. Después conéctalas.

### 74LS161 fases T0-T3

| Pin | Nombre | Señal |
|---|---|---|
| 1 | /CLR | `nRST_TOTAL` |
| 2 | CLK | `SYSCLK` |
| 3 | A | `GND` (entrada sin usar) |
| 4 | B | `GND` (entrada sin usar) |
| 5 | C | `GND` (entrada sin usar) |
| 6 | D | `GND` (entrada sin usar) |
| 7 | ENP | `VCC` |
| 8 | GND | GND |
| 9 | /LOAD | `VCC` |
| 10 | ENT | `VCC` |
| 11 | QD | sin conectar (salida sin usar) |
| 12 | QC | sin conectar (salida sin usar) |
| 13 | QB | `PH1` |
| 14 | QA | `PH0` |
| 15 | RCO | sin conectar (salida sin usar) |
| 16 | VCC | +5 V (VCC) |

### 74LS138 fases

| Pin | Nombre | Señal |
|---|---|---|
| 1 | A | `PH0` |
| 2 | B | `PH1` |
| 3 | C | `GND` |
| 4 | /G2A | `GND` |
| 5 | /G2B | `GND` |
| 6 | G1 | `VCC` |
| 7 | Y7 | sin conectar (salida sin usar) |
| 8 | GND | GND |
| 9 | Y6 | sin conectar (salida sin usar) |
| 10 | Y5 | sin conectar (salida sin usar) |
| 11 | Y4 | sin conectar (salida sin usar) |
| 12 | Y3 | `nT3` |
| 13 | Y2 | `nT2` |
| 14 | Y1 | `nT1` |
| 15 | Y0 | `nT0` |
| 16 | VCC | +5 V (VCC) |

### 74LS138 instrucción

| Pin | Nombre | Señal |
|---|---|---|
| 1 | A | `IR4` |
| 2 | B | `IR5` |
| 3 | C | `IR6` |
| 4 | /G2A | `GND` |
| 5 | /G2B | `GND` |
| 6 | G1 | `IR7` |
| 7 | Y7 | sin conectar (salida sin usar) |
| 8 | GND | GND |
| 9 | Y6 | `nHLT` |
| 10 | Y5 | `nOUT` |
| 11 | Y4 | `nJZ` |
| 12 | Y3 | `nJMP` |
| 13 | Y2 | `nSTA` |
| 14 | Y1 | `nLDB` |
| 15 | Y0 | `nLDA` |
| 16 | VCC | +5 V (VCC) |

### 74LS04 compuertas 1 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `nT1` |
| 2 | 1Y | `T1` |
| 3 | 2A | `nT3` |
| 4 | 2Y | `T3` |
| 5 | 3A | `nT2` |
| 6 | 3Y | `ADDR_SEL` |
| 7 | GND | GND |
| 8 | 4Y | `ALUC` |
| 9 | 4A | `IR7` |
| 10 | 5Y | `JZ` |
| 11 | 5A | `nJZ` |
| 12 | 6Y | `STA` |
| 13 | 6A | `nSTA` |
| 14 | VCC | +5 V (VCC) |

### 74LS04 compuertas 2 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `nHLT` |
| 2 | 1Y | `HLT` |
| 3 | 2A | `mdr_or` |
| 4 | 2Y | `nMDR_LD` |
| 5 | 3A | `GND` (entrada sin usar) |
| 6 | 3Y | sin conectar (salida sin usar) |
| 7 | GND | GND |
| 8 | 4Y | sin conectar (salida sin usar) |
| 9 | 4A | `GND` (entrada sin usar) |
| 10 | 5Y | sin conectar (salida sin usar) |
| 11 | 5A | `GND` (entrada sin usar) |
| 12 | 6Y | sin conectar (salida sin usar) |
| 13 | 6A | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS08 compuertas 1 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `nT0` |
| 2 | 1B | `nT2` |
| 3 | 1Y | `nMAR_LD` |
| 4 | 2A | `T3` |
| 5 | 2B | `LDX` |
| 6 | 2Y | `t3x` |
| 7 | GND | GND |
| 8 | 3Y | `MEM_WE` |
| 9 | 3A | `T3` |
| 10 | 3B | `STA` |
| 11 | 4Y | `HLT_SET` |
| 12 | 4A | `T3` |
| 13 | 4B | `HLT` |
| 14 | VCC | +5 V (VCC) |

### 74LS00 compuertas 1 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `nLDA` |
| 2 | 1B | `nLDB` |
| 3 | 1Y | `LDX` |
| 4 | 2A | `nLDA` |
| 5 | 2B | `IR7` |
| 6 | 2Y | `ld_or_alu` |
| 7 | GND | GND |
| 8 | 3Y | `nA_LD` |
| 9 | 3A | `T3` |
| 10 | 3B | `ld_or_alu` |
| 11 | 4Y | `sta_or_out` |
| 12 | 4A | `nSTA` |
| 13 | 4B | `nOUT` |
| 14 | VCC | +5 V (VCC) |

### 74LS32 compuertas 1 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `T1` |
| 2 | 1B | `t3x` |
| 3 | 1Y | `MEM_RD` |
| 4 | 2A | `nT3` |
| 5 | 2B | `nLDB` |
| 6 | 2Y | `nB_LD` |
| 7 | GND | GND |
| 8 | 3Y | `nOUT_LD` |
| 9 | 3A | `nT3` |
| 10 | 3B | `nOUT` |
| 11 | 4Y | `HALT_D` |
| 12 | 4A | `HALTQ` |
| 13 | 4B | `HLT_SET` |
| 14 | VCC | +5 V (VCC) |

### 74LS00 compuertas 2 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `T3` |
| 2 | 1B | `sta_or_out` |
| 3 | 1Y | `nA_OUT` |
| 4 | 2A | `T3` |
| 5 | 2B | `ALUC` |
| 6 | 2Y | `nALU_OUT` |
| 7 | GND | GND |
| 8 | 3Y | `jz_z` |
| 9 | 3A | `JZ` |
| 10 | 3B | `Zf` |
| 11 | 4Y | `jmp_or_jz` |
| 12 | 4A | `nJMP` |
| 13 | 4B | `jz_z` |
| 14 | VCC | +5 V (VCC) |

### 74LS00 compuertas 3 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `T3` |
| 2 | 1B | `jmp_or_jz` |
| 3 | 1Y | `nPC_LOAD` |
| 4 | 2A | `GND` (entrada sin usar) |
| 5 | 2B | `GND` (entrada sin usar) |
| 6 | 2Y | sin conectar (salida sin usar) |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

### 74LS32 compuertas 2 (paso 7)

| Pin | Nombre | Señal |
|---|---|---|
| 1 | 1A | `MEM_RD` |
| 2 | 1B | `MEM_WE` |
| 3 | 1Y | `mdr_or` |
| 4 | 2A | `GND` (entrada sin usar) |
| 5 | 2B | `GND` (entrada sin usar) |
| 6 | 2Y | sin conectar (salida sin usar) |
| 7 | GND | GND |
| 8 | 3Y | sin conectar (salida sin usar) |
| 9 | 3A | `GND` (entrada sin usar) |
| 10 | 3B | `GND` (entrada sin usar) |
| 11 | 4Y | sin conectar (salida sin usar) |
| 12 | 4A | `GND` (entrada sin usar) |
| 13 | 4B | `GND` (entrada sin usar) |
| 14 | VCC | +5 V (VCC) |

---

## Glosario de señales

| Señal | Significado |
|---|---|
| `SYSCLK` | Reloj del sistema. Todos los registros cargan en su flanco de subida |
| `CLKsrc` | Reloj elegido (automático o paso a paso), antes de la compuerta de HLT |
| `nRST_TOTAL` | Reset general: se activa con el botón de reset o con `PROG`=1 |
| `PH0`, `PH1` | Número de fase (T0 a T3) |
| `nT0`..`nT3` | La fase activa vale 0 en su línea. `T1` y `T3` son las versiones invertidas |
| `IR0`..`IR7` | Instrucción: `IR7`..`IR4` es el opcode y `IR2`..`IR0` es la dirección |
| `nLDA`, `nLDB`, `nSTA`, `nJMP`, `nJZ`, `nOUT`, `nHLT` | Instrucción decodificada (activas en bajo) |
| `MAR0`..`MAR2` | Dirección de memoria |
| `ADDR_SEL` | 0 = el MAR carga el PC, 1 = el MAR carga el operando del IR |
| `ADDR0`..`ADDR2` | Dirección final que entra a los decodificadores de memoria |
| `MEM_RD`, `MEM_WE` | Lectura y escritura de memoria |
| `WE_PULSE` | Pulso de escritura (de `PROG`·botón o de `MEM_WE`·reloj) |
| `nRD0`..`nRD7`, `nWE0`..`nWE7` | Selección de cada celda para leer y para escribir |
| `nMAR_LD`, `nIR_LD`, `nA_LD`, `nB_LD`, `nOUT_LD`, `nMDR_LD` | Habilitación de carga de cada registro (activa en bajo) |
| `nA_OUT`, `nALU_OUT` | Habilitan el buffer de A y el de la ALU hacia el bus |
| `nPC_LOAD` | Carga el PC con el operando del IR (JMP, JZ) |
| `Zf`, `Cf`, `Nf`, `Vf` | Banderas guardadas: cero, acarreo, negativo y desbordamiento |
| `RES0`..`RES7` | Resultado de la ALU |
| `HALTQ`, `nHALTQ` | La CPU está detenida / no lo está |

## Dónde mirar si algo falla

- **Valores `X` o líneas en conflicto:** dos buffers de bus están activos a la vez. Revisa `nA_OUT`, `nALU_OUT`, `PROG` y `MEM_RD`.
- **Nada cambia:** revisa que cada `/E` y cada `/OE` tengan la señal correcta. Una entrada sin conectar en Proteus se comporta distinto que en la protoboard.
- **STA no guarda en memoria:** esta es la ruta más delicada, porque el pulso de escritura sale del propio reloj. Proteus simula retardos reales. Ese retardo también existe en la protoboard, así que si falla aquí, probablemente falle allí.
- **Programas de prueba:** están en hexadecimal en el paso 8 de `PLAN_CONSTRUCCION.md`. Para el programa 1 (5 + 3) la memoria lleva `86 97 00 D0 E0 00 05 03`, y `OUT` debe terminar en `08`.
