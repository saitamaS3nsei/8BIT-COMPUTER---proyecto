// Simulación de la computadora física: cada chip del PLAN_CONSTRUCCION.md es un chip 74LS de la
// librería TTL de Logisim Evolution, con los mismos números de pin. Las compuertas se agrupan
// en chips 7400/7404/7408/7432/7486 de 4 (o 6) compuertas, igual que en la protoboard.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Circuit,circuits,bits} from './circuitos-base.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../fisico');
fs.mkdirSync(path.join(root,'pruebas'),{recursive:true});

// Pines de cada chip (tipos obtenidos del JAR con Inspect.java). by = y de la fila inferior.
const rng=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const GATE4={N:14,by:30,i:[1,2,4,5,9,10,12,13],o:[3,6,8,11]};
const SPEC={
 '7400':GATE4,'7408':GATE4,'7432':GATE4,'7486':GATE4,
 '7404':{N:14,by:30,i:[1,3,5,9,11,13],o:[2,4,6,8,10,12]},
 '7474':{N:14,by:30,i:[1,2,3,4,10,11,12,13],o:[5,6,8,9]},
 '7430':{N:14,by:30,i:[1,2,3,4,5,6,11,12],o:[8]},
 '74138':{N:16,by:30,i:[1,2,3,4,5,6],o:[7,9,10,11,12,13,14,15]},
 '74151':{N:16,by:30,i:[1,2,3,4,7,9,10,11,12,13,14,15],o:[5,6]},
 '74157':{N:16,by:30,i:[1,2,3,5,6,10,11,13,14,15],o:[4,7,9,12]},
 '74161':{N:16,by:30,i:[1,2,3,4,5,6,7,9,10],o:[11,12,13,14,15]},
 '74283':{N:16,by:30,i:[2,3,5,6,7,11,12,14,15],o:[1,4,9,10,13]},
 '74245':{N:20,by:30,i:[1,19],io:[...rng(2,9),...rng(11,18)]},
 '74377':{N:20,by:50,i:[1,3,4,7,8,11,13,14,17,18],o:[2,5,6,9,12,15,16,19]},
 '74541':{N:20,by:30,i:[1,...rng(2,9),19],o:rng(11,18)}
};
const NAME={'7400':'74LS00','7404':'74LS04','7408':'74LS08','7432':'74LS32','7486':'74LS86','7474':'74LS74','7430':'74LS30','74138':'74LS138','74151':'74LS151','74157':'74LS157','74161':'74LS161','74283':'74LS283','74245':'74LS245','74377':'74LS377','74541':'74LS541 (salida de la 74LS374)'};
const pinXY=(s,p)=>{const h=s.N/2;return p<h?[10+20*(p-1),s.by]:[10+20*(h-1)-20*(p-h-1),-30];};
const SLOTS=[[1,2,3],[4,5,6],[9,10,8],[12,13,11]];
const NOTSLOTS=[[1,2],[3,4],[5,6],[9,8],[11,10],[13,12]];

