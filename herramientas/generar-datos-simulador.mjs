// Copia la netlist verificada en Logisim y los programas de prueba al simulador de protoboard.
// El simulador se abre con file://, así que los datos van en un .js y no en un .json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const netlist=JSON.parse(fs.readFileSync(path.join(root,'fisico/netlist.json'),'utf8'));
const programas=JSON.parse(fs.readFileSync(path.join(root,'fisico/pruebas/programas.json'),'utf8'));
const datos={modulos:netlist.modulos.map(m=>({modulo:m.modulo,chips:m.chips.map(c=>({label:c.label,type:c.type,nets:c.nets}))}))};
const salida=path.join(root,'simulador/js/nucleo/datos.js');
fs.mkdirSync(path.dirname(salida),{recursive:true});
fs.writeFileSync(salida,`// Archivo generado por herramientas/generar-datos-simulador.mjs. No editar a mano.
// Origen: fisico/netlist.json (la misma netlist que pasa las pruebas de Logisim) y fisico/pruebas/programas.json.
(function(G){const S=G.SIM8=G.SIM8||{};
S.NETLIST=${JSON.stringify(datos)};
S.PROGRAMAS=${JSON.stringify(programas)};
})(globalThis);
`);
console.log('Escrito',path.relative(root,salida));
