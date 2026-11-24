# Plan de construcción física: computadora de 8 bits

Este plan sigue el PDF del proyecto. Cada paso lleva los chips, las conexiones y una prueba. No pases al siguiente paso hasta que la prueba pase.

Cambios respecto a la lista de compra anterior (ya corregidos en `lista_materiales.html`):
- Registros A, B, IR, OUT, MAR, MDR y banderas: **74LS377** (7 piezas).
- Memoria: **74LS374** (8 piezas).
- Banderas en un 74LS377, no en 74LS74. Queda 1× 74LS74 solo para HLT.
- Pulsadores de paso y escritura: **conmutados (SPDT)**, 2 piezas.
- 41 LEDs y 41 resistencias de 330 Ω (bus, A, IR, OUT, PC, 2 fases y 4 banderas).
- 40 condensadores de 100 nF (ver regla 3).
- Sin fuente ni componentes de alimentación en la lista: se usa una fuente de laboratorio.

---

## 0. Reglas de montaje

1. Cable rojo para +5 V, negro para GND, amarillo para el bus de datos, azul para señales de control.
2. Apaga la fuente antes de mover cables.
3. Condensadores de 100 nF entre VCC y GND, pegados al chip: uno por cada 74LS161, 74LS377, 74LS374, 74LS245 y 74LS74 (unos 25), y uno por cada 2 o 3 chips de lógica (compuertas, 74LS138, 74LS151, 74LS157, 74LS283, 74LS30), unos 15. Total 40. Si aparecen valores que cambian solos, añade uno junto al chip afectado.
4. Ninguna entrada se deja al aire. Entradas sin uso a GND o a +5 V.
5. Todas las señales "/X" son activas en bajo (activas cuando valen 0).
6. En cada paso, revisa con el multímetro continuidad y que no haya +5 V cruzado con GND.

## 1. Arquitectura que vamos a construir

**Bus de datos BUS[7:0]**, compartido. Quién puede escribir en él (solo uno a la vez):

| Fuente | Cómo | Señal |
|---|---|---|
| Memoria | salida triestado del 74LS374 | /OC de cada celda |
| Registro A | 74LS245 | /A_OUT |
| ALU | 74LS245 | /ALU_OUT |
| Interruptores de dato | 74LS245 | activo cuando PROG=1 |

**Quién lee del bus:** A, B, IR, OUT, MDR y las celdas de memoria. MAR toma su dato de un selector de dirección, no del bus.

**Reloj:** todos los 74LS377 usan el mismo reloj SYSCLK. Cargan en el flanco de subida cuando su pin /E vale 0.

**Ciclo de 4 fases (T0 a T3):**

| Fase | Qué pasa |
|---|---|
| T0 | MAR ← PC |
| T1 | IR ← memoria[MAR]. PC se incrementa |
| T2 | MAR ← operando del IR (bits 2 a 0) |
| T3 | Ejecuta la instrucción |

**Codificación de instrucciones** (la propuesta de antes):

| Opcode | Instrucción | | Opcode | Instrucción |
|---|---|---|---|---|
| 0000 | ADD | | 1000 | LDA n |
| 0001 | SUB | | 1001 | LDB n |
| 0010 | AND | | 1010 | STA n |
| 0011 | OR | | 1011 | JMP n |
| 0100 | XOR | | 1100 | JZ n |
| 0101 | NOT | | 1101 | OUT |
| 0110 | SHL | | 1110 | HLT |
| 0111 | SHR | | 1111 | sin usar |

El opcode ocupa los bits IR7 a IR4 y el operando los bits IR3 a IR0. IR7 (bit 3 del opcode) separa las instrucciones de la ALU (0) de las demás (1). Los bits IR6 a IR4 son el código de operación de la ALU. La dirección usa IR2 a IR0, porque la memoria tiene 8 posiciones. IR3 no se usa.

---

## Paso 1. Alimentación

**Material:** fuente de laboratorio (no se compra), protoboards.

1. Enciende la fuente sin carga. Ajusta la salida a **5.0 V** y el límite de corriente a **2 A**. Compruébalo con el multímetro.
2. Apaga la fuente. Conecta el cable rojo a los rieles de +5 V y el negro a los de GND.
3. Une los rieles de +5 V y GND de todas las protoboards entre sí, en varios puntos.
4. Nunca pases de 5.25 V: los 74LS se dañan por encima de 7 V.

