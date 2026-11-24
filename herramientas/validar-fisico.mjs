// Solo Logisim simula. Este script ejecuta cada banco de prueba y compara la última fila de la traza.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../fisico');
const jar=process.env.LOGISIM_JAR??path.resolve(base,'../logisim-evolution-5.0.0-all.jar');
if(!fs.existsSync(jar)){console.error(`No se encuentra el JAR de Logisim: ${jar}\nIndícalo con LOGISIM_JAR=/ruta/logisim-evolution-5.0.0-all.jar`);process.exit(2);}
const circ=path.join(base,'pruebas/bancos.circ');
const evidence=path.join(base,'evidencias');fs.mkdirSync(evidence,{recursive:true});
const programs=JSON.parse(fs.readFileSync(path.join(base,'pruebas/programas.json'),'utf8'));
const COLS=['OUT','PC','A','B','IR','FLAGS','HALTED','PHASE','CYCLES'];
const results=[];
const hex=(v,w=2)=>v===null||Number.isNaN(v)?'--':v.toString(16).toUpperCase().padStart(w,'0');
for(const [name,p] of Object.entries(programs)){
 const out=execFileSync('java',['-Djava.awt.headless=true','-jar',jar,'--tty','table','--toplevel-circuit',`TEST_${name}`,circ],{encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});
 fs.writeFileSync(path.join(evidence,`TEST_${name}.txt`),out);
 const rows=out.trim().split(/\r?\n/).map(l=>l.split('\t').map(v=>{const b=v.replaceAll(' ','');return /^[01]+$/.test(b)?parseInt(b,2):NaN;}));
 const fin=rows.filter(r=>r[8]<128).at(-1);// el contador de 8 bits llega a 128 y la ROM de estímulos vuelve a la dirección 0 (PROG=1)
 const last=Object.fromEntries(COLS.map((c,i)=>[c,fin[i]]));
 const bad=[];
 for(const [k,v] of Object.entries(p.expect))if(v!==null&&last[k]!==v)bad.push(`${k}: esperado ${hex(v)}, obtenido ${hex(last[k])}`);
 const unknown=rows.filter(r=>r.slice(0,9).some(Number.isNaN)).length;
 const pass=bad.length===0;
 results.push({name,title:p.title,pass,last,bad,unknownRows:unknown,rows:rows.length});
 console.log(`${pass?'PASS':'FAIL'} ${name} OUT=${hex(last.OUT)} PC=${last.PC} A=${hex(last.A)} B=${hex(last.B)} FLAGS=${last.FLAGS?.toString(2).padStart(4,'0')} HALTED=${last.HALTED}${bad.length?'  <- '+bad.join('; '):''}${unknown?`  (filas con X: ${unknown})`:''}`);
}
const table=['# Validación de la simulación física (chips 74LS)','','Motor de simulación: Logisim Evolution 5.0.0 (JAR proporcionado). Los valores son los de la última fila de cada traza `TEST_*.txt`.','','| Prueba | Descripción | Estado | OUT | PC | A | B | FLAGS (V N C Z) | Detalle |','|---|---|---|---|---|---|---|---|---|',
 ...results.map(r=>`| ${r.name} | ${r.title} | ${r.pass?'PASS':'FAIL'} | ${hex(r.last.OUT)} | ${r.last.PC} | ${hex(r.last.A)} | ${hex(r.last.B)} | ${r.last.FLAGS?.toString(2).padStart(4,'0')} | ${r.bad.join('; ')||'-'} |`),'',
 `Resultado: ${results.filter(r=>r.pass).length} de ${results.length} pruebas pasan.`,''];
fs.writeFileSync(path.join(evidence,'RESULTADOS.md'),table.join('\n'));
fs.writeFileSync(path.join(evidence,'resultados.json'),JSON.stringify(results,null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
