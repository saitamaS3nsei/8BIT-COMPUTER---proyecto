# Computadora de 8 bits construida con compuertas

Abrir **computadora_8_bits_compuertas.circ** con el archivo `logisim-evolution-5.0.0-all.jar` situado en el directorio del proyecto.

Esta es la versión que cumple la construcción con compuertas. Toda la lógica y el almacenamiento de la CPU se descomponen hasta compuertas de un bit: AND, OR, NOT, XOR, XNOR y NOR. No contiene componentes integrados de tipo Register, Counter, D Flip-Flop, RAM, ROM, Multiplexer, Decoder, Adder, Comparator ni Shifter de las bibliotecas de Logisim.

Se conservan únicamente elementos de conexión y manejo: cables, túneles, divisores/agrupadores de bus, niveles constantes, pines, textos y el generador de reloj del panel. Los divisores de bus solamente conectan bits: no calculan ni almacenan información. El generador de reloj proporciona los pulsos externos de la simulación; no se pretende simular un oscilador analógico con retardos físicos.

La jerarquía del archivo se expande en **4,346 compuertas de un bit**, con **119 celdas D** formadas por **238 latches**. Los módulos se reutilizan como subcircuitos editables. El archivo `auditoria_componentes.json` enumera los componentes y confirma que no hay bloques integrados prohibidos.

## Ejecutar la suma 5 + 3

1. Abrir el circuito `COMPUTADORA_COMPUERTAS`.
2. Desactivar `Simulate > Auto-Tick Enabled`, si estuviera activado.
3. Elegir la herramienta de mano. Dejar `RESET=0`, `PROG=0` y `LOAD=1`.
4. Pulsar **Ctrl+F9 dos veces**, con LOAD todavía en 1. Se inicializan la memoria y los registros.
5. Poner **LOAD=0**.
6. Avanzar con **Ctrl+F9**. Cada pulsación corresponde a un ciclo completo de reloj; cada instrucción usa seis ciclos.

| Ciclos después de LOAD=0 | Resultado observable |
|---:|---|
| 6 | A = 05 |
| 12 | A = 05, B = 03 |
| 18 | A = 08, B = 03 |
| 24 | OUT = 08 |
| 30 | HALTED = 1, PC = 5, OUT = 08 |

Los indicadores están en hexadecimal. Puede activarse el reloj automático después de liberar LOAD. HLT bloquea las habilitaciones de la CPU aunque continúen llegando pulsos.

Como el almacenamiento se construye con compuertas realimentadas, requiere inicialización. Antes de los ciclos de LOAD pueden aparecer valores indeterminados o E en memoria. Después de la inicialización, las pruebas comprueban que los estados son definidos. No deben interpretarse como datos válidos los valores previos a LOAD.

Para repetir el programa cargado, poner RESET en 1 y luego en 0. RESET borra los registros y banderas de la CPU, conservando los ocho bytes de memoria. Para recuperar un programa que haya modificado sus datos, volver a aplicar LOAD con dos ciclos.

## Ver las compuertas

En el panel izquierdo, abrir el módulo que se quiera inspeccionar:

| Módulo | Construcción |
|---|---|
| `LATCH_D_NOR` | Dos NOR realimentadas almacenan un bit. AND, OR y NOT generan SET y RESET a partir de D, EN y CLR. |
| `CELDA_D` | Dos latches maestro/esclavo, selector de habilitación y fases de reloj interbloqueadas. Captura en el flanco ascendente. |
| `REGISTRO_1`, `REGISTRO_3`, `REGISTRO_4`, `REGISTRO_8` | Agrupaciones de celdas D, con reloj, habilitación y borrado compartidos. |
| `DECODIFICADOR_1`, `DECODIFICADOR_3`, `DECODIFICADOR_4` | Inversores para los bits de selección y productos AND para cada salida. |
| `MUX_*` | Decodificación de la selección, habilitación de cada entrada con AND y reunión con OR. |
| `SUMADOR_COMPLETO` | Dos XOR, dos AND y una OR. |
| `SUMADOR_3` | Tres sumadores completos en cascada para incrementar PC y fase. |
| `ALU_8` | Ocho sumadores completos, compuertas por bit, selectores de compuertas y cableado de desplazamientos. |
| `CARGADOR_CABLEADO` | Decodificador de cuatro bits y matriz de OR que genera las ocho palabras del programa elegido. No contiene ROM integrada. |
| `MEMORIA_8x8` | Ocho registros de ocho bits: 64 celdas D. Decodificador de escritura y selector de lectura construidos con compuertas. |
| `CONTROL_CABLEADO` | Decodificación de fase y opcode; ecuaciones AND/OR/NOT para generar las 21 señales de control. |
| `CPU_8` | Interconexión de los módulos anteriores, bus, registros auxiliares y control de ejecución. |

Los túneles con el mismo nombre están conectados eléctricamente dentro del mismo subcircuito. Los rectángulos de la CPU son instancias de estos módulos, no componentes opacos incorporados de Logisim.

### Celda de almacenamiento

En cada latch:

```text
S  = D AND EN AND NOT CLR
R  = (NOT D AND EN) OR CLR
Q  = NOT (R OR QN)
QN = NOT (S OR Q)
```

CLR es dominante. El latch maestro y el esclavo usan fases que evitan su apertura simultánea:

```text
MASTER_EN = NOT (CLK OR SLAVE_EN)
SLAVE_EN  = NOT (NOT CLK OR MASTER_EN)
```