class Board{
 constructor(c){this.c=c;this.mods=new Map();this.pools=new Map();this.subs=[];this.count={};}
 mod(m){if(!this.mods.has(m))this.mods.set(m,[]);return this.mods.get(m);}
 chip(m,type,nets,label){this.mod(m).push({type,nets,label:label??`${NAME[type]}`});}
 slot(m,type,out,a,b){
  const k=`${m}|${type}`;let p=this.pools.get(k);if(!p){p={list:[]};this.pools.set(k,p);}
  const S=type==='7404'?NOTSLOTS:SLOTS;let cur=p.list.at(-1);
  if(!cur||cur.used>=S.length){cur={nets:{},used:0};p.list.push(cur);this.mod(m).push({type,nets:cur.nets,label:`${NAME[type]} compuertas ${p.list.length}`});}
  const s=S[cur.used++];
  if(type==='7404'){cur.nets[s[0]]=a;cur.nets[s[1]]=out;}else{cur.nets[s[0]]=a;cur.nets[s[1]]=b;cur.nets[s[2]]=out;}
  return out;
 }
 and(m,o,a,b){return this.slot(m,'7408',o,a,b);} or(m,o,a,b){return this.slot(m,'7432',o,a,b);}
 xor(m,o,a,b){return this.slot(m,'7486',o,a,b);} nand(m,o,a,b){return this.slot(m,'7400',o,a,b);}
 not(m,o,a){return this.slot(m,'7404',o,a);}
 place(ch,x,y){
  const s=SPEC[ch.type];this.c.comp(7,ch.type,x,y,{label:ch.label});this.count[ch.type]=(this.count[ch.type]??0)+1;
  const ins=[...(s.i??[]),...(s.io??[])].filter((p,i,a)=>a.indexOf(p)===i);
  for(const p of [...(s.i??[]),...(s.o??[]),...(s.io??[])]){
   const isIn=(s.i??[]).includes(p),isIo=(s.io??[]).includes(p);let net=ch.nets[p];
   if(net===undefined){if(isIn)net='GND';else if(isIo)throw Error(`${ch.type} pin ${p} sin conexión (${ch.label})`);else continue;}
   const [dx,dy]=pinXY(s,p);this.c.net(x+dx,y+dy,net,1,dy>0?'down':'up',20+20*(p%2));
  }
 }
 layout(x0,y0,cols=5,dx=280,dy=200){
  let y=y0;
  for(const [m,list] of this.mods){
   this.c.text(x0-120,y-100,m,22);
   list.forEach((ch,i)=>this.place(ch,x0+(i%cols)*dx,y+Math.floor(i/cols)*dy));
   y+=Math.ceil(list.length/cols)*dy+100;
  }
  return y;
 }
 counts(){const per={};for(const [m,list] of this.mods)for(const ch of list){per[m]??={};per[m][NAME[ch.type]]=(per[m][NAME[ch.type]]??0)+1;}return per;}
}

const bitNets=(prefix,n=8)=>bits(n).map(i=>`${prefix}${i}`);
const D377=[3,4,7,8,13,14,17,18],Q377=[2,5,6,9,12,15,16,19];
function reg377(b,m,label,E,CLK,D,Q){
 const nets={1:E,11:CLK};D.forEach((n,i)=>nets[D377[i]]=n);Q.forEach((n,i)=>{if(n)nets[Q377[i]]=n;});b.chip(m,'74377',nets,label);
}
function buf245(b,m,label,dir,oe,a,bnets){
 const nets={1:dir,19:oe};a.forEach((n,i)=>nets[2+i]=n);bnets.forEach((n,i)=>nets[18-i]=n);b.chip(m,'74245',nets,label);
}
const busBits=bitNets('BUS');

// ---------------------------------------------------------------- 74LS374 (celda de memoria)
// La librería TTL de Logisim no trae el 74LS374: se arma con un 74LS377 siempre habilitado
// (registro de 8 bits por flanco) más un 74LS541 (buffer triestado de 8 bits) para /OC.
const LS374=new Circuit('LS374',[['D',8],['CLK',1],['nOC',1]],[['Q',8]],150);LS374.pins();
{
 const b=new Board(LS374);
 LS374.split('D',8,bits(8).map(i=>({name:`d${i}`,bits:[i]})),300,300);
 LS374.constant('GND',1,0,300,500);LS374.constant('VCC',1,1,300,560);
 reg377(b,'74LS374','74LS377 (celda)','GND','CLK',bitNets('d'),bitNets('q'));
 b.chip('74LS374','74541',Object.fromEntries([[1,'nOC'],[19,'nOC'],...bits(8).map(i=>[2+i,`q${i}`]),...bits(8).map(i=>[18-i,`y${i}`])]),'74LS541 (salida triestado)');
 LS374.join('Q',bitNets('y'),1000,300);
 b.layout(500,700,2,320,200);
}

