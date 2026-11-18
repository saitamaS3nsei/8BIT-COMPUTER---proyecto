# Validación de la computadora de compuertas

Motor de simulación: el JAR Logisim Evolution 5.0.0 proporcionado.

| Prueba | Estado | Detalle |
|---|---|---|
| SUMA | PASS | {"out":8,"flags":0,"pc":5,"fault":0,"m7":3,"cycles":32} |
| AND | PASS | {"out":5,"flags":0,"pc":5,"fault":0,"m7":5,"cycles":32} |
| OR | PASS | {"out":15,"flags":0,"pc":5,"fault":0,"m7":5,"cycles":32} |
| XOR | PASS | {"out":10,"flags":0,"pc":5,"fault":0,"m7":5,"cycles":32} |
| JZ_TOMADO | PASS | {"out":0,"flags":1,"pc":6,"fault":0,"m7":0,"cycles":26} |
| STA_LDA | PASS | {"out":42,"flags":0,"pc":5,"fault":0,"m7":42,"cycles":32} |
| RESTA | PASS | {"out":254,"flags":4,"pc":5,"fault":0,"m7":5,"cycles":32} |
| OVERFLOW | PASS | {"out":128,"flags":12,"pc":5,"fault":0,"m7":1,"cycles":32} |
| CARRY | PASS | {"out":0,"flags":3,"pc":5,"fault":0,"m7":1,"cycles":32} |
| SHL_SHR | PASS | {"out":1,"flags":0,"pc":5,"fault":0,"m7":0,"cycles":32} |
| NOT | PASS | {"out":170,"flags":4,"pc":4,"fault":0,"m7":0,"cycles":26} |
| JMP | PASS | {"out":42,"flags":0,"pc":7,"fault":0,"m7":42,"cycles":26} |
| JZ_NO_TOMADO | PASS | {"out":255,"flags":4,"pc":5,"fault":0,"m7":0,"cycles":32} |
| DIRECCION_INVALIDA | PASS | {"out":0,"flags":0,"pc":1,"fault":1,"m7":0,"cycles":6} |
| OPCODE_INVALIDO | PASS | {"out":0,"flags":0,"pc":1,"fault":1,"m7":0,"cycles":6} |
| AUTOMODIFICACION | PASS | {"out":0,"flags":0,"pc":0,"fault":0,"m7":192,"cycles":26} |
| CELDA_D | PASS | {"samples":24} |
| ALU_1800 | PASS | {"vectors":1800} |
| CONTROL_512 | PASS | {"combinations":512} |
| MEMORIA | PASS | {"positions":8,"cycles":32} |
| RESET_HALT | PASS | {"cycles":78} |
| DISPLAY_HEX16 | PASS | {"digits":16} |
| SOLO_COMPUERTAS | PASS | {"forbidden":[],"gateDefinitions":808} |

Las trazas TEST_*.txt son salidas literales de Logisim. Los valores están en binario; el pin halt no se imprime. La memoria de compuertas necesita inicialización: los valores anteriores a los dos ciclos LOAD se excluyen de las comparaciones.
