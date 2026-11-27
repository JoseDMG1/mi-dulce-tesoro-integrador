// Modelo local en metros. Las piezas repetidas comparten geometría y material.
function construirInterior(scene,onLoad) {
  const T=THREE, solids=[], batches=new Map(), mats=new Map();
  const cube=new T.BoxGeometry(1,1,1), cylinder=new T.CylinderGeometry(.5,.5,1,28);
  const ball=new T.SphereGeometry(.5,16,12), shade=new T.CylinderGeometry(.16,.50,1,32);
  const ring=new T.TorusGeometry(.40,.085,9,20);
  const leaf=new T.BufferGeometry(),verts=[],faces=[];
  for(let k=0;k<=10;k++){
    const t=k/10,width=.5*Math.sin(t*Math.PI)**.78;
    verts.push(-width,t-.5,.18*t*t,0,t-.5,.14*Math.sin(t*Math.PI)+.18*t*t,width,t-.5,.18*t*t);
    if(k<10){const n=k*3;faces.push(n,n+1,n+3,n+3,n+1,n+4,n+1,n+2,n+4,n+4,n+2,n+5);}
  }
  leaf.setAttribute('position',new T.Float32BufferAttribute(verts,3));leaf.setIndex(faces);leaf.computeVertexNormals();
  let seed=42;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function texture(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
  }
  function material(color){
    if(typeof color!=='string')return color;
    if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.73}));
    return mats.get(color);
  }
  let origenX=0,origenZ=0;
  function origen(x,z){origenX=x;origenZ=z;}
  function mesh(g,x,y,z,w,h,d,color,rx=0,ry=0,rz=0){
    const m=material(color),key=g.uuid+m.uuid;
    if(g===leaf)m.side=T.DoubleSide;
    if(!batches.has(key))batches.set(key,{g,m,parts:[]});
    const obj=new T.Object3D();obj.position.set(x+origenX,y,z+origenZ);obj.scale.set(w,h,d);obj.rotation.set(rx,ry,rz);obj.updateMatrix();batches.get(key).parts.push(obj.matrix);
  }
  const box=(...p)=>mesh(cube,...p), cyl=(...p)=>mesh(cylinder,...p), sphere=(...p)=>mesh(ball,...p);
  const metal=new T.MeshStandardMaterial({color:0x9eaaa3,metalness:.68,roughness:.34});
  const brass=new T.MeshStandardMaterial({color:0xc09456,metalness:.56,roughness:.32});
  const loader=new T.TextureLoader();
  function photo(name,color=true,repeat=1){
    const tex=loader.load(materialesLocales[name],onLoad);tex.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(repeat,repeat);tex.anisotropy=4;return tex;
  }
  const wood=new T.MeshStandardMaterial({map:photo('wood'),roughness:.54});
  const terra=new T.MeshStandardMaterial({map:photo('tiles',true,3),normalMap:photo('tileNormal',false,3),normalScale:new T.Vector2(.46,.46),roughness:.76,color:0xf5eee1});
  const plaster=new T.MeshStandardMaterial({map:photo('plaster',true,2),color:0xf3e7d1,roughness:.96});
  const park=photo('park');park.mapping=T.EquirectangularReflectionMapping;scene.environment=park;
  const green='#215844',dark='#233c33',clay='#ac553d',bone='#f0dec0';
  function sign(x,y,z,w,h,bg,lines,rotation=0) {
    const tex=texture(768,Math.max(90,Math.round(768*h/w)),(c,W,H)=>{
      c.fillStyle=bg;c.fillRect(0,0,W,H);
      lines.forEach(([str,size,pos,col='#fff0cb',font='Georgia'])=>{
        c.fillStyle=col;c.textAlign='center';c.textBaseline='middle';c.font=size+'px '+font;c.fillText(str,W/2,H*pos,W*.95);
      });
    });
    const obj=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,roughness:.84}));obj.position.set(x+origenX,y,z+origenZ);obj.rotation.y=rotation;scene.add(obj);
  }
  function block(x,z,w,d){solids.push({x:x+origenX,z:z+origenZ,w,d});}
  // Plataforma, paredes con zócalo, azulejo artesanal y vitrales.
  box(0,-.23,0,12.45,.38,9.35,wood);box(0,-.045,0,12.12,.09,9.12,terra);
  box(-6,2,0,.18,4,9,plaster);
  box(-5.87,.56,0,.08,1.12,9,green);
  box(-5.83,1.13,0,.1,.065,9,wood);
  for(let z=-3;z<4;z+=2.2){
    box(-5.85,2.49,z,.12,2.14,1.98,wood);
    const tex=photo('park');tex.repeat.set(.074,.27);tex.offset.set(.10+(z+3)*.034,.36);
    const panes=new T.Mesh(new T.PlaneGeometry(1.79,1.95),new T.MeshBasicMaterial({map:tex}));panes.rotation.y=Math.PI/2;panes.position.set(-5.77,2.49,z);scene.add(panes);
    box(-5.73,2.49,z,.07,2,.055,bone);box(-5.72,2.55,z,.06,.06,1.80,bone);box(-5.7,1.43,z,.34,.08,2.05,wood);
  }
  sign(-2.8,2.95,-4.38,4.7,1.25,'#27503f',[['CAFETERÍA  •  TUMBES',36,.23],['Mi Dulce Tesoro',94,.62]]);

  // Barra acanalada, espresso de dos grupos, molino y vitrina de repostería.
  box(-2.85,.60,-1.74,4.48,1.2,1.3,green);block(-2.85,-1.74,4.55,1.46);
  for(let i=0;i<43;i++)box(-5.01+i*.103,.59,-1.077,.052,1.13,.06,'#40725a');
  box(-2.85,.095,-1.009,4.49,.075,.04,brass);box(-2.85,1.24,-1.73,4.66,.13,1.49,wood);

  box(-4.26,1.38,-1.67,1.1,.13,.61,metal);box(-4.26,1.71,-1.9,1.04,.65,.25,clay);
  box(-4.26,1.96,-1.72,1.18,.22,.63,clay);box(-4.26,1.90,-1.38,1.03,.10,.06,metal);
  function cup(x,y,z,s=1){
    cyl(x,y+.075*s,z,.18*s,.15*s,.18*s,bone);cyl(x,y+.151*s,z,.14*s,.004,.14*s,'#513324');
    mesh(ring,x+.096*s,y+.084*s,z,.11*s,.13*s,.12*s,bone);cyl(x,y+.008,z,.24*s,.015,.24*s,bone);
  }
  for(const x of [-4.52,-4.07]){cyl(x,1.80,-1.55,.14,.15,.14,metal);box(x+.10,1.76,-1.49,.24,.036,.045,dark);cup(x,1.45,-1.55,.85);}
  for(let i=0;i<4;i++)cup(-4.62+i*.22,2.07,-1.73,.77);
  box(-3.36,1.52,-1.8,.33,.44,.39,dark);cyl(-3.36,1.90,-1.8,.34,.34,.34,'#624634');cyl(-3.36,2.08,-1.8,.36,.055,.36,dark);
  box(-1.73,1.36,-1.77,1.37,.1,.67,brass);box(-1.73,1.87,-1.77,1.37,.06,.67,wood);
  for(const x of [-2.37,-1.09])for(const z of [-2.06,-1.48])box(x,1.61,z,.04,.52,.04,brass);
  for(let i=0;i<6;i++){
    const x=-2.12+(i%3)*.34,z=-1.88+Math.floor(i/3)*.27;
    for(let k=-2;k<=2;k++){
      const f=1-Math.abs(k)*.19;sphere(x+k*.050,1.44+.018*f,z+.015*k*k,.12*f,.12*f,.17*f,k%2?'#cd8648':'#d99a58');
    }
  }
  const glass=new T.MeshPhysicalMaterial({color:0xc8e4dd,metalness:.1,roughness:.08,transparent:true,opacity:.18,depthWrite:false});
  box(-1.73,1.64,-1.448,1.27,.43,.016,glass);
  for(const x of [-2.37,-1.09])box(x,1.62,-1.76,.012,.45,.58,glass);
  for(const x of [-4.5,-4.1]){
    sphere(x,1.98,-1.39,.105,.105,.035,metal);sphere(x,1.98,-1.37,.078,.078,.016,bone);box(x,1.99,-1.359,.012,.043,.01,dark,0,0,.55);
    cyl(x,2.09,-1.97,.105,.025,.105,metal);
  }
  // Bandejas de filtrado, paños y frascos en la repisa posterior.
  box(-2.95,1.32,-4.02,4.4,.085,.56,wood);
  for(let i=0;i<8;i++){const x=-4.85+i*.43;cyl(x,1.55,-4.03,.25,.38,.25,['#b88c69','#946444','#70533c'][i%3]);cyl(x,1.76,-4.03,.27,.06,.27,brass);}
  sign(-.05,2.37,-4.39,1.01,1.30,'#243d34',[['LA CARTA',88,.17],['Espresso',66,.37],['Cappuccino',61,.53],['Café pasado',60,.69],['Postre del día',58,.85]]);
  origen(-6.5,-4.98);
  sign(2.88,3.13,-4.20,3.45,.43,clay,[['03   ALMACÉN  /  INSUMOS',60,.5]]);
  // Estantería con paquetes de café, latas de cacao y cajas etiquetadas.
  for(const x of [1.45,4.95])for(const z of [-4.00,-3.1])box(x,1.40,z,.085,2.80,.085,dark);
  for(const y of [.27,1.04,1.84,2.68])box(3.20,y,-3.55,3.65,.10,1.02,wood);
  block(3.20,-3.55,3.7,1.07);
  for(let row=0;row<3;row++)for(let j=0;j<6;j++){
    const x=1.77+j*.57,y=[.32,1.09,1.89][row],z=-3.40;
    if(row===0){box(x,y+.25,z,.52,.50,.52,'#bf9366');box(x,y+.252,z+.267,.13,.48,.012,'#d9b785');}
    if(row===1){cyl(x,y+.22,z,.36,.44,.36,'#b27850');cyl(x,y+.45,z,.38,.035,.38,brass);sign(x,y+.22,z+.185,.24,.12,'#e9d3a6',[['CACAO',126,.52,'#593b27']]);}
    if(row===2){box(x,y+.22,z,.39,.44,.24,j%2?green:clay);box(x,y+.46,z,.37,.055,.17,brass);sign(x,y+.23,z+.126,.30,.21,'#eee2c6',[['CAFÉ',145,.45,'#3a4b38'],['TUMBES',52,.77,'#5c654f']]);}
  }
  // Sensor de pared en el extremo izquierdo de la estantería.
  box(1.70,1.56,-2.98,.68,.53,.16,'#eee7d7');box(1.57,1.57,-2.881,.21,.24,.045,'#58a1b1');
  for(let j=0;j<5;j++)box(1.57,1.49+j*.038,-2.854,.16,.012,.01,'#2d636c');
  sign(1.87,1.57,-2.89,.19,.12,'#214b43',[['°C / %',120,.5]]);
  sign(1.71,1.38,-2.89,.52,.09,'#25483d',[['ESP32    /    AMBIENTE',48,.5]]);
  const ledMat=new T.MeshBasicMaterial({color:0x88ffc5});sphere(1.98,1.73,-2.88,.04,.04,.03,ledMat);
  origen(0,0);
  const screenMat=new T.MeshBasicMaterial({color:0xffffff});
  function display(lines,color){
    if(screenMat.map)screenMat.map.dispose();
    screenMat.map=texture(768,398,(c,w,h)=>{
      c.fillStyle='#122e29';c.fillRect(0,0,w,h);c.fillStyle='#86a995';c.font='22px sans-serif';c.fillText('MI DULCE TESORO     /     TERMINAL LOCAL',34,50);
      c.fillStyle=color;c.font='bold 46px sans-serif';c.fillText(lines[0],34,145);c.font='30px sans-serif';c.fillStyle='#f2e7cb';c.fillText(lines[1],34,222);c.fillText(lines[2],34,277,695);
      c.fillStyle='#658877';c.fillRect(34,332,700,2);
    });screenMat.needsUpdate=true;
  }
  display(['Bitácora de turno','Esperando lectura','Puesto 05'],'#b8d7af');
  // Extremo de la barra. La cara emisiva y el teclado miran hacia -Z, al cartel.
  const dx=-.49,dz=-1.76;
  box(-.30,.6,dz,.76,1.2,1.30,green);box(-.30,1.24,dz,.77,.13,1.49,wood);block(-.30,dz,.77,1.49);
  box(dx,1.34,dz,.41,.06,.28,metal);box(dx,1.48,dz,.11,.25,.08,metal);
  box(dx,1.76,dz,.89,.54,.08,dark);
  const screen=new T.Mesh(new T.PlaneGeometry(.83,.47),screenMat);
  screen.rotation.y=Math.PI;screen.position.set(dx,1.76,dz-.042);scene.add(screen);
  box(dx,1.33,dz-.38,.55,.035,.17,'#586257');
  for(let j=0;j<3;j++)for(let k=0;k<11;k++)box(dx-.23+k*.046,1.354,dz-.43+j*.05,.034,.012,.030,'#c8c5b6');
  sign(dx,.84,-.999,.79,.19,'#245342',[['CAJA',94,.50]]);
  // Mobiliario del salón, iluminación y vegetación.
  function stool(x,z){cyl(x,.61,z,.56,.12,.56,wood);for(const a of [0,2.094,4.189])box(x+.18*Math.cos(a),.29,z+.18*Math.sin(a),.055,.58,.055,dark);block(x,z,.54,.54);}
  for(const x of [-4.7,-1.3])stool(x,-.28);
  function table(x,z){cyl(x,.87,z,1.05,.10,1.05,wood);cyl(x,.46,z,.10,.81,.10,brass);cyl(x,.08,z,.55,.09,.55,dark);block(x,z,1.04,1.04);cup(x+.15,.93,z);}
  table(-4.45,3.38);stool(-5.24,3.48);stool(-4.43,4.25);
  function diningChair(x,z,facing){
    for(const a of [-.18,.18])for(const b of [-.17,.17])box(x+a,.23,z+b,.045,.46,.045,wood);
    box(x,.48,z,.48,.095,.46,green);
    for(const a of [-.18,.18])box(x+a,.66,z+facing*.20,.045,.44,.045,wood);
    box(x,.84,z+facing*.20,.46,.18,.045,wood);
    block(x,z,.48,.47);
  }
  for(const [x,z] of planta.mesasNuevas){
    table(x,z);diningChair(x,z-.81,-1);diningChair(x,z+.81,1);
  }
  function plant(x,z,s){
    cyl(x,.30*s,z,.70*s,.60*s,.70*s,clay);cyl(x,.59*s,z,.73*s,.08*s,.73*s,'#ce8460');cyl(x,.64*s,z,.59*s,.03*s,.59*s,'#493c2f');
    for(let i=0;i<22;i++){
      const a=i*2.4,l=(.27+rand()*.42)*s,h=(.33+rand()*.72)*s;
      mesh(leaf,x+Math.sin(a)*l*.54,.61*s+h*.54,z+Math.cos(a)*l*.54,.21*s,h*1.22,.47*s,['#43714b','#598250','#346448','#83955c'][i%4],.48*Math.cos(a),0,-.48*Math.sin(a));
    }block(x,z,.70*s,.70*s);
  }
  plant(-5.12,5.72,1.26);plant(8.91,-3.56,1.37);plant(9.34,5.77,1.08);
  for(const x of [-4.46,-2.90,-1.34]){
    box(x,3.71,-1.73,.022,.66,.022,dark);mesh(shade,x,3.24,-1.73,.62,.31,.62,clay);cyl(x,3.084,-1.73,.56,.02,.56,'#fff1c9');
  }
  sign(-5.83,2.65,-4.12,.56,.76,'#252e28',[['CAFÉ',139,.20],['DE LA',70,.49],['CASA',96,.74]],Math.PI/3);
  // Anexo de recepción y laboratorio ambiental.
  box(7.92,-.045,0,3.96,.09,9.12,terra);
  for(const [x,z,label] of [[-1.73,-5.14,'BANCO DHT11'],[-4.54,-5.14,'RECEPCIÓN']]){
    box(x,.47,z,1.45,.92,.76,green);box(x,.96,z,1.6,.09,.88,wood);block(x,z,1.6,.88);
    const back=-1;
    if(label==='RECEPCIÓN'){
      for(let k=-1;k<=1;k++)box(x+k*.43,1.23,z,.36,.43,.39,'#cf9b64');
    }else{
      box(x,1.24,z,.61,.48,.21,bone);
      for(let k=0;k<5;k++)box(x,1.15+.045*k,z-.12,.23,.025,.025,'#427586');
    }
    sign(x,.66,z+back*.396,1.12,.27,'#234b3b',[[label==='RECEPCIÓN'?'04   RECEPCIÓN':label,65,.50]],back<0?Math.PI:0);
  }
  // Tabiques de altura completa con vanos transitables y dinteles.
  for(const m of planta.muros){
    box(m.x,2,m.z,m.w,4,m.d,plaster);
    box(m.x,.49,m.z,m.w+.025,.98,m.d+.025,'#71917d');
    box(m.x,1.0,m.z,m.w+.035,.045,m.d+.035,wood);
  }
  for(const p of planta.puertas){
    const lateral=p.lateral, rot=lateral?Math.PI/2:0;
    box(p.x,3.18,p.z,lateral?.14:1.7,1.64,lateral?1.7:.14,plaster);
    for(const lado of [-1,1]){
      box(p.x+(lateral?0:lado*.85),1.18,p.z+(lateral?lado*.85:0),lateral?.19:.07,2.36,lateral?.07:.19,wood);
    }
    box(p.x,2.38,p.z,lateral?.21:1.76,.09,lateral?1.76:.21,wood);
    sign(p.x+(lateral?.081:0),2.75,p.z+(lateral?0:.081),1.60,.32,green,[[p.hasta.toUpperCase(),85,.50]],rot);
    sign(p.x-(lateral?.081:0),2.65,p.z-(lateral?0:.081),1.50,.25,green,[[p.desde.toUpperCase(),90,.50]],rot+Math.PI);
  }
  // Ala de servicio detrás de la pared de la carta.
  const anchoServicio=planta.extremo+6,largoServicio=planta.frente-planta.fondo;
  const centroX=(planta.extremo-6)/2,centroZ=(planta.frente+planta.fondo)/2;
  box(centroX,-.045,centroZ,anchoServicio,.09,largoServicio,terra);
  origen(-5.62,-4.77);
  // Línea de cocina con fregadero, grifo, fogones, horno y campana.
  box(7.78,.50,-3.83,3.52,1,.92,'#5f7169');box(7.78,1.04,-3.83,3.62,.10,1.04,metal);block(7.78,-3.83,3.62,1.04);
  box(6.75,1.096,-3.83,.78,.018,.54,'#3e4945');
  box(6.75,1.25,-4.12,.047,.36,.047,metal);box(6.75,1.415,-4.02,.047,.05,.24,metal);
  box(8.62,1.105,-3.80,1.23,.025,.76,'#28322e');
  for(const x of [8.29,8.94])for(const z of [-4.00,-3.62])cyl(x,1.14,z,.29,.035,.29,metal);
  cyl(8.29,1.27,-3.62,.35,.23,.35,clay);box(8.55,1.33,-3.62,.25,.05,.055,dark);
  box(8.6,.53,-3.36,1.08,.59,.035,dark);box(8.6,.56,-3.332,.87,.37,.018,'#56645c');
  box(8.6,.81,-3.30,.82,.043,.055,metal);box(8.63,2.48,-3.86,1.66,.24,1.04,metal);box(8.63,3.12,-4.01,.51,1.08,.43,metal);
  sign(6.85,2.04,-4.39,1.62,.36,'#35634c',[['PREPARACIÓN',78,.50]]);
  origen(0,0);
  // Toldo de lona sobre la barra y remate de madera de la carta.
  for(let j=0;j<21;j++){
    const x=-5.18+j*.24,color=j%2?'#bf7953':'#f2dcb6';
    box(x,3.69,-4.04,.241,.045,.78,color,.16);
    box(x,3.57,-3.665,.241,.13,.045,color);
  }
  for(const x of [-5.26,-.30])box(x,3.54,-4.03,.045,.045,.75,brass);
  // Galería delantera y jardín vertical junto al pasillo del laboratorio.
  box(2,-.055,5.5,16,.10,2.05,terra);
  box(-6,2,5.5,.18,4,2,plaster);
  box(-5.86,.56,5.5,.09,1.12,2,green);
  for(const x of [-4.5,-2.9,-1.3]){

    sphere(x,3.08,-1.73,.19,.13,.19,new T.MeshBasicMaterial({color:0xffdea2}));
  }
  for(const [x,z,labelText] of [[-2.85,-1.014,'01   MOSTRADOR'],[-3.4,-7.995,'03   ALMACÉN']]){
    sign(x,labelText.startsWith('03')?1.83:.77,z,1.4,.27,'#2b4b40',[[labelText,62,.5]]);
  }
  // Jardinera de pared. Mantiene libre la zona donde camina el jugador.
  for(let k=0;k<4;k++){
    const z=-1.8+k*.97;
    box(9.74,1.48,z,.24,.31,.89,wood);
    for(let j=0;j<7;j++)mesh(leaf,9.55,1.73+rand()*.14,z-.33+j*.11,.23,.46+rand()*.25,.34,['#457b4c','#78a365','#527448'][j%3],.28-rand()*.56,1.1,-.65+rand()*.42);
  }
  // Franja esmaltada y flores en las mesas, en terracota y latón.
  for(let k=0;k<31;k++){const x=-5.72+k*.37;if(Math.abs(x-planta.puertas[0].x)<1.06)continue;box(x,1.26,-4.375,.354,.16,.045,k%2?bone:'#b9734f');}
  cyl(-4.65,1.04,3.30,.12,.22,.12,clay);
  for(let j=0;j<5;j++){const x=-4.65+.035*(j-2),h=1.23+j%2*.04;box(x,h-.08,3.30,.012,.19,.012,green);sphere(x,h+.025,3.30,.079,.066,.076,j%2?'#e8ad5b':'#c77758');}
  for(const {g,m,parts} of batches.values()){
    const obj=new T.InstancedMesh(g,m,parts.length);parts.forEach((p,i)=>obj.setMatrixAt(i,p));obj.castShadow=true;obj.receiveShadow=true;scene.add(obj);
  }
  // Sombras suaves de contacto bajo mobiliario y macetas.
  const shadeMap=texture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(32,28,20,.52)');g.addColorStop(.55,'rgba(37,30,22,.35)');g.addColorStop(1,'rgba(40,31,24,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const shadow=new T.MeshBasicMaterial({map:shadeMap,transparent:true,depthWrite:false});
  solids.forEach(o=>{const quad=new T.Mesh(new T.PlaneGeometry(o.w*1.55+.16,o.d*1.7+.15),shadow);quad.rotation.x=-Math.PI/2;quad.position.set(o.x,.009,o.z);scene.add(quad);});
  // Cerramientos que aparecen desde dentro, incluida la puerta de la cafetería.
  const inside=new T.Group();scene.add(inside);
  function wall(x,y,z,w,h,d,c){const o=new T.Mesh(cube,material(c));o.position.set(x,y,z);o.scale.set(w,h,d);inside.add(o);}
  wall(9.95,2,1,.16,4,11,plaster);wall(2,2,6.5,16,4,.14,plaster);wall(2,4.12,1,16,.15,11,'#e4d6bc');
  wall(centroX,4.12,centroZ,anchoServicio,.15,largoServicio,'#e4d6bc');
  for(let x=-5;x<10;x+=2)wall(x,3.98,1,.14,.16,11,wood);
  wall(0,1.18,6.38,1.46,2.36,.14,wood);wall(0,1.63,6.29,1.18,1.13,.045,'#a4c1b5');wall(.53,1.06,6.25,.08,.2,.08,brass);
  inside.visible=false;
  return {solids,inside,display,ledMat};
}