// ---------------------------------------------------------------- CPU
const CPU_IN=[['CLK555',1],['AUTO',1],['STEP_A',1],['STEP_B',1],['nRESET',1],['PROG',1],['DIPD',8],['DIPA',3],['WR_A',1],['WR_B',1]];
const CPU_OUT=[['OUT',8],['A',8],['B',8],['IR',8],['MDR',8],['BUS',8],['PC',3],['MAR',3],['FLAGS',4],['PHASE',2],['HALTED',1],['SYSCLK',1],['DBG',8]];
const cpu=new Circuit('CPU_FISICA',CPU_IN,CPU_OUT,260);cpu.pins();
const b=new Board(cpu);
cpu.constant('GND',1,0,200,900);cpu.constant('VCC',1,1,200,960);
cpu.split('DIPD',8,bits(8).map(i=>({name:`DIPD${i}`,bits:[i]})),300,1050);
cpu.split('DIPA',3,bits(3).map(i=>({name:`DIPA${i}`,bits:[i]})),300,1250);
cpu.split('BUS',8,bits(8).map(i=>({name:`BUS${i}`,bits:[i]})),300,1450);
cpu.join('OUT',bitNets('OUT'),640,1050);cpu.join('A',bitNets('A'),640,1250);cpu.join('B',bitNets('B'),640,1450);
cpu.join('IR',bitNets('IR'),900,1050);cpu.join('MDR',bitNets('MDR'),900,1250);
cpu.join('PC',bitNets('PC',3),900,1450);cpu.join('MAR',bitNets('MAR',3),1150,1050);
cpu.join('FLAGS',['Zf','Cf','Nf','Vf'],1150,1250);cpu.join('PHASE',['PH0','PH1'],1150,1450);cpu.join('DBG',['T3','HLT','HLT_SET','HALT_D','HALTQ','nHALTQ','nCLKsrc','CLKsrc'],1150,1650);
// Alias: la salida HALTED es la misma red que HALTQ (salida Q del flip-flop de HLT).
cpu.comp(0,'Tunnel',1300,1650,{label:'HALTED',width:1,facing:'east'});cpu.comp(0,'Tunnel',1340,1650,{label:'HALTQ',width:1,facing:'west'});cpu.wire(1300,1650,1340,1650);

// --- Paso 2: reloj y reset
const R='PASO 2 | RELOJ Y RESET';
b.chip(R,'7400',{1:'STEP_A',2:'STEPQ',3:'STEP_nQ',4:'STEP_B',5:'STEP_nQ',6:'STEPQ'},'74LS00 antirrebote PASO A PASO (latch SR)');
b.chip(R,'7400',{1:'WR_A',2:'BTN_WRITE',3:'WR_nQ',4:'WR_B',5:'WR_nQ',6:'BTN_WRITE'},'74LS00 antirrebote ESCRIBIR (latch SR)');
b.not(R,'nAUTO','AUTO');b.not(R,'nPROG','PROG');b.not(R,'nSYSCLK','SYSCLK');b.not(R,'nCLKsrc','CLKsrc');
b.and(R,'clk_auto','AUTO','CLK555');b.and(R,'clk_step','nAUTO','STEPQ');b.or(R,'CLKsrc','clk_auto','clk_step');
b.and(R,'nRST_TOTAL','nRESET','nPROG');b.and(R,'SYSCLK','CLKsrc','nHALTQ');
b.chip(R,'7474',{1:'nRST_TOTAL',2:'HALT_D',3:'nCLKsrc',4:'VCC',5:'HALTQ',6:'nHALTQ',10:'VCC',13:'VCC'},'74LS74 bandera HLT');

// --- Paso 3: contador de programa
const P='PASO 3 | CONTADOR DE PROGRAMA';
b.chip(P,'74161',{1:'nRST_TOTAL',2:'SYSCLK',3:'IR0',4:'IR1',5:'IR2',6:'GND',7:'T1',9:'nPC_LOAD',10:'T1',14:'PC0',13:'PC1',12:'PC2'},'74LS161 PC');

// --- Paso 4: registros y bus
const G='PASO 4 | REGISTROS Y BUS';
b.chip(G,'74157',{1:'ADDR_SEL',2:'PC0',3:'IR0',4:'MARD0',5:'PC1',6:'IR1',7:'MARD1',11:'PC2',10:'IR2',9:'MARD2',15:'GND'},'74LS157 PC o IR a MAR');
reg377(b,G,'74LS377 MAR','nMAR_LD','SYSCLK',['MARD0','MARD1','MARD2','GND','GND','GND','GND','GND'],['MAR0','MAR1','MAR2']);
reg377(b,G,'74LS377 IR','nT1','SYSCLK',busBits,bitNets('IR'));
reg377(b,G,'74LS377 A','nA_LD','SYSCLK',busBits,bitNets('A'));
reg377(b,G,'74LS377 B','nB_LD','SYSCLK',busBits,bitNets('B'));
reg377(b,G,'74LS377 OUT','nOUT_LD','SYSCLK',busBits,bitNets('OUT'));
reg377(b,G,'74LS377 MDR','nMDR_LD','SYSCLK',busBits,bitNets('MDR'));
buf245(b,G,'74LS245 interruptores al bus','VCC','nPROG',bitNets('DIPD'),busBits);
buf245(b,G,'74LS245 A al bus','VCC','nA_OUT',bitNets('A'),busBits);
buf245(b,G,'74LS245 ALU al bus','VCC','nALU_OUT',bitNets('RES'),busBits);

