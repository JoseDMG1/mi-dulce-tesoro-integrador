// Planta en metros. Acceso de servicio en serie: salón, cocina y almacén.
const planta = (() => {
  const frente=-4.5, fondo=-9.3, division=-.60, extremo=4.80;
  const cocinaX=1.45; // A continuación del borde derecho de la carta (x=.455).
  const cocina={x:cocinaX,z:frente,y:2.25,lateral:false,desde:'Salón',hasta:'Cocina'};
  const almacen={x:division,z:-6.28,y:2.25,lateral:true,desde:'Cocina',hasta:'Almacén'};
  const puertas=[cocina,almacen],muros=[];
  function horizontal(a,b){muros.push({x:(a+b)/2,z:frente,w:b-a,d:.14});}
  function vertical(x,a,b){muros.push({x,z:(a+b)/2,w:.14,d:b-a});}
  horizontal(-6,cocina.x-.85);horizontal(cocina.x+.85,9.95);
  vertical(division,fondo,almacen.z-.85);vertical(division,almacen.z+.85,frente);
  vertical(-6,fondo,frente);vertical(extremo,fondo,frente);
  muros.push({x:(extremo-6)/2,z:fondo,w:extremo+6,d:.14});
  function zona(x,z){return z>=frente?'Salón':x<division?'Almacén':'Cocina';}
  function siguientePuerta(desde,hasta){
    const p=desde==='Salón'||(desde==='Cocina'&&hasta==='Salón')?cocina:almacen;
    const entrada=desde===p.desde,delta=entrada?-.32:.32;
    const destino=entrada?p.hasta:p.desde;
    const nombres={Cocina:'Puerta de la cocina',Almacén:'Puerta del almacén',Salón:'Salida al salón'};
    return {...p,x:p.x+(p.lateral?delta:0),z:p.z+(p.lateral?0:delta),name:nombres[destino]};
  }
  function cortaMuro(a,b){
    return muros.some(m=>{
      let lo=0,hi=1;
      for(const [axis,width] of [['x',m.w],['z',m.d]]){
        const delta=b[axis]-a[axis],left=m[axis]-width/2-a[axis],right=left+width;
        if(Math.abs(delta)<1e-7){if(left>0||right<0)return false;continue;}
        const t=left/delta,u=right/delta;
        lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));
      }
      return lo<=hi;
    });
  }
  const mesasNuevas=[[-1.85,4.95],[2.05,4.65],[6.95,-.85]];
  const plantaLigera=[
    [-2.85,-1.74,4.55,1.46],[-.30,-1.76,.77,1.49],[-3.3,-8.53,3.7,1.07],
    [-1.73,-5.14,1.6,.88],[-4.54,-5.14,1.6,.88],[2.16,-8.60,3.62,1.04],
    [-4.45,3.38,1.04,1.04],[-5.24,3.48,.54,.54],[-4.43,4.25,.54,.54],
    ...mesasNuevas.flatMap(([x,z])=>[[x,z,1.04,1.04],[x,z-.81,.48,.47],[x,z+.81,.48,.47]])
  ].map(([x,z,w,d])=>({x,z,w,d}));
  return {frente,fondo,division,extremo,puertas,muros,zona,siguientePuerta,cortaMuro,mesasNuevas,plantaLigera};
})();