**Prueba:** con el multímetro, 5 V ± 0.25 en el extremo más lejano de los rieles. Si hay caída fuerte, añade más puentes de alimentación. A medida que avances, anota la corriente que muestra la fuente en cada paso.

---

## Paso 2. Reloj y reset

**Material:** 555, 74LS00, 2 pulsadores (uno SPDT), potenciómetro, resistencias, condensadores, 1 interruptor.

**Reloj automático (555 astable):**
- Pin 8 a +5 V. Pin 1 a GND. Pin 4 a +5 V.
- Pines 2 y 6 unidos.
- R1 = 1 kΩ entre +5 V y el pin 7.
- Entre el pin 7 y los pines 2 y 6: 1 kΩ en serie con el potenciómetro de 100 kΩ.
- Condensador de 1 µF entre los pines 2/6 y GND.
- Pin 5 a GND con 10 nF.
- La salida es el pin 3. Con esos valores va de unos 7 Hz a varios cientos de Hz.

**Paso a paso con antirrebote (74LS00, latch SR):**
- Pulsador SPDT: el común a GND.
- Contacto A del pulsador al pin 1 y contacto B al pin 4. Cada uno con una resistencia de 10 kΩ a +5 V.
- Pin 3 al pin 5, y pin 6 al pin 2.
- La salida STEP es el pin 3.

**Reset:** pulsador de dos patas entre GND y la línea /RESET, con 10 kΩ a +5 V.

**Selector de modo:** con el interruptor AUTO y compuertas: `CLKsrc = (AUTO · CLK555) + (/AUTO · STEP)`.

**Prueba:**
- Un LED en la salida del 555 parpadea y se ajusta con el potenciómetro.
- En modo manual, cada pulsación da **un solo** flanco en el LED, sin rebotes.

---

## Paso 3. Contador de programa (PC)

**Material:** 74LS161, 3 LEDs con resistencias.

| Pin del 74LS161 | Conexión |
|---|---|
| 16 / 8 | +5 V / GND |
| 1 (/CLR) | /RESET_TOTAL (más adelante). Ahora: /RESET |
| 2 (CLK) | SYSCLK |
| 3, 4, 5 (A, B, C) | IR[0], IR[1], IR[2] (dirección de salto) |
| 6 (D) | GND |
| 7, 10 (ENP, ENT) | PC_INC |
| 9 (/LOAD) | /PC_LOAD |
| 14, 13, 12 (QA, QB, QC) | PC[0], PC[1], PC[2] y a los LEDs |
| 11, 15 | sin conectar |

Para probar solo el PC, pon ENP/ENT a +5 V con un interruptor, /LOAD a +5 V, y los pines A, B y C a 3 interruptores.

**Prueba:**
1. /RESET: los LEDs muestran 000.
2. 8 pulsos: 001, 010 … 111, 000.
3. ENP/ENT a 0: el valor se mantiene.
4. A, B, C = 101, /LOAD a 0 y un pulso: salta a 101.

---

## Paso 4. Bus y registros

**Material:** 7× 74LS377, 3× 74LS245, 8 interruptores DIP, LEDs.

**Cómo conectar un 74LS377:**

| Pin | Conexión |
|---|---|
| 20 / 10 | +5 V / GND |
| 11 (CLK) | SYSCLK |
| 1 (/E) | señal de carga del registro (activa en bajo) |
| 3, 4, 7, 8, 13, 14, 17, 18 (D1 a D8) | BUS0 a BUS7 |
| 2, 5, 6, 9, 12, 15, 16, 19 (Q1 a Q8) | salida del registro |

**Registros a construir ahora:** A, B, IR, OUT, MDR (los 8 bits de cada uno). Con LEDs en las salidas de A, IR y OUT, y en el bus. Para ver B y MDR, mueve temporalmente los LEDs de A.

**Interruptores al bus (74LS245):**
- DIR (pin 1) a +5 V. Lado A (pines 2 a 9) a los 8 interruptores DIP, cada uno con 10 kΩ a GND.
- Lado B (pines 18 a 11) al bus: pin 18 = BUS0, pin 11 = BUS7.
- /OE (pin 19) a GND por ahora. Después será `/PROG`.

**A al bus (74LS245):**
- DIR a +5 V. Lado A (pines 2 a 9) a las salidas Q de A. Lado B al bus.
- /OE (pin 19) = /A_OUT.

