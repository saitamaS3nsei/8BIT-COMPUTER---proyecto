// Only Logisim propagates the hardware. This script compares its recorded outputs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),process.argv[2]??'../compuertas');
const jar=path.resolve(base,'../../logisim-evolution-5.0.0-all.jar');
const circ=path.join(base,'pruebas/bancos.circ');
const evidence=path.join(base,'evidencias');fs.mkdirSync(evidence,{recursive:true});
const programs=JSON.parse(fs.readFileSync(path.join(base,'pruebas/programas.json'),'utf8'));
const results=[];
function run(name){const output=execFileSync('java',['-Djava.awt.headless=true','-jar',jar,'--tty','table','--toplevel-circuit',name,circ],{encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024});fs.writeFileSync(path.join(evidence,`${name}.txt`),output);return output.trim().split(/\r?\n/).map(s=>s.split('\t').map(v=>{const b=v.replaceAll(' ','');return /^[01]+$/.test(b)?parseInt(b,2):NaN;}));}
function report(name,pass,detail){results.push({name,pass,...detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail)}`);}
for(const[name,,out,flags,pc,m7,fault=0]of programs){const rows=run(`TEST_${name}`),last=rows.at(-1),pass=[1,out,flags,pc,fault,m7].every((v,i)=>v===last[i])&&rows.filter(r=>r[6]>=2).every(r=>r.every(Number.isFinite));report(name,pass,{out:last[1],flags:last[2],pc:last[3],fault:last[4],m7:last[5],cycles:last[6]});}
const cell=run('TEST_CELDA');report('CELDA_D',cell.length>=24&&cell.every(r=>r[5]===r[6]&&r.every(Number.isFinite)),{samples:cell.length});
const alu=run('TEST_ALU_1800').filter(r=>r[0]<1800);report('ALU_1800',new Set(alu.map(r=>r[0])).size===1800&&alu.every(r=>r[4]===r[6]&&r[5]===r[7]&&r.every(Number.isFinite)),{vectors:1800});
const control=run('TEST_CONTROL_512').filter(r=>r[0]<512);report('CONTROL_512',new Set(control.map(r=>r[0])).size===512&&control.every(r=>r[1]===r[2]&&r.every(Number.isFinite)),{combinations:512});
const memory=run('TEST_MEMORIA').filter(r=>r[0]>=2);report('MEMORIA',memory.at(-1)[0]===32&&memory.every(r=>r[5]===r[6]&&r.every(Number.isFinite)),{positions:8,cycles:32});
const resetRows=run('TEST_RESET_HALT'),byCycle=new Map(resetRows.map(r=>[r[0],r]));let resetPass=true;
for(const i of [32,33,34,35,36,37,69,70,71,72,73,74,75,76,77,78]){const r=byCycle.get(i);resetPass&&=!!r&&r[2]===1&&r[3]===8&&r[4]===5&&r[5]===8&&r[6]===3&&r[7]===0xc0&&r[10]===0&&r[11]===0&&r[12]===3&&r[13]===0;}
const rr=byCycle.get(38);resetPass&&=!!rr&&rr[1]===1&&rr.slice(2,12).every(v=>v===0)&&rr[12]===3&&rr[13]===0;report('RESET_HALT',resetPass,{cycles:78});
if(process.argv[3]==='computadora_8_bits_cableada.circ'){const expected=[0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f,0x77,0x7c,0x39,0x5e,0x79,0x71];const hx=run('TEST_HEX16').filter(r=>r[0]<16);report('DISPLAY_HEX16',new Set(hx.map(r=>r[0])).size===16&&hx.every(r=>r[2]===expected[r[1]]),{digits:16});}
const productionPath=path.join(base,process.argv[3]??'computadora_8_bits_compuertas.circ');const production=fs.readFileSync(productionPath,'utf8');const blocks=[...production.matchAll(/<comp lib="(\d+)".*?name="([^"]+)"/g)];const allowed={0:['Pin','Tunnel','Splitter','Constant','Clock'],1:['AND Gate','OR Gate','NOT Gate','XOR Gate','XNOR Gate','NOR Gate','NAND Gate'],5:['7-Segment Display'],6:['Text']};const forbidden=blocks.filter(m=>!allowed[m[1]]?.includes(m[2]));report('SOLO_COMPUERTAS',forbidden.length===0,{forbidden:forbidden.map(m=>m[2]),gateDefinitions:blocks.filter(m=>m[1]==='1').length});
const sha256=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.writeFileSync(path.join(evidence,'resultados.json'),JSON.stringify({simulator:'logisim-evolution-5.0.0-all.jar',sha256:{jar:sha256(jar),production:sha256(productionPath),testBench:sha256(circ)},results},null,2));
const table=['# Validación de la computadora de compuertas','','Motor de simulación: el JAR Logisim Evolution 5.0.0 proporcionado.','','| Prueba | Estado | Detalle |','|---|---|---|',...results.map(r=>`| ${r.name} | ${r.pass?'PASS':'FAIL'} | ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='name'&&k!=='pass')))} |`),'','Las trazas TEST_*.txt son salidas literales de Logisim. Los valores están en binario; el pin halt no se imprime. La memoria de compuertas necesita inicialización: los valores anteriores a los dos ciclos LOAD se excluyen de las comparaciones.',''];fs.writeFileSync(path.join(evidence,'RESULTADOS.md'),table.join('\n'));if(results.some(r=>!r.pass))process.exitCode=1;
