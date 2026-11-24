# Computadora didáctica de 8 bits

Proyecto de una computadora de 8 bits (arquitectura de acumulador, 8 posiciones de memoria, bus de datos de 8 bits) que se construye en protoboard con chips 74LS, siguiendo el PDF del profesor.

| Archivo o carpeta | Contenido |
|---|---|
| `PLAN_CONSTRUCCION.md` | Guía de armado paso a paso: chips, pines, conexiones y pruebas de cada módulo, y los tres programas del PDF en hexadecimal |
| `simulador/` | Simulador de protoboard estilo CRUMB: armas la computadora pieza por pieza y una guía revisa cada conexión. Abrir `simulador/index.html`; la computadora ya armada está en `simulador/computadora-armada.html`. Ver `simulador/LEEME.md` |
| `GUIA_PROTEUS.md` | Guía para dibujar el circuito en Proteus (Windows), con la tabla de pines de cada chip |
| `lista_materiales.html` | Lista de materiales y de compra (se guarda como PDF con Ctrl+P en el navegador) |
| `fisico/` | Simulación en Logisim Evolution de ese mismo diseño, chip por chip. Ver `fisico/LEEME.md` |
| `herramientas/` | Scripts que generan y validan la simulación |

## Simulación

Abrir el circuito principal `COMPUTADORA_FISICA`:

```bash
java -jar logisim-evolution-5.0.0-all.jar fisico/computadora_8_bits_fisica.circ
```

Ejecutar las 12 pruebas automáticas (programas del PDF, saltos, memoria y banderas):

```bash
node herramientas/validar-fisico.mjs
```

El validador busca el JAR en la raíz del proyecto. Se puede indicar otro con `LOGISIM_JAR=/ruta/al/jar`. Regenerar los `.circ` con `node herramientas/generar-fisico.mjs` sobrescribe los de `fisico/`.

## Instrucciones

Formato: `opcode[7:4] | operando[3:0]`. Direcciones válidas 0 a 7.

| Opcode | Instrucción | | Opcode | Instrucción |
|---|---|---|---|---|
| 0 | ADD | | 8 | LDA n |
| 1 | SUB | | 9 | LDB n |
| 2 | AND | | A | STA n |
| 3 | OR | | B | JMP n |
| 4 | XOR | | C | JZ n |
| 5 | NOT | | D | OUT |
| 6 | SHL | | E | HLT |
| 7 | SHR | | F | sin usar |

Ciclo de 4 fases: T0 (MAR ← PC), T1 (IR ← memoria, PC + 1), T2 (MAR ← operando), T3 (ejecución).