**Prueba:**
1. Pon un valor en los interruptores. Verás ese valor en los LEDs del bus.
2. Con /E de A a 0, un pulso de reloj: A guarda el valor. Cambia los interruptores y A no cambia.
3. Repite con B, IR, OUT y MDR (los dos primeros se observan moviendo los LEDs de A).
4. Con /A_OUT a 0 y el 245 de los interruptores apagado, el bus muestra A.
5. **Nunca habilites dos 245 a la vez.** Si lo haces, quita la alimentación de inmediato.

---

## Paso 5. Memoria 8 × 8 y modo de programación

**Material:** 8× 74LS374, 2× 74LS138, 2× 74LS157, 3 DIP de dirección, 1 pulsador SPDT, 1 registro 74LS377 (MAR).

**Cada celda (74LS374):**

| Pin | Conexión |
|---|---|
| 20 / 10 | +5 V / GND |
| 1 (/OC) | salida Yi del decodificador de lectura |
| 11 (CLK) | salida Yi del decodificador de escritura |
| 3, 4, 7, 8, 13, 14, 17, 18 (D) | BUS0 a BUS7 |
| 2, 5, 6, 9, 12, 15, 16, 19 (Q) | BUS0 a BUS7 (en los mismos hilos que las D) |

**Decodificadores 74LS138** (una para lectura y otra para escritura):

| Pin | Lectura | Escritura |
|---|---|---|
| 1, 2, 3 (A, B, C) | dirección final [0, 1, 2] | dirección final [0, 1, 2] |
| 6 (G1) | MEM_RD | WE_PULSE |
| 4, 5 (/G2A, /G2B) | GND | GND |
| Y0 a Y7 (pines 15, 14, 13, 12, 11, 10, 9, 7) | a /OC de las celdas 0 a 7 | a CLK de las celdas 0 a 7 |

**MAR:** 74LS377. D1 a D3 vienen del selector de dirección (ver abajo). /E = /MAR_LD.

**Selector 74LS157 #1 (PC o IR):**
- S (pin 1) = ADDR_SEL (0 = PC, 1 = IR). /G (pin 15) a GND.
- 1A, 2A, 3A (pines 2, 5, 11) = PC[0], PC[1], PC[2].
- 1B, 2B, 3B (pines 3, 6, 10) = IR[0], IR[1], IR[2].
- Salidas 1Y, 2Y, 3Y (pines 4, 7, 9) a D1, D2, D3 del MAR.

**Selector 74LS157 #2 (normal o programación):**
- S = PROG. /G a GND.
- 1A, 2A, 3A = MAR Q1, Q2, Q3.
- 1B, 2B, 3B = DIP de dirección.
- Salidas = dirección final a los dos 74LS138.

**Escritura manual (modo PROG):**
- `WE_PULSE = (PROG · BTN_WRITE) + (MEM_WE · /SYSCLK)` (en modo PROG la fase queda en T0, así que MEM_WE vale 0)
- BTN_WRITE sale de un latch SR de 74LS00 con el pulsador SPDT, igual que el paso a paso.
- Con PROG = 1: el 245 de los interruptores se habilita (/OE = /PROG) y la memoria escribe cuando pulsas.
- `/RESET_TOTAL = /RESET · /PROG`. Así, en modo PROG el sistema queda en reset (PC a 0, fase T0, HLT apagado).

**Prueba:**
1. Con PROG = 1: elige dirección 0 y dato 0x01, pulsa escribir. Repite dirección 1 con 0x02, dirección 2 con 0x04 … dirección 7 con 0x80.
2. Para leer: apaga los interruptores de dato (245 desactivado) y activa MEM_RD con un interruptor temporal. Los LEDs del bus deben mostrar el dato de cada dirección.
3. Si al escribir una dirección cambia otra, hay cableado cruzado en los decodificadores.

---

## Paso 6. ALU y banderas

**Material:** 2× 74LS283, 5× 74LS86, 3× 74LS08, 2× 74LS32, 2× 74LS04, 8× 74LS151, 1× 74LS30, 1× 74LS245, 1× 74LS377 (banderas).

**Entradas:** A[7:0] y B[7:0] desde los registros.

