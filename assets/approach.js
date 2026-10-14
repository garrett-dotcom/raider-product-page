// Three independent, rigid B21 fly-throughs across a scanning radar.
(() => {
  const svg=document.querySelector('.approach-flight');
  if(!svg)return;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const elevation=Math.PI/4, projection=Math.sin(elevation), tau=2*Math.PI;
  const routes=[
    {points:[[-110,145],[110,110],[460,305],[710,380]],duration:18,gap:7,phase:2},
    {points:[[710,105],[480,120],[240,455],[-110,465]],duration:21,gap:6,phase:8},
    {points:[[125,710],[125,440],[445,210],[455,-110]],duration:19,gap:9,phase:13}
  ];
  const sample=(points,t)=>{
    const u=1-t,[a,b,c,d]=points;
    const axis=i=>({p:u*u*u*a[i]+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i],
      v:3*u*u*(b[i]-a[i])+6*u*t*(c[i]-b[i])+3*t*t*(d[i]-c[i]),
      a:6*u*(c[i]-2*b[i]+a[i])+6*t*(d[i]-2*c[i]+b[i])});
    const x=axis(0),y=axis(1);
    return {x:x.p,y:y.p,dx:x.v,dz:-y.v/projection,ddx:x.a,ddz:-y.a/projection};
  };
  const flights=[...svg.parentElement.querySelectorAll('.approach-airframe')].map((group,index)=>{
    const route=routes[index],table=[{t:0,length:0}];let length=0,prev=sample(route.points,0);
    for(let i=1;i<=300;i++){const next=sample(route.points,i/300);length+=Math.hypot(next.x-prev.x,(next.y-prev.y)/projection);table.push({t:i/300,length});prev=next;}
    const camera={heading:0,elevation,projection:.48};
    return {...route,group,table,length,camera,position:null,render:window.createRaiderAircraft(group.querySelector('canvas'),camera)};
  });
  const positions=[[94,192],[160,104],[248,83],[372,92],[454,140],[506,219],[524,334],[463,409],[396,477],[285,522],[185,490],[108,399],[75,304],[173,225],[389,206],[427,342],[215,411],[335,425],[256,166],[156,341]];
  const ns='http://www.w3.org/2000/svg';
  const contacts=positions.map(([x,y],i)=>{
    const group=document.createElementNS(ns,'g'),dot=document.createElementNS(ns,'circle'),ring=document.createElementNS(ns,'circle');
    const color=i%5===0?'#f7d64a':i%3===0?'#9bd9ff':'#72db45';
    group.setAttribute('transform',`translate(${x} ${y})`);group.setAttribute('class','radar-contact');
    dot.setAttribute('r','2.4');dot.setAttribute('fill',color);ring.setAttribute('fill','none');ring.setAttribute('stroke',color);ring.setAttribute('stroke-width','1');group.append(ring,dot);svg.querySelector('.radar-contacts').append(group);
    return {x,y,angle:(Math.atan2(y-300,x-300)+tau)%tau,lastHit:-10,group,ring,dot};
  });
  const sweep=svg.querySelector('.radar-scan');
  let visible=false,elapsed=0,lastTime=null,frame=0,previousSweep=0;
  const paused=()=>preference.matches||!visible||document.hidden||document.documentElement.classList.contains('motion-paused');
  const paint=()=>{
    flights.forEach(flight=>{
      const time=(elapsed+flight.phase)%(flight.duration+flight.gap);
      if(time>=flight.duration){flight.group.style.visibility='hidden';flight.position=null;return;}
      const target=time/flight.duration*flight.length;
      const index=Math.max(1,flight.table.findIndex(p=>p.length>=target));
      const before=flight.table[index-1],after=flight.table[index];
      const t=before.t+(after.t-before.t)*(target-before.length)/(after.length-before.length);
      const pose=sample(flight.points,t),v=Math.hypot(pose.dx,pose.dz);
      const curvature=(pose.dx*pose.ddz-pose.dz*pose.ddx)/(v*v*v);
      const speed=flight.length/flight.duration;
      // Coordinated turn, with shared scene scale: tan(bank)=v²*curvature/g.
      const bank=Math.atan(-speed*speed*.18*curvature/9.81)*180/Math.PI;
      flight.camera.heading=Math.atan2(pose.dz,pose.dx)+Math.PI;
      flight.group.style.visibility='visible';flight.group.style.left=`${pose.x/6}%`;flight.group.style.top=`${pose.y/6}%`;
      flight.group.dataset.position=`${pose.x.toFixed(2)},${pose.y.toFixed(2)}`;flight.group.dataset.bank=bank.toFixed(2);
      flight.position=pose;flight.render(bank,0,128);
    });
    const angle=(elapsed*tau/6)%tau,step=(angle-previousSweep+tau)%tau;
    sweep.setAttribute('transform',`rotate(${angle*180/Math.PI} 300 300)`);
    contacts.forEach(contact=>{
      const crossed=(contact.angle-previousSweep+tau)%tau;
      const near=flights.some(f=>f.position&&Math.hypot(f.position.x-contact.x,f.position.y-contact.y)<65);
      if(crossed<=step&&!near)contact.lastHit=elapsed;
      // Radar returns belong to background contacts, never the stealth aircraft.
      const age=elapsed-contact.lastHit,strength=Math.exp(-age/1.35);
      contact.group.style.opacity=String(near?0:strength);
      contact.ring.setAttribute('r',String(3+Math.min(age,2)*8));contact.ring.style.opacity=String(Math.exp(-age*2));
    });
    previousSweep=angle;
  };
  const tick=now=>{frame=0;if(paused()){lastTime=null;return;}elapsed+=lastTime===null?0:Math.min(.1,(now-lastTime)/1000);lastTime=now;paint();frame=requestAnimationFrame(tick);};
  const sync=()=>{svg.dataset.motion=paused()?'paused':'running';if(paused()){cancelAnimationFrame(frame);frame=0;lastTime=null;}else if(!frame)frame=requestAnimationFrame(tick);};
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:.05}).observe(svg);
  new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  preference.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);paint();sync();
})();
