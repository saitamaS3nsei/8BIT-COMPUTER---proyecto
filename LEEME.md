# Simulación de la computadora de 8 bits

**Esquema cableado basado en la imagen de referencia:** abrir [esquema/computadora_8_bits_cableada.circ](esquema/computadora_8_bits_cableada.circ). Muestra los módulos, el bus central de ocho líneas, las conexiones de control y dos displays. Toda la lógica y el almacenamiento se construyen con compuertas. Consultar [su guía de prueba](esquema/LEEME.md).

**Versión construida íntegramente con compuertas:** abrir [compuertas/computadora_8_bits_compuertas.circ](compuertas/computadora_8_bits_compuertas.circ) y consultar [su guía](compuertas/LEEME.md). Esa versión sustituye los bloques integrados de registros, memoria, selectores y control por compuertas. El resto de este documento describe la primera versión, conservada como referencia.

Proyecto: `computadora_8_bits.circ`. Herramienta de desarrollo y motor de simulación: el archivo `../logisim-evolution-5.0.0-all.jar` proporcionado. El archivo nativo se generó de forma automatizada con autorización del usuario. Los scripts auxiliares generan XML, preparan estímulos, invocan el JAR y recopilan resultados; no emulan la CPU.

Este directorio contiene exclusivamente el entregable de simulación y sus instrucciones de uso, programas y evidencias. No incluye el documento teórico ni el prototipo físico.

## Abrir y ejecutar

Desde `D:\codigos\7_semestre\arquitectura_computadoras\proyecto`:

```powershell
java -jar .\logisim-evolution-5.0.0-all.jar .\simulacion\computadora_8_bits.circ
```

1. Abrir el circuito principal `COMPUTADORA_8_BITS`.
2. Con el reloj automático desactivado, elegir `PROG` con la herramienta de interacción (mano). El selector admite valores hexadecimales `0` a `F`.
3. Poner `LOAD=1` y ejecutar un ciclo completo de reloj desde el menú `Simulate`. La memoria carga simultáneamente sus ocho palabras y la CPU se reinicia.
4. Poner `LOAD=0`.
5. Avanzar con `Simulate > Manual Tick Full Cycle`, o activar `Auto-Tick Enabled` para ejecución automática. Cada instrucción normal ocupa seis ciclos completos. Un tick de medio ciclo no equivale a una instrucción.
6. Observar `OUT`, registros, `PC`, `PHASE`, `FLAGS`, bus y control. `HALTED=1` indica detención. El programa de suma termina con `OUT=08`, `A=08`, `B=03`, `PC=5`, `FLAGS=0`.

`RESET=1` borra de forma asíncrona los registros de la CPU y sus banderas, pero conserva la memoria. Volver a `RESET=0` permite ejecutar desde la dirección cero. `LOAD` también reinicia la CPU, pero necesita un flanco ascendente para copiar el programa a memoria. Cambiar `PROG` por sí solo no modifica la memoria.

Los circuitos `TEST_*` generan su propia inicialización y pueden ejecutarse con el reloj automático. Sus contadores de prueba continúan aunque la CPU esté detenida. Las pruebas de programas muestran `PASS=1` al alcanzar el estado esperado; el límite de 100 ciclos detecta programas que no terminan. `TEST_RESET_HALT` conserva el reloj activo deliberadamente para comprobar la detención y el reinicio.

## Organización del circuito

| Módulo | Implementación |
|---|---|
| `SUMADOR_COMPLETO` | Sumador de un bit con compuertas XOR, AND y OR; sus ocho combinaciones están verificadas. |
| `ALU_8` | Ocho sumadores completos en cascada; resta por complemento a dos; AND, OR, XOR, NOT, SHL y SHR; banderas Z/C/N/V. |
| `MEMORIA_8x8` | Ocho registros de ocho bits, decodificador de dirección y multiplexor de lectura. Memoria unificada de instrucciones y datos. |
| `CONTROL` | ROM de microcontrol de 512 × 21 bits, dirigida por fase, opcode, Z y bit de dirección inválida. |
| `CPU_8` | Registros A, B, IR, MDR y OUT de ocho bits; MAR y PC de tres bits; registro de banderas y contador de fase. |
| `COMPUTADORA_8_BITS` | Reloj, RESET, carga de programa, selector e indicadores hexadecimales. |