El dato de entrada de la celda es `EN ? D : Q`, implementado con compuertas. Así se conserva Q cuando no está habilitada. El montaje se valida con los retardos de propagación del simulador; una implementación física necesitaría verificar temporización, alimentación y componentes concretos.

## Arquitectura y programación

Se mantiene la arquitectura de acumulador y memoria unificada:

- Bus de datos y registros A, B, IR, MDR y OUT: 8 bits.
- PC, MAR y direcciones: 3 bits, ocho posiciones físicas.
- Memoria de instrucciones y datos: 8 × 8 bits.
- FLAGS de cuatro bits: `V N C Z`.
- Seis fases por instrucción: dirección, lectura, carga del IR, decodificación, acceso al operando y ejecución.

Cada instrucción usa el nibble alto como opcode y el bajo como operando. En instrucciones con dirección, solamente se admiten 0–7. Una dirección 8–15 o un opcode F causa FAULT y HALTED. El nibble inferior de las instrucciones sin dirección se ignora; se recomienda escribirlo como cero.

| Opcode | Instrucción | Efecto |
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
| A | JZ n | PC ← n si Z = 1 |
| B | OUT | OUT ← A |
| C | HLT | Detener la CPU |
| D | SHL | Desplazar A un bit a la izquierda |
| E | SHR | Desplazar A un bit a la derecha |
| F | Inválido | FAULT y detención |

La resta usa complemento a dos. C en resta significa ausencia de préstamo. Los desplazamientos guardan el bit expulsado en C. V solamente se activa por desbordamiento con signo en ADD o SUB. Las operaciones de ALU actualizan las banderas; las otras instrucciones las conservan.

### Programas del cargador cableado

| PROG hex | Prueba | Ocho palabras de memoria, hexadecimal | OUT esperado |
|---|---|---|---|
| 0 | Suma 5 + 3 | `06 17 30 B0 C0 00 05 03` | 08 |
| 1 | AND | `06 17 50 B0 C0 00 0F 05` | 05 |
| 2 | OR | `06 17 60 B0 C0 00 0F 05` | 0F |
| 3 | XOR | `06 17 70 B0 C0 00 0F 05` | 0A |
| 4 | JZ tomado | `70 A4 90 C0 B0 C0 00 00` | 00 |
| 5 | Guardar y recuperar | `06 27 07 B0 C0 00 2A 00` | 2A |
| 6 | Resta 3 − 5 | `06 17 40 B0 C0 00 03 05` | FE |
| 7 | Overflow | `06 17 30 B0 C0 00 7F 01` | 80 |
| 8 | Carry y cero | `06 17 30 B0 C0 00 FF 01` | 00 |
| 9 | SHL y SHR | `06 D0 E0 B0 C0 00 81 00` | 01 |
| A | NOT | `06 80 B0 C0 00 00 55 00` | AA |
| B | JMP | `94 F0 F0 F0 07 B0 C0 2A` | 2A |
| C | JZ no tomado | `06 80 A5 B0 C0 F0 00 00` | FF |
| D | Dirección inválida | `08 C0 00 00 00 00 00 00` | 00; FAULT=1 |
| E | Opcode inválido | `F0 00 00 00 00 00 00 00` | 00; FAULT=1 |
| F | Automodificación | `06 27 97 F0 F0 F0 C0 00` | 00; MEM[7]=C0 |

El cargador proporciona programas iniciales mediante lógica combinacional. La CPU solamente puede acceder a los ocho bytes de su memoria de trabajo. Para alterar un programa precargado desde la interfaz hay que modificar la matriz AND/OR de `CARGADOR_CABLEADO`; no existe un editor de ROM en esta versión.

## Pruebas y evidencias

`evidencias/RESULTADOS.md` muestra el resultado de cada prueba. `evidencias/resultados.json` incluye los hashes SHA-256 del JAR, el proyecto y los bancos utilizados. Los archivos TEST_*.txt son las trazas literales de Logisim.

Los bancos están en **pruebas/bancos.circ**. Incluyen una copia del hardware de compuertas y componentes integrados exclusivamente para generar estímulos, contar ciclos y comparar resultados. Esos elementos de instrumentación no forman parte del archivo principal de la computadora.

Cobertura:

- 16 programas completos de CPU, incluidos saltos tomados/no tomados, escritura, automodificación y errores.
- Captura, retención, flancos y borrado de la celda D: 24 muestras.
- ALU: 1,800 vectores de las ocho operaciones con valores representativos; no es una enumeración exhaustiva de todos los operandos de ocho bits.
- Control: las 512 combinaciones de fase, opcode, Z y bit de dirección inválida.
- Memoria: lectura y escritura de las ocho posiciones, inhibición de lectura, retención y recarga.
- RESET conservando memoria y estabilidad de la CPU después de HLT.
- Auditoría de componentes del archivo principal.

Desde el directorio `proyecto`, se puede repetir una prueba con el mismo JAR:

```powershell
java '-Djava.awt.headless=true' -jar .\logisim-evolution-5.0.0-all.jar --tty table --toplevel-circuit TEST_SUMA .\simulacion\compuertas\pruebas\bancos.circ
```

O repetir todas las verificaciones:

```powershell
node .\simulacion\herramientas\validar-compuertas.mjs
```

El script solamente invoca Logisim y comprueba sus salidas. Los cálculos y la evolución de los circuitos se simulan dentro del JAR. `generar-compuertas.mjs` y `circuitos-base.mjs` generan el XML nativo; regenerar sobrescribe los archivos de esta versión.