// --- Paso 5: memoria
const M='PASO 5 | MEMORIA';
b.chip(M,'74157',{1:'PROG',2:'MAR0',3:'DIPA0',4:'ADDR0',5:'MAR1',6:'DIPA1',7:'ADDR1',11:'MAR2',10:'DIPA2',9:'ADDR2',15:'GND'},'74LS157 dirección normal o manual');
const dec=(g1,pref)=>({1:'ADDR0',2:'ADDR1',3:'ADDR2',4:'GND',5:'GND',6:g1,15:`${pref}0`,14:`${pref}1`,13:`${pref}2`,12:`${pref}3`,11:`${pref}4`,10:`${pref}5`,9:`${pref}6`,7:`${pref}7`});
b.chip(M,'74138',dec('MEM_RD','nRD'),'74LS138 lectura (decodificador)');
b.chip(M,'74138',dec('WE_PULSE','nWE'),'74LS138 escritura (DEMUX)');
b.and(M,'we_prog','PROG','BTN_WRITE');b.and(M,'we_run','MEM_WE','nSYSCLK');b.or(M,'WE_PULSE','we_prog','we_run');

// --- Paso 6: ALU y banderas
const A='PASO 6 | ALU Y BANDERAS';
b.not(A,'nIR5','IR5');b.not(A,'nIR6','IR6');b.and(A,'sub_t','nIR5','nIR6');b.and(A,'SUB','sub_t','IR4');
for(let i=0;i<8;i++)b.xor(A,`Bx${i}`,`B${i}`,'SUB');
const add=(base,cin,cout)=>({7:cin,9:cout,5:`A${base}`,3:`A${base+1}`,14:`A${base+2}`,12:`A${base+3}`,6:`Bx${base}`,2:`Bx${base+1}`,15:`Bx${base+2}`,11:`Bx${base+3}`,4:`S${base}`,1:`S${base+1}`,13:`S${base+2}`,10:`S${base+3}`});
b.chip(A,'74283',add(0,'SUB','C4A'),'74LS283 bits 0-3');b.chip(A,'74283',add(4,'C4A','CARRY'),'74LS283 bits 4-7');
for(let i=0;i<8;i++){b.and(A,`AND${i}`,`A${i}`,`B${i}`);b.or(A,`OR${i}`,`A${i}`,`B${i}`);b.xor(A,`XOR${i}`,`A${i}`,`B${i}`);b.not(A,`NOT${i}`,`A${i}`);}
for(let i=0;i<8;i++)b.chip(A,'74151',{4:`S${i}`,3:`S${i}`,2:`AND${i}`,1:`OR${i}`,15:`XOR${i}`,14:`NOT${i}`,13:i===0?'GND':`A${i-1}`,12:i===7?'GND':`A${i+1}`,9:'IR6',10:'IR5',11:'IR4',7:'GND',5:`RES${i}`,6:`nRES${i}`},`74LS151 bit ${i}`);
b.chip(A,'7430',{1:'nRES0',2:'nRES1',3:'nRES2',4:'nRES3',5:'nRES4',6:'nRES5',11:'nRES6',12:'nRES7',8:'nZALL'},'74LS30 detector de cero');
b.not(A,'Zn','nZALL');b.xor(A,'v_x1','A7','Bx7');b.xor(A,'v_x2','A7','S7');b.not(A,'v_n','v_x1');b.and(A,'Vn','v_n','v_x2');
reg377(b,A,'74LS377 BANDERAS (Z C N V)','nALU_OUT','SYSCLK',['Zn','CARRY','RES7','Vn','GND','GND','GND','GND'],['Zf','Cf','Nf','Vf']);

