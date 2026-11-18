# Computadora de 8 bits: esquema cableado de referencia

Abrir **computadora_8_bits_cableada.circ** con el archivo `logisim-evolution-5.0.0-all.jar` del directorio `proyecto`. El circuito principal es **COMPUTADORA_8_BITS_CABLEADA**.

La disposición sigue la referencia visual suministrada: MAR y memoria a la izquierda, bus de ocho líneas en el centro, PC y registros A/B a la derecha, ALU entre los registros, control abajo y registro OUT conectado a dos displays de siete segmentos. Los **444 tramos de cable** del circuito principal son conexiones eléctricas funcionales. El ensamblaje principal no utiliza túneles ni oculta la computadora completa dentro de un único bloque.

Los subcircuitos conservan jerarquía para permitir inspeccionar la construcción interna con compuertas. Cada rectángulo visible corresponde a un módulo editable, no a un registro, RAM, ROM, multiplexor o contador integrado de Logisim. La ALU, la memoria, los registros, el PC, los selectores, la decodificación y el control se construyen con AND, OR, NOT, XOR, XNOR y NOR. Las celdas de almacenamiento utilizan latches NOR maestro/esclavo. Los subcircuitos internos emplean túneles etiquetados para organizar sus conexiones locales.

El reloj externo y los displays son elementos de entrada/salida del simulador. Los **decodificadores hexadecimales que alimentan los displays sí están construidos con compuertas**. Los divisores/agrupadores de bus solamente conectan bits.

## Probar manualmente 5 + 3

1. Desactivar `Simulate > Auto-Tick Enabled` si está marcado.
2. Elegir la herramienta de mano. Dejar `PROG=0`, `RESET=0` y **LOAD=1**.
3. Pulsar **Ctrl+F9 dos veces** para inicializar la memoria.
4. Hacer clic en LOAD para ponerlo en **0**.
5. Pulsar **Ctrl+F9** para avanzar un ciclo, o activar el reloj automático.

| Ciclos después de liberar LOAD | Resultado |
|---:|---|
| 6 | A = 05 |
| 12 | A = 05, B = 03 |
| 18 | A = 08 |
| 24 | OUT = 08; displays muestran 08 |
| 30 | HALTED = 1; PC = 5; resultado conservado |

Cada instrucción normal ocupa seis ciclos completos. Los valores de los indicadores están en hexadecimal. RESET en 1 y luego 0 reinicia la CPU conservando la memoria. Para recuperar los datos iniciales de un programa, aplicar nuevamente LOAD con dos ciclos.

Antes de inicializar pueden aparecer E o valores indefinidos en la memoria de latches. Los estados posteriores a la carga deben estar definidos; las pruebas verifican esta condición.

## Ajustes al PDF de la práctica

La imagen se usa como referencia de organización. Los tamaños y funciones se ajustan a `Práctica arq.pdf`:

| Requisito de la práctica | Realización |
|---|---|
| Palabra y bus de datos de 8 bits | Ocho conductores centrales, BUS[7:0]. |
| Direcciones de 3 bits, ocho posiciones | MAR y PC de 3 bits; memoria de 8 × 8. |
| Registros A, B, IR, OUT, MAR y MDR | Módulos individuales visibles, construidos con celdas D de compuertas. |
| PC con incremento, carga, RESET y retención | `PC_COMPUERTAS`: sumador de tres bits, selector y registro de tres bits. |
| Lectura, escritura y selección de memoria | Registros, decodificador AND/NOT y selectores AND/OR. |
| ALU con ADD, SUB, AND, OR, XOR, NOT, SHL y SHR | Sumadores completos en cascada, compuertas por bit y conexiones de desplazamiento. |
| Banderas Z, C, N y V | Registro de cuatro bits, visible al lado de la ALU. |
| Control secuencial y saltos | `SECUENCIADOR_CABLEADO` y `CONTROL_CABLEADO`, hechos con compuertas. |
| Fetch, Decode y Execute | Seis fases de reloj por instrucción. |
| Reloj, RESET y avance manual | Generador de reloj, entrada RESET y Ctrl+F9. |
| Salida visible | Registro OUT y dos displays hexadecimales. |
| Programas de prueba | 16 programas seleccionables, con pruebas de integración. |

El selector de bus admite una única fuente a la vez: MDR, ALU, A o cero. Así evita que dos dispositivos conduzcan simultáneamente el bus. El secuenciador entrega señales efectivas de habilitación condicionadas por RESET, LOAD y HALTED. Su salida CTRL_RAW muestra la palabra de decodificación para inspección.

## ISA y fases

Formato de instrucción: `opcode[7:4] | operando[3:0]`. Las direcciones válidas son 0–7.

