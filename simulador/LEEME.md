# Simulador de protoboard (estilo CRUMB)

Banco de trabajo virtual para armar la computadora de 8 bits pieza por pieza, como en la protoboard real. Colocas los chips 74LS, LEDs, resistencias, interruptores y cables. Después enciendes la fuente y usas los interruptores y pulsadores. La guía de armado revisa cada conexión contra el diseño de `PLAN_CONSTRUCCION.md`.

## Abrir

Abre `simulador/index.html` con doble clic en Firefox, Brave o Chrome. No necesita internet ni instalar nada.

Tu armado se guarda solo en el navegador. Para tener una copia en archivo usa **Guardar**, y para recuperarla, **Abrir**.

Para ver la computadora ya armada, abre `simulador/computadora-armada.html`. Cada protoboard está rotulada con el módulo que lleva: su nombre lo dice, una franja de color encima marca qué columnas son de cada paso del plan, y los LEDs de cada registro están en una fila, del bit 7 (izquierda) al bit 0 (derecha), con su nombre debajo. En la guía, el «Mapa de las protoboards» las lista con sus chips. Trae las 12 protoboards con todas las piezas y cables, lista para cargar programas. Tiene su propio guardado, así que lo que cambies ahí no toca tu armado de `index.html`. Para volver a la computadora armada original, usa **Ver solución hasta el paso 8** en la guía.

## Qué puedes hacer

- **Colocar piezas** desde la paleta de la izquierda. Los chips se ponen cruzando el canal central y R los gira 180°. Los LEDs, las resistencias y los condensadores se colocan con dos clics, uno en cada pata (en el LED, primero el ánodo).
- **Tirar cables** con la herramienta Cable (W): un clic en cada extremo. Las teclas 1 a 8 cambian el color. Como en la protoboard real, cada agujero admite una sola pata o punta de cable.
- **Usar las piezas** con la herramienta Mover (V):
  - Clic en el botón de la fuente para encenderla. El voltaje se ajusta en el panel Pieza.
  - Clic en cada interruptor del DIP y en el interruptor deslizante para cambiarlos.
  - Mantén presionado el botón del ratón sobre un pulsador para pulsarlo.
  - Usa la rueda del ratón sobre la perilla del potenciómetro para girarlo.
- **Medir** con la Punta lógica (P): pasa el puntero por un agujero para ver si marca 5 V, 0 V, flotante o conflicto. Con un clic fijas la red, y todos sus agujeros y cables se resaltan.
- **Ver los pines** de una pieza con doble clic. El panel Pieza muestra, para cada pin, su nombre, a qué señal debe ir y su valor en vivo. También muestra el contenido de los registros y de las celdas de memoria.
- **Deshacer y rehacer** con Ctrl+Z y Ctrl+Y.

## Guía de armado

La pestaña **Guía de armado** sigue los 8 pasos del plan. En cada paso muestra:

- Las piezas que lleva. Con **Colocar**, la pieza se pone con su función asignada para que la guía la revise.
- Cuántos pines de cada chip están bien conectados.
- Las resistencias, condensadores y LEDs que faltan, con un botón para colocarlos.
- Las **conexiones que faltan**, también dibujadas en la protoboard como líneas naranjas punteadas. Un clic en la lista te lleva a esa conexión.
- Los **cortos** entre señales distintas y las entradas sin usar que conviene llevar a GND.
- La prueba del paso.
- **Ver solución hasta el paso N**, que arma todo automáticamente para comparar con lo tuyo. Reemplaza tu armado, pero Ctrl+Z lo recupera.

En el paso 8, **Cargar** escribe un programa en la memoria moviendo los interruptores DIP y el pulsador ESCRIBIR, igual que a mano. **Ejecutar** pone PROG en 0 y AUTO en 1. El panel muestra el estado de la CPU: PC, fase, IR, A, B, OUT, banderas y memoria.

Una pieza que colocas desde la paleta toma la siguiente función libre del paso que tengas abierto en la guía. Puedes cambiarla en el panel Pieza.