// --- Paso 7: unidad de control
const C='PASO 7 | UNIDAD DE CONTROL';
b.chip(C,'74161',{1:'nRST_TOTAL',2:'SYSCLK',7:'VCC',10:'VCC',9:'VCC',14:'PH0',13:'PH1'},'74LS161 fases T0-T3');
b.chip(C,'74138',{1:'PH0',2:'PH1',3:'GND',4:'GND',5:'GND',6:'VCC',15:'nT0',14:'nT1',13:'nT2',12:'nT3'},'74LS138 fases');
b.chip(C,'74138',{1:'IR4',2:'IR5',3:'IR6',4:'GND',5:'GND',6:'IR7',15:'nLDA',14:'nLDB',13:'nSTA',12:'nJMP',11:'nJZ',10:'nOUT',9:'nHLT'},'74LS138 instrucción');
b.not(C,'T1','nT1');b.not(C,'T3','nT3');b.not(C,'ADDR_SEL','nT2');b.not(C,'ALUC','IR7');b.not(C,'JZ','nJZ');b.not(C,'STA','nSTA');b.not(C,'HLT','nHLT');
b.and(C,'nMAR_LD','nT0','nT2');
b.nand(C,'LDX','nLDA','nLDB');b.and(C,'t3x','T3','LDX');b.or(C,'MEM_RD','T1','t3x');
b.nand(C,'ld_or_alu','nLDA','IR7');b.nand(C,'nA_LD','T3','ld_or_alu');
b.or(C,'nB_LD','nT3','nLDB');
b.nand(C,'sta_or_out','nSTA','nOUT');b.nand(C,'nA_OUT','T3','sta_or_out');
b.nand(C,'nALU_OUT','T3','ALUC');
b.and(C,'MEM_WE','T3','STA');
b.or(C,'nOUT_LD','nT3','nOUT');
b.nand(C,'jz_z','JZ','Zf');b.nand(C,'jmp_or_jz','nJMP','jz_z');b.nand(C,'nPC_LOAD','T3','jmp_or_jz');
b.and(C,'HLT_SET','T3','HLT');b.or(C,'HALT_D','HALTQ','HLT_SET');
b.or(C,'mdr_or','MEM_RD','MEM_WE');b.not(C,'nMDR_LD','mdr_or');
// /FLAG_LD es la misma señal que /ALU_OUT (se activa en T3 de las instrucciones de la ALU).

const endY=b.layout(300,1900);
// Celdas de memoria: ocho 74LS374.
cpu.text(180,endY-40,'PASO 5 | CELDAS DE MEMORIA (8 x 74LS374)',22);
for(let i=0;i<8;i++){const x=300+(i%4)*400,y=endY+60+Math.floor(i/4)*520;cpu.comp(null,'LS374',x,y,{});cpu.text(x,y-30,`74LS374 celda ${i}`,14);
 cpu.net(x,y,'BUS',8);cpu.net(x,y+40,`nWE${i}`,1);cpu.net(x,y+80,`nRD${i}`,1);cpu.net(x+150,y,'BUS',8,'out');}

