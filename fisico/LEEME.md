# Simulación de la computadora física (chips 74LS)

Esta carpeta simula el diseño de `PLAN_CONSTRUCCION.md` chip por chip. Cada circuito integrado de la protoboard es un chip de la librería TTL de Logisim Evolution, con los mismos números de pin del datasheet. Las compuertas sueltas están agrupadas en chips 74LS00, 04, 08, 32 y 86, igual que en la protoboard.

Los otros circuitos del proyecto (`esquema/`, `compuertas/`) son una arquitectura distinta (ISA con opcodes 0 a F, 6 fases, ROM de control). Este es el que corresponde al plan de construcción.

## Archivos

| Archivo | Contenido |
|---|---|
| `computadora_8_bits_fisica.circ` | Circuito para abrir y usar a mano. Circuito principal: `COMPUTADORA_FISICA` |
| `pruebas/bancos.circ` | Los 12 bancos de prueba `TEST_*`, que programan la memoria y ejecutan solos |
| `pruebas/programas.json` | Programas de prueba en hexadecimal y resultados esperados |
| `evidencias/` | Trazas literales de Logisim y `RESULTADOS.md` |
| `chips.json` | Cantidad de chips por módulo, contada del circuito |
| `../herramientas/generar-fisico.mjs` | Genera los `.circ`. Ejecutarlo sobrescribe estos archivos |
| `../herramientas/validar-fisico.mjs` | Ejecuta las pruebas con el JAR de Logisim y compara resultados |

## Usar el circuito a mano

```bash
java -jar logisim-evolution-5.0.0-all.jar fisico/computadora_8_bits_fisica.circ
```

Con la herramienta de interacción (mano):

1. **Programar:** `PROG=1`. Pon un dato en `DIPD` y una dirección en `DIPA`. Pulsa `WRITE` (pon `WRITE=1` y luego `0`). La memoria guarda el dato al soltar. Repite para las 8 posiciones.
2. **Ejecutar:** `PROG=0` y `nRESET=1` (nRESET es el botón de reset activo en bajo; con 0 el sistema se queda en reset).
3. **Reloj automático:** `AUTO=1` y activa el reloj con `Simulate > Auto-Tick Enabled`.
4. **Paso a paso:** `AUTO=0` y alterna `STEP` (0 a 1 da un pulso de reloj). Cada instrucción son 4 pulsos (T0 a T3).
5. Los pines de salida son los LEDs: `OUT`, `A`, `B`, `IR`, `MDR`, `BUS`, `PC`, `MAR`, `FLAGS` (V N C Z), `PHASE` y `HALTED`.

`BUS` aparece como `UU` cuando ningún chip lo maneja. Es normal fuera de las fases con transferencia.

## Pruebas

```bash
LOGISIM_JAR=/ruta/logisim-evolution-5.0.0-all.jar node herramientas/validar-fisico.mjs
```

Resultado actual: **12 de 12 pruebas pasan** (ver `evidencias/RESULTADOS.md`).

| Prueba | Qué comprueba |
|---|---|
| `P1_SUMA` | Programa 1 del PDF: 5 + 3 = 08 |
| `P2_AND`, `P2_OR`, `P2_XOR` | Programa 2 del PDF con A=0F y B=05: 05, 0F y 0A |
| `P3_JZ_SALTA` | Programa 3 del PDF: resultado cero y salto con JZ |
| `P3_JZ_NO_SALTA` | JZ no salta si el resultado no es cero |
| `STA_LDA` | Escribir en memoria con STA y leerlo de vuelta |
| `JMP` | Salto incondicional |
| `NOT_SHL_SHR` | NOT, desplazamiento a la izquierda y a la derecha |
| `OVERFLOW`, `RESTA_NEG`, `ACARREO_CERO` | Banderas V, N, C y Z |

Cada banco usa el mismo procedimiento que el montaje real: con `PROG=1` escribe las 8 palabras por los interruptores y el pulsador de escritura, y luego ejecuta. Así también se prueba la ruta de programación manual.

Las trazas tienen las columnas `OUT, PC, A, B, IR, FLAGS, HALTED, PHASE, CYCLES, DBG`. El validador usa la última fila antes de que el contador de 8 bits llegue a 128 (ahí la ROM de estímulos vuelve a la dirección 0 y pone `PROG=1`).

## Qué descubrió la simulación

- **Error en el plan:** el plan usaba `IR0` a `IR2` como código de operación. El opcode está en `IR7` a `IR4`, y `IR2` a `IR0` es la dirección. Ya está corregido en `PLAN_CONSTRUCCION.md`.
- **Compuertas reales:** 5× 74LS00, 5× 74LS04, 6× 74LS08, 6× 74LS32 y 5× 74LS86. Total: **65 chips más el 555**. La lista de materiales ya usa estos números.
- **La escritura de memoria con reloj compuerteado funciona** en la simulación (prueba `STA_LDA`). En el montaje real, el dato del bus tiene que seguir estable unos nanosegundos después del flanco de reloj de la celda. Está en el límite de lo seguro. Si aparecen escrituras erráticas en la protoboard, sospecha primero de esta ruta.

## Diferencias entre la simulación y el hardware

| Elemento | En la simulación | En el prototipo |
|---|---|---|
| Reloj 555 | Componente `Clock` de Logisim | NE555 con potenciómetro |
| 74LS374 de la memoria | Un 74LS377 siempre habilitado y un 74LS541, porque la librería no trae el 74LS374 | 74LS374 |
| Alimentación | Los chips no tienen pines VCC y GND | Cableado y condensadores de 100 nF |
| Retardos | Todos los chips tienen retardo unitario | Retardos reales de 74LS |
| Rebotes de los pulsadores | Los pulsadores no rebotan | Latch SR con 74LS00 |
