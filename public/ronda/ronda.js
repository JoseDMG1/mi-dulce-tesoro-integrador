import { bitacora, decision, guardarRonda, muestras } from '../dominio.js';
const el=id=>document.getElementById(id),lan=new URLSearchParams(location.search).get('sala')==='1';
let service={called:false,by:''},ground=false;
let token='',myId='',players=[],playerName='',model='',progress=0,shift=null;
let heat=false,wet=false,thermalTests=0,attempts=0,options=[],statusText='',active=false;
const shifts=Object.entries(muestras).map(([id,m])=>({id,name:m.nombre,time:m.hora,temp:m.temperatura,hum:m.humedad}));
el('lobby').textContent=lan?'Sala Wi-Fi · Hasta 30 participantes':'Práctica individual · La bitácora se guarda en el portal.';
async function api(route,data){const r=await fetch('/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});if(!r.ok){const e=new Error((await r.json()).error||'La sala no está disponible.');e.status=r.status;throw e;}return r.json();}
function hud(){
  el('counter').textContent=progress<stations.length?'RONDA PERSONAL  /  '+(progress+1)+' DE '+stations.length:'BITÁCORA FIRMADA';
  el('objective').textContent=stations[progress]?.task||'Turno completado';
  el('guide').textContent=stations[progress]?.goal||'Puedes revisar las estaciones o iniciar otra ronda desde M.';
  el('network').textContent=lan?(statusText||'Sala LAN · '+players.length+' / 30'):'Modo individual';
  el('advance').value=progress;
  world.goal(progress);
}
// Los anfitriones de la planta anterior aceptan Z hasta -4,4.
// Conservar sus salas abiertas usando esa escala solo durante el transporte.
let escalaFondo=1;
async function registrarse(){
  const d=await api('join',{name:playerName,avatar:model});
  token=d.token;myId=d.id;escalaFondo=Math.min(1,(d.minZ??-4.4)/planta.fondo);
  return d;
}
async function sync(){
  if(!active||!token)return;
  try{const z=world.state.z;const d=await api('sync',{token,...world.state,z:z<0?z*escalaFondo:z,progress});if(!active)return;service=d.service;players=d.players;for(const p of players)if(p.z<0)p.z/=escalaFondo;world.peers(players,myId);statusText='';}
  catch(e){if(!active)return;statusText='Reconectando con la sala…';if(e.status===410){
    try{await registrarse();}catch(err){statusText=err.message;}
  }}
  if(active){el('network').textContent=statusText||'Sala LAN · '+players.length+' / 30'+(service.called?' · Atención en mesa':'');setTimeout(sync,180);}
}
function leave(){if(token)navigator.sendBeacon('/leave',JSON.stringify({token}));token='';active=false;}
window.addEventListener('pagehide',leave);
el('join').onsubmit=async e=>{
  e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;
  try{
    playerName=el('name').value.trim();if(!playerName)throw new Error('Escribe tu nombre.');
    model=new FormData(e.target).get('avatar');
    if(lan){const d=await registrarse();world.state.x=d.x;world.state.z=d.z;}
    active=true;el('overlay').hidden=true;el('hud').hidden=false;world.start({estacion:stationPanel,equipo:teamPanel,pantallaCompleta:toggleFull});hud();sync();
  }catch(err){el('error').textContent=err.message;submit.disabled=false;}
};
el('join').querySelector('button').disabled=false;
function closePanel(){el('overlay').hidden=true;options=[];world.pause(false);}
function panel(tag,title,body,items){
  world.pause(true);el('overlay').hidden=false;const card=el('card');card.replaceChildren();
  for(const [node,val] of [['small',tag],['h2',title],['p',body]]){const n=document.createElement(node);n.textContent=val;card.append(n);}
  options=[...items,['Volver al juego',closePanel]];
  options.forEach(([label,fn],i)=>{const b=document.createElement('button');b.textContent=(i+1)+' · '+label;b.onclick=fn;if(i===options.length-1)b.className='secondary';card.append(b);});
  if(items.length===0)card.lastElementChild.classList.remove('secondary');
  card.querySelector('button').focus();
}
window.addEventListener('keydown',e=>{if(!active||el('overlay').hidden||e.repeat)return;
  if(e.code==='Escape'){e.preventDefault();closePanel();}else if(/^[1-9]$/.test(e.key)){e.preventDefault();options[Number(e.key)-1]?.[1]();}
});
function toggleFull(){try{(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()).catch(()=>{});}catch{}}
function teamPanel(){panel('CAFETERÍA / EQUIPO','Equipo de turno',lan?players.map(p=>p.name+' ('+p.avatar+') · '+p.progress+'/'+stations.length).join('  |  '):playerName+' · '+model+' · Individual',[
  ['Controles',()=>panel('AYUDA','Moverse e interactuar','WASD o flechas para moverte y girar. Shift para correr y Espacio para saltar. Acércate al puesto, mira hacia él y pulsa E. Dentro del puesto, elige con el mouse o con las teclas numéricas. El plano numera los puestos en orden.',[])],
  ['Pantalla completa',toggleFull],...(progress===stations.length?[['Nueva ronda',()=>{progress=0;shift=null;heat=wet=false;thermalTests=attempts=0;world.screen(['Bitácora de turno','Esperando lectura','Puesto 05']);hud();closePanel();}]]:[]),
  ['Volver al portal',()=>{leave();location.assign('/#ronda');}]
]);}
function finish(i){if(progress===i)progress++;hud();closePanel();}
function reading(){return shift.temp+' °C · '+shift.hum+' % de humedad';}
function stationPanel(i,message=''){
  if(i>=stations.length){
    const extra=(body,actions)=>panel('SALÓN / EQUIPAMIENTO',interactivos[i].name,body,actions);
    if(i===stations.length){
      extra((message?message+' ':'')+(service.called?'Llamada de atención activa · '+service.by:'Mesa disponible. Usa el llamador para pedir apoyo al equipo.'),[[service.called?'Atender llamada':'Llamar al equipo',async()=>{
        try{const next=!service.called;service=lan?await api('service',{token,called:next}):{called:next,by:playerName};stationPanel(i);}catch{stationPanel(i,'No se pudo comunicar con la mesa.');}
      }]]);
    }else if(i===stations.length+1)extra('Vitrina de la barra. Inspecciona las dos filas de repostería.',[['Revisar bandeja',()=>extra('Bandeja revisada: seis piezas dispuestas para el servicio.',[])]]);
    else extra(ground?'Café molido listo para retirar.':'Molinillo listo. Prepara una dosis de café para la barra.',[[ground?'Retirar la dosis':'Moler una dosis',()=>{ground=!ground;stationPanel(i);}]]);
    return;
  }
  const open=(text,actions)=>panel('PUESTO 0'+(i+1)+'  /  '+(progress===i?'OBJETIVO ACTUAL':'EXPLORACIÓN'),stations[i].name,(message?message+'  ':'')+text,actions);
  if(i>progress&&i!==1){open('Primero completa el puesto '+(progress+1)+' · '+stations[progress].name+'. '+stations[progress].goal,[]);return;}
  if(i===0){open(shift?'Turno registrado: '+shift.name+' · '+shift.time+'.':'Selecciona el turno que vas a inspeccionar. Sus condiciones determinan la muestra del almacén.',shift?[]:shifts.map(s=>[s.name+' · '+s.time,()=>{shift=s;finish(i);} ]));return;}
  if(i===1){
    const toggle=(flag)=>{if(flag==='heat'){heat=!heat;if(heat)thermalTests|=1;}else{wet=!wet;if(wet)thermalTests|=2;}stationPanel(i);};
    open('Banco simulado: '+(heat?'30.0':'24.0')+' °C · '+(wet?72:55)+' % HR. Activa el calentador y el humidificador, observa cada cambio y guarda la prueba.',[
      [(heat?'Apagar':'Encender')+' calentador',()=>toggle('heat')],[(wet?'Apagar':'Encender')+' humidificador',()=>toggle('wet')],
      ['Guardar prueba DHT11',()=>{if(thermalTests!==3)return stationPanel(i,'Falta ensayar '+((thermalTests&1)?'humedad.':'temperatura.'));if(progress<i)return stationPanel(i,'Antes de registrar, inicia tu turno en el mostrador.');finish(i);}]
    ]);return;
  }
  if(i===2){if(progress>i){open('Muestra guardada · '+reading()+'. Sigue el marcador hasta recepción.',[]);return;}open('Lee la temperatura y humedad del estante a las '+shift.time+'. Esta es la muestra que usarás para decidir si el almacén necesita inspección.',[['Tomar muestra',()=>{world.screen(['Muestra recibida',shift.temp+' °C   '+shift.hum+' % HR','Pendiente de firma']);if(progress===i){progress++;hud();}stationPanel(i,'Muestra recibida.');}]]);return;}
  if(i===3){open(progress>i?'Recepción registrada · 3 cajas.':'Observa las cajas sobre la mesa de recepción. ¿Cuántas llegaron?',progress>i?[]:[2,3,4].map(n=>[n+' cajas',()=>n===3?finish(i):stationPanel(i,'El conteo no coincide. Mira de nuevo la mesa.')]));return;}
  const result=decision(shift.temp,shift.hum);
  open(progress===stations.length?'Bitácora firmada · '+shift.name+' · '+reading()+' · '+result+' · Intentos: '+attempts:reading()+'. Solicita inspección si supera 28 °C o 65 % HR. Firma la decisión.',progress===stations.length?[]:['Cerrar sin incidencia','Solicitar inspección'].map(label=>[label,()=>{attempts++;if(label!==result)return stationPanel(i,'Revisa los límites y vuelve a decidir.');guardarRonda(bitacora(shift.id,attempts,'Maqueta 3D'));progress=stations.length;world.screen(['Turno firmado',shift.name,result]);hud();stationPanel(i);}]));
}