// ---------------------------------------------------------------- Banco de pruebas
const MAIN_DEFAULT=0;
function bench(name,title,words){
 const t=new Circuit(name,[],[['OUT',8],['PC',3],['A',8],['B',8],['IR',8],['FLAGS',4],['HALTED',1],['PHASE',2],['CYCLES',8],['DBG',8],['halt',1]]);t.pins();
 t.text(100,40,title,20);
 t.constant('ZERO',1,0,150,300);t.constant('ONE',1,1,150,360);t.constant('ZERO8',8,0,150,420);
 t.comp(0,'Clock',150,500,{});t.net(150,500,'CLK',1,'out');
 t.comp(4,'Counter',400,300,{width:8,max:'0xff',appearance:'classic'});t.net(400,300,'CYCLES',8,'out');t.net(370,300,'ZERO8',8);t.net(380,320,'CLK',1,'down');t.net(390,320,'ZERO',1,'down',70);t.net(370,290,'ZERO',1);t.net(380,280,'ONE',1,'up');t.net(370,310,'ONE',1);
 t.split('CYCLES',8,[{name:'CYCADDR',bits:bits(7)},{name:'halt',bits:[7]}],600,300);
 const stim=[];for(let c=0;c<128;c++){if(c<24){const a=Math.floor(c/3);stim.push(words[a]|(a<<8)|((c%3===1)?1<<11:0)|(1<<12)|(1<<13));}else stim.push(1<<13);}
 t.rom('STIM','CYCADDR',7,14,stim,700,300,'ESTIMULOS: programar 8 palabras y ejecutar');
 t.split('STIM',14,[{name:'DIPD',bits:bits(8)},{name:'DIPA',bits:[8,9,10]},{name:'WR',bits:[11]},{name:'PROG',bits:[12]},{name:'nRESET',bits:[13]}],1100,360);
 t.gate('NOT','nWR',['WR']);
 t.sub(cpu,{CLK555:'CLK',AUTO:'ONE',STEP_A:'ZERO',STEP_B:'ONE',WR_A:'WR',WR_B:'nWR',OUT:'OUT',PC:'PC',A:'A',B:'B',IR:'IR',FLAGS:'FLAGS',HALTED:'HALTED',PHASE:'PHASE',MDR:'MDR_X',BUS:'BUS_X',MAR:'MAR_X',SYSCLK:'SYSCLK_X'},1300,600);
 return t;
}
const programs={
 P1_SUMA:{title:'Programa 1: 5 + 3',words:[0x86,0x97,0x00,0xD0,0xE0,0x00,0x05,0x03],expect:{OUT:0x08,PC:5,A:0x08,B:0x03,FLAGS:0x0,HALTED:1}},
 P2_AND:{title:'Programa 2: 0F AND 05',words:[0x87,0x96,0x20,0xD0,0xE0,0x00,0x05,0x0F],expect:{OUT:0x05,PC:5,A:0x05,B:0x05,FLAGS:0x0,HALTED:1}},
 P2_OR:{title:'Programa 2: 0F OR 05',words:[0x87,0x96,0x30,0xD0,0xE0,0x00,0x05,0x0F],expect:{OUT:0x0F,PC:5,A:0x0F,B:0x05,FLAGS:0x0,HALTED:1}},
 P2_XOR:{title:'Programa 2: 0F XOR 05',words:[0x87,0x96,0x40,0xD0,0xE0,0x00,0x05,0x0F],expect:{OUT:0x0A,PC:5,A:0x0A,B:0x05,FLAGS:0x0,HALTED:1}},
 P3_JZ_SALTA:{title:'Programa 3: JZ salta (resultado cero)',words:[0x85,0x95,0xD0,0x10,0xC6,0xE0,0xD0,0xE0],expect:{OUT:0x00,PC:0,A:0x00,B:0xE0,FLAGS:0x3,HALTED:1}},
 P3_JZ_NO_SALTA:{title:'Programa 3: JZ no salta (resultado distinto de cero)',words:[0x85,0x96,0xD0,0x10,0xC6,0xE0,0xD0,0xE0],expect:{OUT:0xE0,PC:6,A:0x10,B:0xD0,FLAGS:0x2,HALTED:1}},
 STA_LDA:{title:'STA y LDA: guardar en memoria y recuperar',words:[0x86,0xA7,0x97,0x00,0xD0,0xE0,0x2A,0x00],expect:{OUT:0x54,PC:6,A:0x54,B:0x2A,FLAGS:0x0,HALTED:1}},
 JMP:{title:'JMP: salto incondicional',words:[0xB3,0xE0,0xE0,0x87,0xD0,0xE0,0x00,0x2A],expect:{OUT:0x2A,PC:6,A:0x2A,B:null,FLAGS:null,HALTED:1}},
 NOT_SHL_SHR:{title:'NOT, SHL y SHR',words:[0x87,0x50,0x60,0x70,0xD0,0xE0,0x00,0x0F],expect:{OUT:0x70,PC:6,A:0x70,B:null,FLAGS:null,HALTED:1}},
 OVERFLOW:{title:'Overflow con signo: 7F + 01',words:[0x86,0x97,0x00,0xD0,0xE0,0x00,0x7F,0x01],expect:{OUT:0x80,PC:5,A:0x80,B:0x01,FLAGS:0xC,HALTED:1}},
 RESTA_NEG:{title:'Resta negativa: 3 - 5',words:[0x86,0x97,0x10,0xD0,0xE0,0x00,0x03,0x05],expect:{OUT:0xFE,PC:5,A:0xFE,B:0x05,FLAGS:0x4,HALTED:1}},
 ACARREO_CERO:{title:'Acarreo y cero: FF + 01',words:[0x86,0x97,0x00,0xD0,0xE0,0x00,0xFF,0x01],expect:{OUT:0x00,PC:5,A:0x00,B:0x01,FLAGS:0x3,HALTED:1}}
};
const tests=Object.entries(programs).map(([n,p])=>bench(`TEST_${n}`,p.title,p.words));

