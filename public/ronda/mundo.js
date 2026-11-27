const stations=[
  {name:'Mostrador',task:'Inicia tu turno',x:-3.8,z:-1.3,y:1.9,goal:'Elige el turno de apertura o el de la tarde en la cafetera.'},
  {name:'Banco DHT11',task:'Prueba el sensor',x:-1.73,z:-5.31,y:1.24,goal:'Pasa junto a caja y entra por la puerta a la derecha de la carta. Gira a la izquierda en la cocina para probar el DHT11.'},
  {name:'Almacén',task:'Mide el almacén',x:-4.79,z:-7.83,y:1.56,goal:'Toma una muestra del turno con el módulo blanco del estante.'},
  {name:'Recepción',task:'Cuenta las cajas',x:-4.54,z:-5.47,y:1.27,goal:'Cuenta las cajas de la mesa de recepción dentro del almacén.'},
  {name:'Administración',task:'Firma tu decisión',x:-.49,z:-1.81,y:1.76,goal:'Regresa por la cocina al salón. Rodea el extremo de la barra junto a caja y firma desde el lado del personal.'}
];
const extras=[
  {name:'Mesa de atención',x:-4.45,z:3.38,y:1.03},
  {name:'Vitrina de repostería',x:-1.73,z:-1.45,y:1.58},
  {name:'Molinillo',x:-3.36,z:-1.8,y:1.9}
];
const interactivos=[...stations,...extras];
const world=(()=>{
  let acciones;
  const $=id=>document.getElementById(id),T=THREE;
  let canvas=$('scene'),renderer,room,cam,scene;
  try{renderer=new T.WebGLRenderer({canvas,antialias:true});}catch{
    const fresh=canvas.cloneNode();canvas.replaceWith(fresh);canvas=fresh;
  }
  const entities=new Map(),state={x:-2.65,y:1.62,z:1.44,yaw:-.4},keys=new Set();
  let pitch=.04,vertical=0,live=false,paused=true,goal=0,near=-1,last=0,dirty=true,drag=null;
  const rear=new T.Vector3(),target=new T.Vector3();
  function mark(){dirty=true;}
  if(renderer){
    renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    scene=new T.Scene();scene.background=new T.Color(0xb8bcab);cam=new T.PerspectiveCamera(68,1,.06,80);
    scene.add(new T.HemisphereLight(0xffecd4,0xac9b84,1.6));
    const sun=new T.DirectionalLight(0xffdfae,2.7);sun.position.set(-4,9,8);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-13,right:13,top:10,bottom:-10});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.02;scene.add(sun);
    room=construirInterior(scene,mark);
    cam.position.set(9,9,14);cam.lookAt(1,1,0);
  }
  const mini=$('map'),obstacles=[...planta.muros,...(room?.solids||planta.plantaLigera)];
  function plan(c,w,h){
    c.fillStyle='#19392f';c.fillRect(0,0,w,h);
    const alto=6.5-planta.fondo,X=x=>(x+6)*w/16,Z=z=>(z-planta.fondo)*h/alto;
    c.fillStyle='#344c3c';c.fillRect(0,0,X(planta.division),Z(planta.frente));
    c.fillStyle='#664e3b';c.fillRect(X(planta.division),0,X(planta.extremo)-X(planta.division),Z(planta.frente));
    c.fillStyle='#0b211b';c.fillRect(X(planta.extremo),0,w-X(planta.extremo),Z(planta.frente));
    c.fillStyle='#58765e';for(const o of obstacles)c.fillRect(X(o.x-o.w/2),Z(o.z-o.d/2),o.w*w/16,o.d*h/alto);
    stations.forEach((s,i)=>{c.fillStyle=i===goal?'#ffc67b':'#c5dbbd';c.font='bold '+Math.max(12,w*.068)+'px sans-serif';c.fillText(i+1,X(s.x)-3,Z(s.z)+4);});
    for(const {data} of entities.values()){c.beginPath();c.arc(X(data.x),Z(data.z),3,0,7);c.fillStyle='#86cee2';c.fill();}
    c.save();c.translate(X(state.x),Z(state.z));c.rotate(state.yaw);c.fillStyle='white';c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(-5,6);c.fill();c.restore();
  }
  function avatar(p){
    const group=new T.Group();
    function part(w,h,d,color,x,y,z){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color}));m.position.set(x,y,z);group.add(m);}
    const uniform=p.avatar==='Mujer'?0xae705b:0x467d74;
    for(const x of [-.115,.115])part(.18,.71,.23,0x38483c,x,.36,0);
    part(.46,.6,.25,uniform,0,.99,0);part(.36,.43,.035,0xceb584,0,.94,-.14);
    for(const x of [-.29,.29])part(.13,.49,.15,uniform,x,1.01,0);
    part(.34,.38,.32,0xd5a57c,0,1.50,0);part(.36,.13,.34,0x47352c,0,1.70,0);
    if(p.avatar==='Mujer')part(.34,.32,.13,0x47352c,0,1.49,.14);
    for(const x of [-.08,.08])part(.035,.035,.014,0x393830,x,1.53,-.166);
    const c=document.createElement('canvas');c.width=384;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#19392f';ctx.fillRect(0,0,384,64);ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.textAlign='center';ctx.fillText(p.name,192,43,368);
    const badge=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c)}));badge.position.y=1.97;badge.scale.set(1.2,.2,1);group.add(badge);scene.add(group);return group;
  }
  function peers(players,id){
    const present=new Set();
    for(const p of players){if(p.id===id)continue;present.add(p.id);
      let e=entities.get(p.id);if(!e){e={mesh:renderer?avatar(p):null};entities.set(p.id,e);}
      if(!e.data||e.data.x!==p.x||e.data.y!==p.y||e.data.z!==p.z||e.data.yaw!==p.yaw)mark();e.data=p;
      if(e.mesh){e.mesh.position.set(p.x,p.y-1.62,p.z);e.mesh.rotation.y=-p.yaw;}
    }
    for(const [key,e] of entities)if(!present.has(key)){if(e.mesh){scene.remove(e.mesh);e.mesh.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});}entities.delete(key);mark();}
  }
  function resize(){const w=innerWidth,h=innerHeight;if(renderer){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}else{canvas.width=w;canvas.height=h;}mark();}
  function allowed(x,z){return x>-5.7&&x<9.65&&z>planta.fondo+.25&&z<6.19&&(z>=planta.frente||x<planta.extremo-.23)&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.17&&Math.abs(z-o.z)<o.d/2+.17);}
  function frame(t){
    requestAnimationFrame(frame);const dt=Math.min(.09,(t-last)/1000);last=t;
    if(live&&!paused){
      const front=+keys.has('KeyW')+ +keys.has('ArrowUp')- +keys.has('KeyS')- +keys.has('ArrowDown'),side=+keys.has('KeyD')- +keys.has('KeyA');
      state.yaw+=(+keys.has('ArrowRight')- +keys.has('ArrowLeft'))*dt*1.8;
      const speed=(keys.has('ShiftLeft')?4:2.65)*dt/Math.max(1,Math.hypot(side,front));
      const x=state.x+(front*Math.sin(state.yaw)+side*Math.cos(state.yaw))*speed,z=state.z+(-front*Math.cos(state.yaw)+side*Math.sin(state.yaw))*speed;
      if(allowed(x,state.z))state.x=x;if(allowed(state.x,z))state.z=z;
      if(vertical||state.y>1.62){state.y=Math.max(1.62,state.y+vertical*dt);vertical=state.y<=1.62?0:vertical-dt*10;mark();}
      if(keys.size)mark();
    }
    if(!dirty)return;dirty=false;
    if(live){
      near=-1;let best=Infinity;
      for(const [i,s] of interactivos.entries()){
        if(planta.cortaMuro(state,s)||planta.zona(state.x,state.z)!==planta.zona(s.x,s.z))continue;
        if(i===4&&state.z> -2.63)continue;
        const dx=s.x-state.x,dz=s.z-state.z,d=Math.hypot(dx,dz);const dot=(dx*Math.sin(state.yaw)-dz*Math.cos(state.yaw))/Math.max(.01,d),score=(1-dot)*4+d*.20;if(d<2.85&&dot>.78&&(i===goal||score<best)){best=i===goal?-Infinity:score;near=i;}}
      let hint='M · Equipo y controles';
      let next=stations[goal];
      if(next){
        const here=planta.zona(state.x,state.z),there=planta.zona(next.x,next.z);
        if(here!==there){
          next=planta.siguientePuerta(here,there);
        }else if(goal===4&&state.z>=-2.63){
          next={name:'Paso detrás de caja',x:.55,z:-2.83,y:1.7};
        }
        const s=next,dx=s.x-state.x,dz=s.z-state.z,a=Math.atan2(dx,-dz)-state.yaw;const arrow=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(a/(Math.PI/4))%8+8)%8];hint=arrow+'  '+s.name+' · '+Math.hypot(dx,dz).toFixed(1)+' m';}
      $('bearing').textContent=planta.zona(state.x,state.z)+'  ·  '+hint;
      $('hint').textContent=near>=0?'E · Usar '+interactivos[near].name:'Acércate al puesto marcado';
      plan(mini.getContext('2d'),mini.width,mini.height);
      if(renderer){cam.position.set(state.x,state.y,state.z);target.set(state.x+Math.sin(state.yaw)*Math.cos(pitch),state.y+Math.sin(pitch),state.z-Math.cos(state.yaw)*Math.cos(pitch));cam.lookAt(target);cam.updateMatrixWorld();
        const pin=$('marker'),s=next;pin.hidden=true;
        if(s&&!planta.cortaMuro(state,s)){rear.set(s.x,s.y+.42,s.z).project(cam);if(rear.z>0&&rear.z<1&&Math.abs(rear.x)<.91&&Math.abs(rear.y)<.76){pin.hidden=false;pin.style.left=(50+rear.x*50)+'%';pin.style.top=(50-rear.y*50)+'%';pin.textContent=(goal+1)+' · '+s.name;}}
      }
    }
    if(renderer)renderer.render(scene,cam);else plan(canvas.getContext('2d'),canvas.width,canvas.height);
  }
  function lock(){canvas.focus();try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}}
  function pause(value){paused=value;keys.clear();drag=null;if(value){if(document.pointerLockElement)document.exitPointerLock();}else lock();mark();}
  function look(dx,dy){state.yaw+=dx*.003;pitch=Math.max(-1.2,Math.min(1.2,pitch-dy*.003));mark();}
  document.addEventListener('mousemove',e=>{if(!paused&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
  canvas.onpointerdown=e=>{if(!paused){drag=[e.clientX,e.clientY];lock();canvas.setPointerCapture(e.pointerId);}};
  canvas.onpointermove=e=>{if(drag&&!paused&&!document.pointerLockElement){look(e.clientX-drag[0],e.clientY-drag[1]);drag=[e.clientX,e.clientY];}};canvas.onpointerup=()=>drag=null;
  window.addEventListener('keydown',e=>{if(!live||paused)return;if(['Space','ArrowUp','ArrowDown','ArrowRight','ArrowLeft','Tab'].includes(e.code))e.preventDefault();
    keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE'&&near>=0)acciones.estacion(near);if(e.code==='KeyM')acciones.equipo();if(e.code==='Space'&&state.y<=1.62)vertical=3.7;if(e.code==='KeyF')acciones.pantallaCompleta();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
  return {state,peers,pause,start(controles){acciones=controles;live=true;if(room)room.inside.visible=true;pause(false);},goal(n){goal=n;mark();},screen(lines){room?.display(lines,'#ffc77d');mark();}};
})();
