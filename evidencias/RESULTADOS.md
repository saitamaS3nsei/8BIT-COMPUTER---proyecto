# Resultados de la simulación

Motor: `logisim-evolution-5.0.0-all.jar`. Las pruebas se ejecutan con su interfaz `--tty table`.

| Prueba | Resultado | OUT decimal | FLAGS decimal | PC | Ciclos / vectores |
|---|---|---:|---:|---:|---:|
| SUMA | PASS | 8 | 0 | 5 | 31 |
| AND | PASS | 5 | 0 | 5 | 31 |
| OR | PASS | 15 | 0 | 5 | 31 |
| XOR | PASS | 10 | 0 | 5 | 31 |
| JZ_TOMADO | PASS | 0 | 1 | 6 | 25 |
| STA_LDA | PASS | 42 | 0 | 5 | 31 |
| RESTA | PASS | 254 | 4 | 5 | 31 |
| OVERFLOW | PASS | 128 | 12 | 5 | 31 |
| CARRY | PASS | 0 | 3 | 5 | 31 |
| SHL_SHR | PASS | 1 | 0 | 5 | 31 |
| NOT | PASS | 170 | 4 | 4 | 25 |
| JMP | PASS | 42 | 0 | 7 | 25 |
| JZ_NO_TOMADO | PASS | 255 | 4 | 5 | 31 |
| DIRECCION_INVALIDA | PASS | 0 | 0 | 1 | 5 |
| OPCODE_INVALIDO | PASS | 0 | 0 | 1 | 5 |
| AUTOMODIFICACION | PASS | 0 | 0 | 0 | 25 |
| SUMADOR_COMPLETO | PASS | - | - | - | 8 |
| ALU_1800 | PASS | - | - | - | 1800 |
| MEMORIA | PASS | - | - | - | 31 |
| RESET_HALT | PASS | - | - | - | 75 |

Los archivos TEST_*.txt contienen la salida literal de Logisim. En los bancos secuenciales, la salida halt no se imprime; las demás columnas siguen el orden vertical de los pines del circuito.