**Resta con complemento a dos:**
- `SUB = IR4 · /IR5 · /IR6` (usa 74LS04 y 74LS08).
- `Bx[i] = B[i] ⊕ SUB`, con 2× 74LS86 (8 XOR).
- 74LS283 #1: A[3:0] y Bx[3:0], C0 (pin 7) = SUB.
- 74LS283 #2: A[7:4] y Bx[7:4], C0 = C4 (pin 9) del #1.
- Salida suma S[7:0].

**Otras operaciones (con B sin invertir):**
- AND[i] = A[i] · B[i] (74LS08).
- OR[i] = A[i] + B[i] (74LS32).
- XOR[i] = A[i] ⊕ B[i] (2× 74LS86).
- NOT[i] = /A[i] (74LS04).
- SHL[i] = A[i-1], y SHL[0] = GND.
- SHR[i] = A[i+1], y SHR[7] = GND.

**Selector de operación (un 74LS151 por bit i):**

| Entrada | Operación | Fuente |
|---|---|---|
| D0 | ADD | S[i] |
| D1 | SUB | S[i] |
| D2 | AND | AND[i] |
| D3 | OR | OR[i] |
| D4 | XOR | XOR[i] |
| D5 | NOT | NOT[i] |
| D6 | SHL | SHL[i] |
| D7 | SHR | SHR[i] |

- Pines de selección: C (pin 9) = IR6, B (pin 10) = IR5, A (pin 11) = IR4.
- /E (pin 7) a GND.
- Y (pin 5) = RES[i], al 74LS245 de la ALU. W (pin 6) = /RES[i].
- Pines del 151: D0=4, D1=3, D2=2, D3=1, D4=15, D5=14, D6=13, D7=12.

**74LS245 de la ALU:** lado A = RES[7:0], DIR a +5 V, lado B al bus, /OE = /ALU_OUT.

**Banderas (74LS377, cargan con /FLAG_LD):**
- Z: las 8 salidas W (/RES) van al 74LS30. Z = inversor de la salida del 74LS30.
- C: C4 del 74LS283 #2. Para SUB, C=1 significa que no hubo préstamo.
- N: RES[7].
- V: `V = /(A7 ⊕ Bx7) · (A7 ⊕ S7)` (2 XOR, 1 inversor, 1 AND).
- Z y N valen para todas las operaciones. C y V solo son válidas tras ADD o SUB.

**Prueba (con los valores del PDF):**

| A | B | Operación | Resultado |
|---|---|---|---|
| 00000101 | 00000011 | ADD | 00001000, Z=0 |
| 00000101 | 00000011 | SUB | 00000010 |
| 00000011 | 00000101 | SUB | 11111110, N=1 |
| 00000101 | 00000101 | SUB | 00000000, Z=1 |
| 01111111 | 00000001 | ADD | 10000000, V=1, N=1 |
| 00001111 | 00000101 | AND | 00000101 |
| 00001111 | 00000101 | OR | 00001111 |
| 00001111 | 00000101 | XOR | 00001010 |
| 00001111 | cualquiera | NOT | 11110000 |
| 00001111 | cualquiera | SHL | 00011110 |
| 00001111 | cualquiera | SHR | 00000111 |

Para elegir la operación, pon IR4, IR5 e IR6 con tres interruptores.

---

## Paso 7. Unidad de control

**Material:** 74LS161, 3× 74LS138 en total (1 ya usado en memoria), 74LS74, compuertas.

**Fases:**
- 74LS161: ENP, ENT y /LOAD a +5 V. /CLR = /RESET_TOTAL. CLK = SYSCLK. QA y QB son los bits de fase. QC y QD no se usan, así que el contador da T0 a T3 y se repite.
- 74LS138 de fases: A = QA, B = QB, C = GND, /G2A y /G2B a GND, G1 a +5 V. Y0 a Y3 son /T0 a /T3.

**Decodificador de instrucción:** 74LS138 con G1 = IR7, A = IR4, B = IR5, C = IR6, /G2A y /G2B a GND.

| Salida | Instrucción |
|---|---|
| Y0 | /LDA |
| Y1 | /LDB |
| Y2 | /STA |
| Y3 | /JMP |
| Y4 | /JZ |
| Y5 | /OUT |
| Y6 | /HLT |
| Y7 | sin uso |

Instrucción de ALU: `ALU = /IR7`.

**Ecuaciones de las señales** (con Tn = fase activa, Z = bandera cero):

