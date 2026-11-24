# Validación de la simulación física (chips 74LS)

Motor de simulación: Logisim Evolution 5.0.0 (JAR proporcionado). Los valores son los de la última fila de cada traza `TEST_*.txt`.

| Prueba | Descripción | Estado | OUT | PC | A | B | FLAGS (V N C Z) | Detalle |
|---|---|---|---|---|---|---|---|---|
| P1_SUMA | Programa 1: 5 + 3 | PASS | 08 | 5 | 08 | 03 | 0000 | - |
| P2_AND | Programa 2: 0F AND 05 | PASS | 05 | 5 | 05 | 05 | 0000 | - |
| P2_OR | Programa 2: 0F OR 05 | PASS | 0F | 5 | 0F | 05 | 0000 | - |
| P2_XOR | Programa 2: 0F XOR 05 | PASS | 0A | 5 | 0A | 05 | 0000 | - |
| P3_JZ_SALTA | Programa 3: JZ salta (resultado cero) | PASS | 00 | 0 | 00 | E0 | 0011 | - |
| P3_JZ_NO_SALTA | Programa 3: JZ no salta (resultado distinto de cero) | PASS | E0 | 6 | 10 | D0 | 0010 | - |
| STA_LDA | STA y LDA: guardar en memoria y recuperar | PASS | 54 | 6 | 54 | 2A | 0000 | - |
| JMP | JMP: salto incondicional | PASS | 2A | 6 | 2A | 00 | 0000 | - |
| NOT_SHL_SHR | NOT, SHL y SHR | PASS | 70 | 6 | 70 | 00 | 0000 | - |
| OVERFLOW | Overflow con signo: 7F + 01 | PASS | 80 | 5 | 80 | 01 | 1100 | - |
| RESTA_NEG | Resta negativa: 3 - 5 | PASS | FE | 5 | FE | 05 | 0100 | - |
| ACARREO_CERO | Acarreo y cero: FF + 01 | PASS | 00 | 5 | 00 | 01 | 0011 | - |

Resultado: 12 de 12 pruebas pasan.
