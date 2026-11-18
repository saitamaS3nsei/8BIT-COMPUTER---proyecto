const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('\n','&#10;');
const pt=(x,y)=>`(${x},${y})`;
const circuits=[];
class Circuit{
 constructor(name,ins=[],outs=[],width=220){this.name=name;this.parts=[];this.ins=ins;this.outs=outs;this.width=width;this.count=0;this.pinloc={};circuits.push(this);}
 comp(lib,name,x,y,attrs={}){this.parts.push(`<comp ${lib===null?'':`lib="${lib}" `}loc="${pt(x,y)}" name="${esc(name)}">${Object.entries(attrs).map(([n,v])=>`<a name="${esc(n)}" val="${esc(v)}"/>`).join('')}</comp>`);}
 wire(x,y,xx,yy){if(x!==xx||y!==yy)this.parts.push(`<wire from="${pt(x,y)}" to="${pt(xx,yy)}"/>`);}
 net(x,y,name,width=1,dir='in',len=40){let xx=x,yy=y;let facing='east';if(dir==='in')xx-=len;else if(dir==='out'){xx+=len;facing='west';}else if(dir==='down'){yy+=len;facing='north';}else {yy-=len;facing='south';}this.wire(x,y,xx,yy);this.comp(0,'Tunnel',xx,yy,{label:name,width,facing,labelfont:'SansSerif plain 11'});}
 text(x,y,text,size=16){this.comp(6,'Text',x,y,{text,font:`SansSerif ${size>=20?'bold':'plain'} ${size}`,halign:'left'});}
 pos(){const n=this.count++;return [300+(n%4)*330,450+Math.floor(n/4)*180];}
 pins(){let max=0;for(const [arr,isout,x] of [[this.ins,false,160],[this.outs,true,1080]]){arr.forEach(([n,w],i)=>{let y=90+i*40;this.comp(0,'Pin',x,y,{facing:isout?'west':'east',type:isout?'output':'input',width:w,label:n,labelloc:isout?'east':'west',radix:w>1?'16':'2',appearance:'classic'});this.net(x,y,n,w,isout?'in':'out',50);this.pinloc[n]=[x,y];max=Math.max(max,y);});}this.count=Math.max(0,Math.ceil((max+100-450)/180)*4);}
 constant(n,w,value,x,y){if(x===undefined)[x,y]=this.pos();this.comp(0,'Constant',x,y,{width:w,value:`0x${value.toString(16)}`});this.net(x,y,n,w,'out');}
 gate(kind,out,inputs,w=1,x,y){if(x===undefined)[x,y]=this.pos();const unary=kind==='NOT';this.comp(1,`${kind} Gate`,x,y,{width:w,size:30,...(!unary?{inputs:2}:{}),label:`G_${out}`,labelfont:'SansSerif plain 12'});this.net(x,y,out,w,'out');const dx=kind==='XOR'?-40:-30;if(unary)this.net(x-30,y,inputs[0],w);else {this.net(x+dx,y-10,inputs[0],w);this.net(x+dx,y+10,inputs[1],w);}}
 and(out,...terms){if(terms.length===1){this.gate('AND',out,[terms[0],'ONE']);return;}let a=terms[0];for(let i=1;i<terms.length;i++){const b=i===terms.length-1?out:`${out}_g${i}`;this.gate('AND',b,[a,terms[i]]);a=b;}}
 or(out,...terms){let a=terms[0];for(let i=1;i<terms.length;i++){const b=i===terms.length-1?out:`${out}_g${i}`;this.gate('OR',b,[a,terms[i]]);a=b;}}
 mux(out,inputs,sel,w=8,x,y){if(x===undefined)[x,y]=this.pos();const n=inputs.length,s=Math.log2(n),dx=n===2?-30:-40,first=n===2?-10:-n*5,sy=n===2?20:n*5;this.comp(2,'Multiplexer',x,y,{width:w,select:s,enable:false});inputs.forEach((a,i)=>this.net(x+dx,y+first+i*(n===2?20:10),a,w));this.net(x-20,y+sy,sel,s,'down',40);this.net(x,y,out,w,'out');}
 reg(out,input,en,clock,clear,w=8,x,y){if(x===undefined)[x,y]=this.pos();this.comp(4,'Register',x,y,{width:w,appearance:'classic',label:`REG_${out}`,labelfont:'SansSerif bold 14',showInTab:true});this.net(x,y,out,w,'out');this.net(x-30,y,input,w);this.net(x-30,y+10,en,1);this.net(x-20,y+20,clock,1,'down',40);this.net(x-10,y+20,clear,1,'down',70);}
 adder(out,a,b,cin,cout,w=8,x,y){if(x===undefined)[x,y]=this.pos();this.comp(3,'Adder',x,y,{width:w});this.net(x-40,y-10,a,w);this.net(x-40,y+10,b,w);this.net(x-20,y-20,cin,1,'up');this.net(x-20,y+20,cout,1,'down');this.net(x,y,out,w,'out');}
 equal(out,a,b,w=8,x,y){if(x===undefined)[x,y]=this.pos();this.comp(3,'Comparator',x,y,{width:w,mode:'unsigned'});this.net(x-40,y-10,a,w);this.net(x-40,y+10,b,w);this.net(x,y,out,1,'out');}
 split(bus,width,groups,x,y){if(x===undefined)[x,y]=this.pos();const attrs={incoming:width,fanout:groups.length,facing:'east',appear:'left',spacing:2};for(let b=0;b<width;b++)attrs[`bit${b}`]=groups.findIndex(g=>g.bits.includes(b))<0?'none':groups.findIndex(g=>g.bits.includes(b));this.comp(0,'Splitter',x,y,attrs);this.net(x,y,bus,width);groups.forEach((g,i)=>this.net(x+20,y-(groups.length-i)*20+10,g.name,g.bits.length,'out',50));}
 join(bus,names,x,y){this.split(bus,names.length,names.map((name,i)=>({name,bits:[i]})),x,y);}
 rom(out,address,abits,dbits,values,x,y,label=''){if(x===undefined)[x,y]=this.pos();this.comp(4,'ROM',x,y,{addrWidth:abits,dataWidth:dbits,appearance:'classic',contents:`addr/data: ${abits} ${dbits}\n${values.map(v=>v.toString(16)).join(' ')}\n`,label,labelvisible:true});this.net(x,y+10,address,abits);this.net(x+240,y+60,out,dbits,'out');}
 sub(child,mapping,x,y){this.comp(null,child.name,x,y,{});child.ins.forEach(([n,w],i)=>this.net(x,y+i*40,mapping[n]??n,w));child.outs.forEach(([n,w],i)=>this.net(x+child.width,y+i*40,mapping[n]??n,w,'out'));}
 xml(){const n=Math.max(this.ins.length,this.outs.length);let ap='';if(n){ap=`<appear><rect x="50" y="30" width="${this.width}" height="${n*40+10}" stroke="#000000" stroke-width="2" fill="#ffffff"/>`;for(const [arr,out]of[[this.ins,false],[this.outs,true]])arr.forEach(([name],i)=>{let x=out?50+this.width:50,y=50+i*40,p=this.pinloc[name];ap+=`<circ-port x="${x-4}" y="${y-4}" width="8" height="8" dir="${out?'out':'in'}" pin="${p.join(',')}"/><text x="${out?x-8:x+8}" y="${y+4}" text-anchor="${out?'end':'start'}" font-family="SansSerif" font-size="12">${esc(name)}</text>`;});ap+='<circ-anchor x="46" y="46" width="8" height="8" facing="east"/></appear>';}
 return `<circuit name="${this.name}"><a name="circuit" val="${this.name}"/><a name="appearance" val="custom"/>${ap}${this.parts.join('\n')}</circuit>`;}
}
const bits=(n,start=0)=>Array.from({length:n},(_,i)=>i+start);

export { Circuit, circuits, bits };
