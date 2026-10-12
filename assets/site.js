(() => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const button = document.querySelector('.motion-control');
  const hero = document.querySelector('.hero');
  const aircraft = document.querySelector('.aircraft');
  const updateHeader = () => header?.classList.toggle('at-top', window.scrollY < 40);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  if (!button || !hero || !aircraft) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  let visible = true;
  let frame = 0;
  let lastTime = null;
  let elapsed = 7000;
  let route = [];
  let distance = 0;
  let metersPerPixel = 1;
  let points = [];
  const duration = 24000;
  const noseAngle = 142 * Math.PI / 180;
  const sample = t => {
    const u = 1 - t;
    const [a, b, c, d] = points;
    return {
      x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y,
      dx: 3*u*u*(b.x-a.x) + 6*u*t*(c.x-b.x) + 3*t*t*(d.x-c.x),
      dy: 3*u*u*(b.y-a.y) + 6*u*t*(c.y-b.y) + 3*t*t*(d.y-c.y),
      ddx: 6*u*(c.x-2*b.x+a.x) + 6*t*(d.x-2*c.x+b.x),
      ddy: 6*u*(c.y-2*b.y+a.y) + 6*t*(d.y-2*c.y+b.y)
    };
  };
  const buildRoute = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const mobile = w <= 760;
    const coordinates = mobile
      ? [[1.25,.55],[.55,.50],[.95,.95],[-.28,.82]]
      : [[1.18,.12],[.98,.85],[.42,.12],[-.15,.94]];
    points = coordinates.map(([x,y]) => ({x:x*w,y:y*h}));
    route = [{t:0,length:0}];
    distance = 0;
    let previous = sample(0);
    let maximumCurvature = 0;
    for (let i=1;i<=200;i++) {
      const next = sample(i/200);
      distance += Math.hypot(next.x-previous.x,next.y-previous.y);
      const tangent = Math.hypot(next.dx,next.dy);
      maximumCurvature = Math.max(maximumCurvature,Math.abs((next.dx*next.ddy-next.dy*next.ddx)/(tangent*tangent*tangent)));
      route.push({t:i/200,length:distance});
      previous = next;
    }
    // Calibrate the scene projection for a level coordinated turn.
    // tan(bank) = speed² * curvature / gravity; maximum bank is 28 degrees.
    const pixelsPerSecond = distance/(duration/1000);
    metersPerPixel = 9.81*Math.tan(28*Math.PI/180)/(pixelsPerSecond*pixelsPerSecond*maximumCurvature);
  };
  const paint = progress => {
    const target = progress * distance;
    let index = route.findIndex(point => point.length >= target);
    index = Math.max(1,index);
    const before = route[index-1];
    const after = route[index];
    const fraction = (target-before.length)/(after.length-before.length);
    const t = before.t + (after.t-before.t)*fraction;
    const pose = sample(t);
    const speed = Math.hypot(pose.dx,pose.dy);
    const curvature = (pose.dx*pose.ddy-pose.dy*pose.ddx)/(speed*speed*speed);
    const heading = Math.atan2(pose.dy,pose.dx)-noseAngle;
    const velocity = distance/(duration/1000)*metersPerPixel;
    const worldCurvature = curvature/metersPerPixel;
    const bank = Math.atan(velocity*velocity*worldCurvature/9.81)*180/Math.PI;
    const x = pose.x-aircraft.offsetWidth/2;
    const y = pose.y-aircraft.offsetHeight/2;
    aircraft.style.transform = `translate3d(${x}px,${y}px,0) rotateZ(${heading*180/Math.PI}deg) rotate3d(${Math.cos(noseAngle)},${Math.sin(noseAngle)},0,${bank}deg)`;
    aircraft.style.opacity = '1';
  };
  const tick = time => {
    if (paused || !visible || document.hidden) { frame=0;lastTime=null;return; }
    if (lastTime !== null) elapsed += Math.min(time-lastTime,100);
    lastTime=time;
    paint((elapsed%duration)/duration);
    frame=requestAnimationFrame(tick);
  };
  const start = () => { if (!paused && visible && !document.hidden && !frame) frame=requestAnimationFrame(tick); };
  const updateMotion = () => {
    root.classList.toggle('motion-paused',paused);
    root.classList.toggle('motion-enabled',!paused);
    button.setAttribute('aria-pressed',String(paused));
    button.setAttribute('aria-label',paused?'Resume animation':'Pause animation');
    button.querySelector('.motion-label').textContent=paused?'Motion off':'Motion on';
    if (paused) { cancelAnimationFrame(frame);frame=0;lastTime=null; }
    else start();
  };
  buildRoute();
  paint((elapsed%duration)/duration);
  updateMotion();
  button.addEventListener('click',() => { paused=!paused;updateMotion(); });
  preference.addEventListener('change',event => { paused=event.matches;updateMotion(); });
  new ResizeObserver(() => { buildRoute();paint((elapsed%duration)/duration); }).observe(hero);
  new IntersectionObserver(entries => { visible=entries[0].isIntersecting;start(); }).observe(hero);
  document.addEventListener('visibilitychange',start);
})();