| Señal | Ecuación |
|---|---|
| MAR_LD | T0 + T2 |
| ADDR_SEL | T2 |
| MEM_RD | T1 + T3 · (LDA + LDB) |
| IR_LD | T1 |
| PC_INC | T1 |
| A_LD | T3 · (LDA + ALU) |
| B_LD | T3 · LDB |
| A_OUT | T3 · (STA + OUT) |
| ALU_OUT | T3 · ALU |
| MEM_WE | T3 · STA |
| OUT_LD | T3 · OUT |
| FLAG_LD | T3 · ALU |
| PC_LOAD | T3 · (JMP + JZ · Z) |
| HLT_SET | T3 · HLT |
| MDR_LD | MEM_RD + MEM_WE |

Las señales de carga y de buffer son activas en bajo (/MAR_LD, /IR_LD, /A_LD, /B_LD, /OUT_LD, /MDR_LD, /FLAG_LD, /A_OUT, /ALU_OUT, /PC_LOAD). Usa NAND en lugar de AND para obtenerlas ya invertidas.

**Detener (HLT):** un flip-flop 74LS74 con D = Q + HLT_SET, reloj = /CLKsrc y /CLR = /RESET_TOTAL. Entonces `SYSCLK = CLKsrc · /HLT`. Así HLT cambia solo cuando el reloj está en bajo y no genera pulsos falsos.

**MDR:** en este diseño MDR solo captura el bus en cada acceso a memoria (no lleva LEDs fijos: se observa moviendo los de A). Sirve para cumplir el PDF y para depurar.

**Prueba (aún sin conectar las señales a los registros):**
1. Conecta LEDs a cada señal de control.
2. Pon una instrucción en el IR con los interruptores.
3. En paso a paso, comprueba que las señales de la tabla se encienden en la fase indicada.
4. Solo cuando todas coinciden, conecta las señales a los pines /E, /OE y demás.

Cuando llegues a este paso, avísame y te preparo el mapa de pines compuerta por compuerta de la unidad de control.

---

## Paso 8. Programas de prueba

Se cargan en modo PROG (dirección, dato, escribir).

**Programa 1: suma 5 + 3, resultado esperado 00001000**

| Dir | Contenido | Instrucción |
|---|---|---|
| 0 | 0x86 | LDA 6 |
| 1 | 0x97 | LDB 7 |
| 2 | 0x00 | ADD |
| 3 | 0xD0 | OUT |
| 4 | 0xE0 | HLT |
| 5 | 0x00 | sin uso |
| 6 | 0x05 | dato 5 |
| 7 | 0x03 | dato 3 |

**Programa 2: lógicas con A = 00001111 y B = 00000101**

| Dir | Contenido | Instrucción |
|---|---|---|
| 0 | 0x87 | LDA 7 |
| 1 | 0x96 | LDB 6 |
| 2 | 0x20 | AND |
| 3 | 0xD0 | OUT |
| 4 | 0xE0 | HLT |
| 5 | 0x00 | sin uso |
| 6 | 0x05 | dato B |
| 7 | 0x0F | dato A |

Ejecuta tres veces, cambiando solo la dirección 2:
- 0x20 (AND): salida 00000101.
- 0x30 (OR): salida 00001111.
- 0x40 (XOR): salida 00001010.

**Programa 3: salto condicional con JZ**

| Dir | Contenido | Instrucción |
|---|---|---|
| 0 | 0x85 | LDA 5 (carga 0xE0) |
| 1 | 0x95 | LDB 5 (carga 0xE0) |
| 2 | 0xD0 | OUT (muestra 11100000) |
| 3 | 0x10 | SUB (A−B = 0, Z=1) |
| 4 | 0xC6 | JZ 6 |
| 5 | 0xE0 | HLT (también es el dato) |
| 6 | 0xD0 | OUT (muestra 00000000) |
| 7 | 0xE0 | HLT |

- Si JZ salta: OUT pasa de 11100000 a 00000000 y el sistema se detiene en la dirección 7.
- Si JZ no salta: se detiene en la dirección 5 con OUT = 11100000.

**Programa 4 (ampliación):** lo diseñamos cuando funcionen los tres primeros. Por ejemplo, un contador o una resta repetida.

---

## Documentación que debes ir juntando

Para el requisito 14 y los entregables del PDF, toma nota en cada paso de:
- Fotos del montaje y de cada prueba.
- Errores que encontraste y cómo los resolviste.
- Tablas de verdad (decodificadores, selector de ALU, señales de control).
- Diagrama de estados del ciclo T0 a T3.