| Opcode hex | Instrucción |
|---|---|
| 0 | LDA n |
| 1 | LDB n |
| 2 | STA n |
| 3 | ADD |
| 4 | SUB |
| 5 | AND |
| 6 | OR |
| 7 | XOR |
| 8 | NOT |
| 9 | JMP n |
| A | JZ n |
| B | OUT |
| C | HLT |
| D | SHL |
| E | SHR |
| F | Inválido: FAULT y HALT |

Las operaciones de ALU guardan el resultado en A y actualizan `FLAGS[3:0] = V N C Z`. La resta usa complemento a dos; C significa ausencia de préstamo. Las instrucciones restantes conservan las banderas. Los operandos sin dirección se ignoran; los programas utilizan cero. Las direcciones 8–15 en instrucciones de acceso o salto causan FAULT, incluso en un JZ cuya condición sería falsa.

| Fase | Transferencia |
|---|---|
| 0 | MAR ← PC |
| 1 | MDR ← MEM[MAR] |
| 2 | IR ← MDR; PC ← PC + 1 |
| 3 | Decodificar y preparar dirección/STA; detectar instrucciones inválidas |
| 4 | Leer el operando o escribir memoria |
| 5 | Ejecutar, guardar el resultado, saltar o detenerse |

## Programas iniciales

| PROG hex | Programa | Ocho palabras de memoria, hexadecimal | OUT |
|---|---|---|---|
| 0 | 5 + 3 | `06 17 30 B0 C0 00 05 03` | 08 |
| 1 | 0F AND 05 | `06 17 50 B0 C0 00 0F 05` | 05 |
| 2 | 0F OR 05 | `06 17 60 B0 C0 00 0F 05` | 0F |
| 3 | 0F XOR 05 | `06 17 70 B0 C0 00 0F 05` | 0A |
| 4 | JZ tomado | `70 A4 90 C0 B0 C0 00 00` | 00 |
| 5 | STA/LDA | `06 27 07 B0 C0 00 2A 00` | 2A |
| 6 | 3 − 5 | `06 17 40 B0 C0 00 03 05` | FE |
| 7 | Overflow | `06 17 30 B0 C0 00 7F 01` | 80 |
| 8 | Carry y cero | `06 17 30 B0 C0 00 FF 01` | 00 |
| 9 | SHL y SHR | `06 D0 E0 B0 C0 00 81 00` | 01 |
| A | NOT | `06 80 B0 C0 00 00 55 00` | AA |
| B | JMP | `94 F0 F0 F0 07 B0 C0 2A` | 2A |
| C | JZ no tomado | `06 80 A5 B0 C0 F0 00 00` | FF |
| D | Dirección inválida | `08 C0 00 00 00 00 00 00` | 00, FAULT=1 |
| E | Opcode inválido | `F0 00 00 00 00 00 00 00` | 00, FAULT=1 |
| F | Automodificación | `06 27 97 F0 F0 F0 C0 00` | 00; MEM[7]=C0 |

Los programas iniciales se producen mediante el decodificador y la matriz OR de `CARGADOR_CABLEADO`, dentro de la memoria. No hay una ROM integrada de programa. Para cambiar una palabra precargada desde Logisim se modifica esa matriz de compuertas. La CPU trabaja solamente sobre ocho bytes de memoria unificada.

## Validación con Logisim

Los resultados están en `evidencias/RESULTADOS.md`; las trazas literales se guardan como `TEST_*.txt`. `resultados.json` identifica por SHA-256 el JAR y los archivos probados.

`evidencias/esquema_suma.png` es la imagen exportada directamente desde Logisim durante la prueba de suma, con el resultado 08 en los displays.

Los bancos en `pruebas/bancos.circ` ejercitan **CPU_ESQUEMA**, que contiene el mismo ensamblaje físico del circuito principal, con el reloj suministrado por la prueba. Las pruebas de integración no utilizan la CPU anterior en su lugar. La instrumentación externa de los bancos puede usar contadores y ROM de estímulos; esos componentes no forman parte de la computadora entregada.

Cobertura: 16 programas completos, celda D, 1,800 vectores representativos de ALU, las 512 combinaciones de control, memoria, RESET/HLT y los 16 dígitos del decodificador de siete segmentos. Las pruebas de ALU no enumeran todos los pares posibles de operandos de ocho bits.

Desde el directorio `proyecto`:

```powershell
java -jar .\logisim-evolution-5.0.0-all.jar .\simulacion\esquema\computadora_8_bits_cableada.circ
```

Para repetir todas las pruebas utilizando el mismo JAR:

```powershell
node .\simulacion\herramientas\validar-compuertas.mjs ../esquema computadora_8_bits_cableada.circ
```

`generar-esquema.mjs` genera los archivos nativos y su cableado. La evolución eléctrica y secuencial se valida únicamente mediante Logisim. Regenerar sobrescribe los proyectos generados, por lo que deben preservarse aparte las modificaciones manuales.