El bus de datos tiene un único multiplexor conductor: MDR, resultado de ALU, A o cero. Los túneles con el mismo nombre son conexiones eléctricas reales dentro del mismo circuito. El direccionamiento no se amplía: los ocho bancos de ROM de carga contienen los programas de demostración, pero la memoria accesible por la CPU sigue siendo de **8 palabras de 8 bits**. La ROM de control tampoco forma parte del espacio de direcciones del programa.

La memoria usa habilitaciones equivalentes a un DEMUX: `WR AND decode(ADDR)`. La lectura es combinacional cuando `RD=1`; con `RD=0`, DOUT vale cero. Las escrituras y cargas son por flanco ascendente. LOAD tiene prioridad sobre una escritura normal. RESET no borra memoria.

## ISA

Cada instrucción es una palabra de ocho bits: `opcode[7:4] | operando[3:0]`.

| Opcode hex | Instrucción | Efecto |
|---|---|---|
| 0 | LDA n | A ← MEM[n] |
| 1 | LDB n | B ← MEM[n] |
| 2 | STA n | MEM[n] ← A |
| 3 | ADD | A ← A + B |
| 4 | SUB | A ← A − B |
| 5 | AND | A ← A AND B |
| 6 | OR | A ← A OR B |
| 7 | XOR | A ← A XOR B |
| 8 | NOT | A ← NOT A |
| 9 | JMP n | PC ← n |
| A | JZ n | PC ← n si Z=1 |
| B | OUT | OUT ← A |
| C | HLT | Mantener el estado de la CPU hasta RESET o LOAD |
| D | SHL | A ← desplazamiento lógico de A a la izquierda |
| E | SHR | A ← desplazamiento lógico de A a la derecha |
| F | No definido | FAULT=1 y HALTED=1 |

Las direcciones válidas son 0–7. En LDA, LDB, STA, JMP y JZ, un operando 8–15 causa FAULT y detención, incluso si la condición de JZ sería falsa. Para instrucciones sin dirección, el nibble inferior se ignora; los programas suministrados usan cero. El PC se incrementa módulo 8.

`FLAGS[3:0] = V N C Z`. Se actualizan únicamente en operaciones de ALU. Las cargas, escrituras, saltos y OUT conservan las banderas. Z indica resultado cero; N copia el bit 7; C es acarreo de suma, **ausencia de préstamo** en resta o el bit expulsado por desplazamiento; V es overflow con signo en suma/resta. Las operaciones lógicas y los desplazamientos ponen V=0; las lógicas ponen C=0. El resultado de ocho bits se conserva módulo 256.

## Fases de ejecución

| Fase | Acción |
|---|---|
| 0 | MAR ← PC |
| 1 | MDR ← MEM[MAR], lectura habilitada |
| 2 | IR ← MDR; PC ← PC + 1 |
| 3 | Decodificar; MAR ← operando para accesos; MDR ← A para STA; detener ante instrucción inválida |
| 4 | Leer el operando en MDR para LDA/LDB, o escribir MDR para STA |
| 5 | Ejecutar ALU, carga, salida, salto o HLT; volver a fase 0 |

La palabra CTRL tiene estos campos: bit 0 MAR_EN, 1 MAR_SEL, 2 MDR_EN, 3 MDR_SEL, 4 IR_EN, 5 PC_INC, 6 PC_LOAD, 7 A_EN, 8 B_EN, 9 OUT_EN, 10 MEM_WE, 11 FLAGS_EN, 12 HALT_SET, 13 FAULT_SET, 16:14 ALU_OP, 18:17 BUS_SEL, 19 READ y 20 END. Las habilitaciones de modificación están condicionadas por RUN = NOT(HALTED OR RESET OR LOAD). CTRL es la palabra bruta de la ROM; después de HLT puede mostrar señales de una fase, pero las habilitaciones efectivas están bloqueadas.

## Programas precargados

Cada fila contiene exactamente las ocho palabras de memoria, en hexadecimal.