## Qué simula y qué no

| Simula | Cómo |
|---|---|
| Lógica de los 15 tipos de chip | Con los mismos números de pin del datasheet |
| Alimentación | Un chip sin VCC o GND no funciona. Con la alimentación invertida o más de 7 V se quema |
| Entradas flotantes | Se leen como 1, como en los 74LS, y aparecen como aviso |
| Cortos y buses | Dos salidas que fuerzan 0 y 1 en la misma red dan conflicto. Las salidas triestado (74LS245, 74LS374) se desconectan del bus |
| Resistencias | Hacen de pull-up o pull-down: llevan un valor débil a una red que nadie maneja |
| LEDs | Encienden con el ánodo en 1 y el cátodo en 0. Se avisa si van al revés o sin resistencia. Conectados directo a la fuente se queman |
| NE555 | Oscila con la frecuencia que dan sus resistencias, el potenciómetro y el condensador: f = 1.44 / ((R1 + 2·R2)·C). Si falta una pieza, no oscila y dice cuál falta |
| Rebotes | Los pulsadores rebotan unos milisegundos. Sin el latch de 74LS00, una pulsación da varios pulsos. A velocidad × 0.01 se ven |
| Consumo | Estimado con la corriente típica de cada chip y de los LEDs. Es una aproximación |

| No simula | Consecuencia |
|---|---|
| Retardos reales | Todos los chips tienen el mismo retardo (como Logisim). Un problema de tiempos que solo aparece con retardos reales de 74LS no se ve aquí |
| Ruido y caídas de voltaje | Los condensadores de desacople no cambian nada, pero la guía los cuenta porque en la protoboard real sí importan |
| Voltajes analógicos | Una red vale 0, 1, flotante o conflicto. No hay niveles intermedios |
| Estado al encender | Los registros y la memoria arrancan con valores al azar, como los chips reales. Por eso hay que programar la memoria después de encender |

## Diferencia con el plan

El interruptor PROG está en el paso 2 y no en el 5, porque la compuerta de reset del paso 2 (nRST_TOTAL) lo usa.

Antes del paso 7, HALT_D y MEM_RD quedan flotantes. La guía explica cómo unirlos a GND con cables temporales para probar los pasos intermedios, y los marca como error cuando armas el paso 7 si siguen puestos.

## Pruebas

```bash
node simulador/pruebas/prueba-nucleo.js         # motor, guía y los 12 programas, sin navegador
node simulador/pruebas/prueba-navegador.mjs     # la interfaz en Brave o Chrome sin ventana
```

**`prueba-nucleo.js`** comprueba:
- Que el armado automático de cada paso (1 a 8) queda completo según la guía.
- Que la computadora completa carga los 12 programas de `fisico/pruebas/programas.json` con los interruptores y llega al mismo resultado que Logisim, también en modo paso a paso con rebotes.
- Que la guía detecta un cable que falta y un corto, que un chip girado se quema y que sin antirrebote un pulsador da pulsos de más.

**`prueba-navegador.mjs`** hace clics como un usuario: enciende la fuente, tira cables, coloca y arrastra un chip, coloca un LED y una resistencia, usa el DIP, el potenciómetro y un pulsador, mide con la punta lógica, borra y recarga la página. Después carga la computadora completa y ejecuta el programa 1 desde la interfaz. Guarda capturas en `simulador/pruebas/capturas/`.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html`, `css/estilos.css` | Página e interfaz |
| `js/nucleo/` | Motor eléctrico y lógico, chips, piezas, diseño esperado, verificador, armado automático y programas. No usa el DOM |
| `js/ui/` | Dibujo en canvas, paneles y manejo del ratón y el teclado |
| `js/nucleo/datos.js` | Generado desde `fisico/netlist.json` y `fisico/pruebas/programas.json` |

Si cambias el diseño en Logisim, regenera los datos con estos comandos:

```bash
node herramientas/generar-fisico.mjs
node herramientas/generar-datos-simulador.mjs
```
