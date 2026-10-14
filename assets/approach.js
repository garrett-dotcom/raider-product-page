// Noctis's phased orbital composition, adapted to coordinated 3D B21 turns.
(() => {
  const svg = document.querySelector('.approach-flight');
  if (!svg) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const elevation = Math.PI/4;
  const flights = [...svg.parentElement.querySelectorAll('.approach-airframe')].map((group,index) => {
    const radius = [112,164,216][index], period = [18,26,34][index];
    const speed = 2*Math.PI*radius/period;
    // Shared world scale: tan(bank) = speed² / (radius * gravity).
    const bank = Math.atan(speed*speed*.32/(radius*9.81))*180/Math.PI;
    const camera = {heading:0,elevation,projection:.48};
    return {group,radius,period,phase:[3,12,24][index],bank,camera,
      render:window.createRaiderAircraft(group.querySelector('canvas'),camera)};
  });
  let visible=false, elapsed=0, lastTime=null, frame=0;
  const paused = () => preference.matches || !visible || document.hidden ||
    document.documentElement.classList.contains('motion-paused');
  const paint = () => flights.forEach(flight => {
    const angle = 2*Math.PI*(elapsed+flight.phase)/flight.period;
    const x=300+flight.radius*Math.cos(angle);
    const y=300+flight.radius*Math.sin(angle)*Math.sin(elevation);
    // Nose is the negative local X axis. Camera sees a real yaw + roll,
    // never a stretched sprite or an image swap.
    flight.camera.heading=Math.atan2(-Math.cos(angle),-Math.sin(angle))+Math.PI;
    flight.group.style.left=`${x/6}%`;
    flight.group.style.top=`${y/6}%`;
    flight.group.dataset.position=`${x.toFixed(2)},${y.toFixed(2)}`;
    flight.render(flight.bank,0,128);
    flight.group.dataset.bank=flight.bank.toFixed(2);
    flight.group.dataset.heading=flight.camera.heading.toFixed(4);
  });
  const tick = now => {
    frame=0;
    if (paused()) {lastTime=null;return;}
    elapsed+=lastTime===null?0:Math.min(.1,(now-lastTime)/1000);
    lastTime=now;paint();frame=requestAnimationFrame(tick);
  };
  const syncMotion = () => {
    svg.dataset.motion=paused()?'paused':'running';
    if(paused()){cancelAnimationFrame(frame);frame=0;lastTime=null;}
    else if(!frame)frame=requestAnimationFrame(tick);
  };
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;syncMotion();},{threshold:.05}).observe(svg);
  new MutationObserver(syncMotion).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  preference.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  paint();syncMotion();
})();
