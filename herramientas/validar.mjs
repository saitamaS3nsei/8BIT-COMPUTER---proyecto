// Orchestrates the requested JAR. All digital simulation runs inside Logisim.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jar=path.join(root,'..','logisim-evolution-5.0.0-all.jar');
const circ=path.join(root,'computadora_8_bits.circ');
const evidence=path.join(root,'evidencias');fs.mkdirSync(evidence,{recursive:true});
const programs=JSON.parse(fs.readFileSync(path.join(root,'pruebas','programas.json'),'utf8'));
const results=[];
function run(name){const args=['-Djava.awt.headless=true','-jar',jar,'--tty','table','--toplevel-circuit',name,circ];const output=execFileSync('java',args,{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});fs.writeFileSync(path.join(evidence,`${name}.txt`),output);return output.trim().split(/\r?\n/);}
for(const [name,,out,flags,pc,m7,fault=0]of programs){const lines=run(`TEST_${name}`);const raw=lines.at(-1).split('\t').map(s=>s.replaceAll(' ',''));if(raw.some(s=>!/^[01]+$/.test(s)))throw Error(`${name}: unknown/error value ${raw}`);const row=raw.map(s=>parseInt(s,2));const expected=[1,out,flags,pc,fault,m7];
const pass=expected.every((v,i)=>row[i]===v);results.push({test:name,pass,out:row[1],flags:row[2],pc:row[3],fault:row[4],m7:row[5],cycles:row[6]});console.log(`${pass?'PASS':'FAIL'} ${name}: OUT=${row[1]} FLAGS=${row[2]} PC=${row[3]} FAULT=${row[4]} M7=${row[5]} cycles=${row[6]}`);}
const full=run('SUMADOR_COMPLETO').slice(1).map(s=>s.trim().split(/\s+/).map(Number));const fullPass=full.length===8&&full.every(([a,b,ci,s,co])=>s===((a+b+ci)&1)&&co===((a+b+ci)>>1));results.push({test:'SUMADOR_COMPLETO',pass:fullPass,vectors:full.length});console.log(`${fullPass?'PASS':'FAIL'} SUMADOR_COMPLETO: ${full.length} combinations`);
const aluRows=run('TEST_ALU_1800');const last=aluRows.at(-1).split('\t').map(s=>parseInt(s.replaceAll(' ',''),2));const aluPass=last[0]===1&&last[1]===0&&last[2]===1800;results.push({test:'ALU_1800',pass:aluPass,vectors:1800});console.log(`${aluPass?'PASS':'FAIL'} ALU_1800: PASS=${last[0]} BAD=${last[1]} INDEX=${last[2]}`);
const memory=run('TEST_MEMORIA').at(-1).split('\t').map(s=>parseInt(s.replaceAll(' ',''),2));const memoryPass=memory[0]===1&&memory[1]===0&&memory[2]===31;results.push({test:'MEMORIA',pass:memoryPass,cycles:31});console.log(`${memoryPass?'PASS':'FAIL'} MEMORIA: ${memory}`);
const resetRows=run('TEST_RESET_HALT').map(s=>s.split('\t').map(v=>parseInt(v.replaceAll(' ',''),2)));
const byCycle=new Map(resetRows.map(r=>[r[0],r]));let resetPass=true;
for(const i of [31,32,33,34,35,67,68,69,70,71,72,73,74,75]){let r=byCycle.get(i);resetPass&&=!!r&&r[2]===1&&r[3]===8&&r[4]===5&&r[5]===8&&r[6]===3&&r[7]===0xc0&&r[10]===0&&r[11]===0&&r[12]===3&&r[13]===0;}
const rr=byCycle.get(36);resetPass&&=!!rr&&rr[1]===1&&rr.slice(2,12).every(v=>v===0)&&rr[12]===3&&rr[13]===0;results.push({test:'RESET_HALT',pass:resetPass,cycles:75});console.log(`${resetPass?'PASS':'FAIL'} RESET_HALT`);
fs.writeFileSync(path.join(evidence,'resultados.json'),JSON.stringify({simulator:'logisim-evolution-5.0.0-all.jar',results},null,2));
const table=['# Resultados de la simulación','','Motor: `logisim-evolution-5.0.0-all.jar`. Las pruebas se ejecutan con su interfaz `--tty table`.','','| Prueba | Resultado | OUT decimal | FLAGS decimal | PC | Ciclos / vectores |','|---|---|---:|---:|---:|---:|',...results.map(r=>`| ${r.test} | ${r.pass?'PASS':'FAIL'} | ${r.out??'-'} | ${r.flags??'-'} | ${r.pc??'-'} | ${r.cycles??r.vectors??'-'} |`),'','Los archivos TEST_*.txt contienen la salida literal de Logisim. En los bancos secuenciales, la salida halt no se imprime; las demás columnas siguen el orden vertical de los pines del circuito.'];fs.writeFileSync(path.join(evidence,'RESULTADOS.md'),table.join('\n')+'\n');if(results.some(r=>!r.pass))process.exitCode=1;