| PROG | Prueba | Memoria 0 a 7 | OUT esperado |
|---|---|---|---|
| 0 | 5 + 3 | `06 17 30 B0 C0 00 05 03` | 08 |
| 1 | 0F AND 05 | `06 17 50 B0 C0 00 0F 05` | 05 |
| 2 | 0F OR 05 | `06 17 60 B0 C0 00 0F 05` | 0F |
| 3 | 0F XOR 05 | `06 17 70 B0 C0 00 0F 05` | 0A |
| 4 | JZ tomado después de XOR | `70 A4 90 C0 B0 C0 00 00` | 00 |
| 5 | Guardar y recuperar 2A | `06 27 07 B0 C0 00 2A 00` | 2A |
| 6 | 3 − 5 | `06 17 40 B0 C0 00 03 05` | FE |
| 7 | Overflow con signo | `06 17 30 B0 C0 00 7F 01` | 80 |
| 8 | Acarreo y cero | `06 17 30 B0 C0 00 FF 01` | 00 |
| 9 | SHL y SHR | `06 D0 E0 B0 C0 00 81 00` | 01 |
| A | NOT 55 | `06 80 B0 C0 00 00 55 00` | AA |
| B | JMP | `94 F0 F0 F0 07 B0 C0 2A` | 2A |
| C | JZ no tomado | `06 80 A5 B0 C0 F0 00 00` | FF |
| D | Dirección inválida | `08 C0 00 00 00 00 00 00` | 00, FAULT=1 |
| E | Opcode inválido | `F0 00 00 00 00 00 00 00` | 00, FAULT=1 |
| F | Automodificación y vuelta del PC a cero | `06 27 97 F0 F0 F0 C0 00` | 00; MEM[7]=C0 |

AND, OR y XOR se demuestran en ejecuciones separadas para respetar las ocho posiciones de memoria. El programa F escribe HLT en la dirección 7 y salta a ella, comprobando que datos e instrucciones comparten memoria.

Para añadir un programa desde Logisim, abrir `MEMORIA_8x8` y editar las ROM `PROGRAMA [0]` a `PROGRAMA [7]`: en la misma dirección de selector PROG de cada ROM, escribir la palabra correspondiente a esa posición de memoria. Después seleccionar ese PROG y aplicar LOAD con un ciclo de reloj. Guardar el `.circ` conserva la programación de las ROM. La RAM de trabajo es volátil.

## Evidencias y repetición de pruebas

`evidencias/RESULTADOS.md` contiene los resultados; `resultados.json` conserva los valores y `TEST_*.txt` contiene las trazas literales del JAR. Los bancos de prueba están incluidos en el propio `.circ`, de modo que pueden inspeccionarse y ejecutarse dentro de Logisim.

Ejemplo de prueba sin interfaz gráfica:

```powershell
java '-Djava.awt.headless=true' -jar .\logisim-evolution-5.0.0-all.jar --tty table --toplevel-circuit TEST_SUMA .\simulacion\computadora_8_bits.circ
```

En las trazas secuenciales, Logisim omite el pin de parada `halt`. En las pruebas de programas, las columnas son: PASS, OUT, FLAGS, PC, FAULT, M7, CYCLES, PHASE, IR, A, B, BUS, MDR, MAR, CTRL. Los valores aparecen en binario. PASS debe terminar en 1. Los ciclos incluyen el ciclo inicial de carga.

Para recopilar todas las pruebas automáticamente, conservando a Logisim como único motor:

```powershell
node .\simulacion\herramientas\validar.mjs
```

Cobertura: 16 programas, ocho combinaciones del sumador completo, 1,800 vectores de ALU, lectura/escritura de todas las posiciones, inhibición de lectura, retención de datos, recarga, estabilidad tras HLT y reinicio conservando memoria. Los 1,800 vectores cubren las ocho operaciones con 15 valores representativos por operando; no son una prueba exhaustiva de todas las entradas de ocho bits.

`herramientas/generar.mjs` reconstruye el proyecto nativo y los vectores. Ejecutarlo sobrescribe el `.circ`, por lo que debe usarse solamente si se desea regenerar el diseño y descartar modificaciones manuales de ese archivo. `Inspect.java` consulta las propiedades y puertos de los componentes en el mismo JAR; no realiza simulación.
