// One level B21 pass across a scanning radar.
(() => {
  const svg=document.querySelector('.approach-flight');
  if(!svg)return;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const elevation=Math.PI/4, projection=Math.sin(elevation), tau=2*Math.PI;
  const group=svg.parentElement.querySelector('.approach-airframe');
  const section=svg.closest('.approach');
  section.append(group);
  // A shallow coordinated turn across the full section, with heading tangent to the path.
  const camera={heading:Math.PI,elevation,projection:.48};
  const flight={group,position:null,render:window.createRaiderAircraft(group.querySelector('canvas'),camera)};
  const flights=[flight];
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
    const rect=section.getBoundingClientRect(),radar=svg.getBoundingClientRect();
    const duration=innerWidth<761?7:12,time=elapsed%(duration+2),u=Math.min(time/duration,1);
    const size=Math.min(120,radar.width*.213333),distance=rect.width+size*2;
    const x=-size+distance*u,amplitude=Math.min(55,rect.width*.035);
    const y=radar.top-rect.top+radar.height/2+amplitude*(4*(u-.5)*(u-.5)-1);
    const slope=8*amplitude*(u-.5)/distance;
    const curvature=-(8*amplitude/distance**2)/projection/(1+(slope/projection)**2)**1.5;
    const bank=Math.atan(-((distance/duration)**2)*.25*curvature/9.81)*180/Math.PI;
    camera.heading=Math.atan2(-slope/projection,1)+Math.PI;
    flight.position=time<duration?{x:(x+rect.left-radar.left)/radar.width*600,y:(y+rect.top-radar.top)/radar.height*600}:null;
    group.style.visibility=time<duration?'visible':'hidden';
    group.style.width=`${size}px`;group.style.height=`${size}px`;
    group.style.left=`${x}px`;group.style.top=`${y}px`;
    group.dataset.position=`${x.toFixed(2)},${y.toFixed(2)}`;group.dataset.bank=bank.toFixed(2);
    flight.render(bank,0,128);
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
