// Orthographic projection of a fixed, closed flying-wing mesh. No sprite scaling.
window.createRaiderAircraft = canvas => {
  const ctx = canvas.getContext('2d');
  const faces=[];
  const outline = z => ({front:-.66+Math.abs(z)*.79,back:.57-.60*Math.min(Math.abs(z),.5)+.255*Math.max(0,Math.abs(z)-.5)});
  const surface=(z,u,bottom=false)=>{
    const edge=outline(z),x=edge.front+(edge.back-edge.front)*u;
    const taper=Math.pow(Math.max(0,1-Math.abs(z)/1.5),1.5);
    const thickness=Math.sin(Math.PI*u)*(.012+.095*taper);
    return [x,bottom ? -.012-thickness*.43 : thickness,z];
  };
  for(let j=0;j<60;j++) for(let i=0;i<24;i++) for(const bottom of [false,true]) {
    const z=-1.5+j*.05,u=i/24;
    const a=surface(z,u,bottom),b=surface(z+.05,u,bottom),c=surface(z+.05,u+1/24,bottom),d=surface(z,u+1/24,bottom);
    faces.push({points:bottom?[d,c,b,a]:[a,b,c,d],color:bottom?[115,128,139]:[183,194,202]});
  }
  const cockpit=[[-.51,.064,-.047],[-.37,.099,-.066],[-.29,.099,-.065],[-.39,.089,-.009]];
  faces.push({points:cockpit,color:[35,48,57]},{points:cockpit.map(([x,y,z])=>[x,y,-z]).reverse(),color:[40,55,65]});
  for(const sign of [-1,1]) {
    faces.push({points:[[-.27,.09,sign*.17],[-.12,.097,sign*.24],[.015,.09,sign*.25],[-.07,.097,sign*.12]],color:[45,55,61]});
    faces.push({points:[[.42,.021,sign*.15],[.52,.012,sign*.17],[.52,.013,sign*.34],[.40,.026,sign*.29]],color:[61,72,79]});
  }
  let width=0,ratio=0;
  const project=(p,roll)=>{
    const c=Math.cos(roll),s=Math.sin(roll);
    const y=p[1]*c-p[2]*s,z=p[1]*s+p[2]*c;
    return [p[0],-y,z];
  };
  const shade=face=>{
    const [a,b,c]=face.points;
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l=Math.hypot(...n)||1;n=n.map(v=>v/l);
    // Broad, fixed sky light keeps adjacent panels smoothly lit.
    return .64+.36*Math.max(0,n[1]*.93-n[0]*.25+n[2]*.16);
  };
  return (bank,doorAngle,size)=>{
    const dpr=Math.min(devicePixelRatio||1,2);
    if(width!==size||ratio!==dpr){width=size;ratio=dpr;canvas.width=Math.ceil(size*2*dpr);canvas.height=Math.ceil(size*2*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size*2,size*2);
    const roll=bank*Math.PI/180,scale=size/1.45;
    const doors=[-1,1].map(sign=>{
      const z=sign*.065,angle=doorAngle*Math.PI/180;
      return {points:[[-.18,-.061,z],[.14,-.061,z],[.14,-.061-.075*Math.sin(angle),z-sign*.075*Math.cos(angle)],[-.18,-.061-.075*Math.sin(angle),z-sign*.075*Math.cos(angle)]],color:sign<0?[156,170,180]:[184,194,200]};
    });
    const ordered=[...faces,...doors].map(face=>({face,p:face.points.map(v=>project(v,roll))})).sort((a,b)=>a.p.reduce((s,p)=>s+p[2],0)/a.p.length-b.p.reduce((s,p)=>s+p[2],0)/b.p.length);
    for(const {face,p} of ordered){
      ctx.beginPath();p.forEach(([x,y],i)=>{const px=size+x*scale,py=size+y*scale;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.closePath();
      const light=shade(face);ctx.fillStyle=`rgb(${face.color.map(c=>Math.round(c*light)).join(',')})`;ctx.fill();
      // Cover subpixel seams without outlining the mesh.
      ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.35;ctx.stroke();
    }
  };
};