// ---------------------------------------------------------------- Circuito principal interactivo
const top=new Circuit('COMPUTADORA_FISICA',[],[['OUT',8],['A',8],['B',8],['IR',8],['MDR',8],['BUS',8],['PC',3],['MAR',3],['FLAGS',4],['PHASE',2],['HALTED',1]]);top.pins();
top.text(100,40,'COMPUTADORA DE 8 BITS | SIMULACION DE LA VERSION FISICA (chips 74LS)',22);
top.text(100,70,'PROG=1: programar con DIPD, DIPA y WRITE. PROG=0 y nRESET: ejecutar. AUTO=1: reloj 555; AUTO=0: botón STEP.',14);
const inp=(n,w,x,y,init=0)=>{top.comp(0,'Pin',x,y,{facing:'east',type:'input',width:w,label:n,labelloc:'west',radix:w>1?'16':'2',appearance:'classic'});top.net(x,y,n,w,'out',50);};
inp('AUTO',1,1500,100);inp('STEP',1,1500,140);inp('nRESET',1,1500,180);inp('PROG',1,1500,220);inp('DIPD',8,1500,260);inp('DIPA',3,1500,300);inp('WRITE',1,1500,340);
top.comp(0,'Clock',1500,420,{label:'RELOJ_555',highDuration:1,lowDuration:1});top.net(1500,420,'CLK555',1,'out',50);
top.gate('NOT','nSTEP',['STEP'],1,1700,140);top.gate('NOT','nWRITE',['WRITE'],1,1700,340);
top.sub(cpu,{STEP_A:'STEP',STEP_B:'nSTEP',WR_A:'WRITE',WR_B:'nWRITE',SYSCLK:'SYSCLK_X'},1800,200);
top.text(1500,500,'Los pines de salida muestran los LEDs del prototipo.',12);

const libs='<lib desc="#Wiring" name="0"/><lib desc="#Gates" name="1"/><lib desc="#Plexers" name="2"/><lib desc="#Arithmetic" name="3"/><lib desc="#Memory" name="4"/><lib desc="#I/O" name="5"/><lib desc="#Base" name="6"/><lib desc="#TTL" name="7"/>';
function project(list,main){return `<?xml version="1.0" encoding="UTF-8"?><project source="5.0.0" version="1.0">${libs}<main name="${main}"/><options><a name="simlimit" val="10000"/><a name="simrand" val="0"/></options><mappings/><toolbar><tool lib="6" name="Poke Tool"/><tool lib="6" name="Edit Tool"/><tool lib="6" name="Text Tool"/></toolbar>${list.map(c=>c.xml()).join('\n')}</project>`;}
const sub=[LS374,cpu];
fs.writeFileSync(path.join(root,'computadora_8_bits_fisica.circ'),project([...sub,top],top.name));
fs.writeFileSync(path.join(root,'pruebas/bancos.circ'),project([...sub,...tests],tests[0].name));
fs.writeFileSync(path.join(root,'pruebas/programas.json'),JSON.stringify(programs,null,2));
const per=b.counts();const total={};for(const m of Object.values(per))for(const [k,v] of Object.entries(m))total[k]=(total[k]??0)+v;
total['74LS374 (celdas de memoria)']=8;
fs.writeFileSync(path.join(root,'chips.json'),JSON.stringify({porModulo:per,total},null,2));
console.log('Chips por tipo:',JSON.stringify(total));
