(() => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const button = document.querySelector('.motion-control');
  const hero = document.querySelector('.hero');
  const aircraft = document.querySelector('.aircraft');
  const sideView = document.querySelector('.side-view');
  const bankView = document.querySelector('.bank-view');
  const bellyView = document.querySelector('.belly-view');
  const departureView = document.querySelector('.departure-view');
  const bay = document.querySelector('.payload-bay');
  const farDoor = document.querySelector('.door-far');
  const nearDoor = document.querySelector('.door-near');
  const door = { angle:0, velocity:0 };
  const operateDoors = (progress,dt) => {
    const target = progress>.23 && progress<.466 ? 85 : 0;
    const steps = Math.max(1,Math.ceil(dt/.008));
    const step = dt/steps;
    for(let i=0;i<steps;i++) {
      // Critically damped rotary actuator, with closed/open mechanical stops.
      door.velocity += (36*(target-door.angle)-12*door.velocity)*step;
      door.angle = Math.max(0,Math.min(85,door.angle+door.velocity*step));
    }
    farDoor.style.transform = `rotateX(${-door.angle}deg)`;
    nearDoor.style.transform = `rotateX(${door.angle}deg)`;
    bay.style.setProperty('--bay-open',String(door.angle/85));
  };
  const updateHeader = () => header?.classList.toggle('at-top', window.scrollY < 40);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  if (!button || !hero || !aircraft) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  let visible = true;
  let frame = 0;
  let lastTime = null;
  let elapsed = 4000;
  let route = [];
  let distance = 0;
  let metersPerPixel = 1;
  let points = [];
  const duration = 24000;
  const cargo = [];
  const releases = [.30,.35,.40,.45];
  let previousProgress = 0;
  const released = new Set();
  const deviceArt = kind => kind === 'HDD'
    ? '<svg viewBox="0 0 44 62" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="40" height="58" rx="4" fill="#202932" stroke="#9bd9ff"/><circle cx="22" cy="24" r="14" fill="#101820" stroke="#849bab"/><circle cx="22" cy="24" r="4" stroke="#b9d4e4"/><path d="m34 39-12-15" stroke="#c5d9e6" stroke-width="3"/><path d="M10 56h24" stroke="#f7d64a" stroke-width="3"/><text x="22" y="49" fill="#b9d4e4" font-size="7" text-anchor="middle" font-family="monospace">HDD</text></svg>'
    : '<svg viewBox="0 0 44 62" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="40" height="58" rx="4" fill="#12191d" stroke="#72db45"/><rect x="8" y="12" width="28" height="31" rx="2" fill="#222d30" stroke="#687e82"/><text x="22" y="31" fill="#bce4a7" font-size="9" text-anchor="middle" font-family="monospace">SSD</text><path d="M10 56h24" stroke="#f7d64a" stroke-width="3"/></svg>';
  const dropDevice = (pose, index) => {
    const kind = index % 2 === 0 ? 'HDD' : 'SSD';
    const element = document.createElement('div');
    element.className = 'cargo '+kind.toLowerCase();
    element.setAttribute('aria-hidden','true');
    element.innerHTML = deviceArt(kind);
    hero.append(element);
    const tangent = Math.hypot(pose.dx,pose.dy);
    const velocity = distance/(duration/1000)*metersPerPixel;
    const opening = bay.getBoundingClientRect();
    const stage = hero.getBoundingClientRect();
    cargo.push({element, x:opening.x+opening.width/2-stage.x, y:opening.bottom-stage.y+element.offsetHeight/2+2,
      vx:pose.dx/tangent*velocity, vy:pose.dy/tangent*velocity,
      angle: index%2 ? -12 : 18, spin: index%2 ? -82 : 56,
      mass:kind==='HDD'?.45:.09, area:kind==='HDD'?.012:.006, age:0});
  };
  const stepCargo = dt => {
    // Quadratic aerodynamic drag plus gravity; released objects inherit flight velocity.
    for (let i=cargo.length-1;i>=0;i--) {
      const item = cargo[i];
      const steps = Math.max(1,Math.ceil(dt/.008));
      const step = dt/steps;
      for (let j=0;j<steps;j++) {
        const speed = Math.hypot(item.vx,item.vy);
        const drag = .5*1.225*1.1*item.area/item.mass;
        item.vx += -drag*speed*item.vx*step;
        item.vy += (9.81-drag*speed*item.vy)*step;
        item.x += item.vx/metersPerPixel*step;
        item.y += item.vy/metersPerPixel*step;
        item.angle += item.spin*step;
        item.spin *= Math.exp(-.12*step);
      }
      item.age += dt;
      item.element.style.transform=`translate3d(${item.x-item.element.offsetWidth/2}px,${item.y-item.element.offsetHeight/2}px,0) rotate(${item.angle}deg)`;
      if (item.y>hero.clientHeight+100 || item.x < -150 || item.x>hero.clientWidth+150 || item.age>30) {
        item.element.remove();cargo.splice(i,1);
      }
    }
  };
  const noseAngle = Math.PI;
  const sample = progress => {
    const w = hero.clientWidth;
    if (progress <= .64) return {x:w*(1.2-1.3*progress),y:points[0].y,dx:-1.3*w,dy:0,ddx:0,ddy:0};
    const t = (progress-.64)/.36;
    const u = 1 - t;
    const [a, b, c, d] = points;
    return {
      x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,
      y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y,
      dx: (3*u*u*(b.x-a.x) + 6*u*t*(c.x-b.x) + 3*t*t*(d.x-c.x))/.36,
      dy: (3*u*u*(b.y-a.y) + 6*u*t*(c.y-b.y) + 3*t*t*(d.y-c.y))/.36,
      ddx: (6*u*(c.x-2*b.x+a.x) + 6*t*(d.x-2*c.x+b.x))/(.36*.36),
      ddy: (6*u*(c.y-2*b.y+a.y) + 6*t*(d.y-2*c.y+b.y))/(.36*.36)
    };
  };
  const buildRoute = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const mobile = w <= 760;
    const coordinates = mobile
      ? [[.368,.63],[.212,.63],[.05,.63],[-.3,.42]]
      : [[.368,.28],[.212,.28],[.05,.28],[-.3,-.10]];
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
    // Clean camera cuts keep one solid airframe visible; never morph two silhouettes.
    const view = progress<.23 ? sideView : progress<.54 ? bellyView : progress<.78 ? bankView : departureView;
    for (const candidate of [sideView,bellyView,bankView,departureView]) {
      candidate.style.opacity = candidate===view ? '1' : '0';
    }
    return pose;
  };
  const tick = time => {
    if (paused || !visible || document.hidden) { frame=0;lastTime=null;return; }
    const dt = lastTime === null ? 0 : Math.min(time-lastTime,100)/1000;
    elapsed += dt*1000;
    lastTime=time;
    const progress = (elapsed%duration)/duration;
    if (progress < previousProgress) { previousProgress = 0;released.clear(); }
    operateDoors(progress,dt);
    const pose = paint(progress);
    releases.forEach((release,index) => {
      if (!released.has(index) && progress>=release && progress<.466 && door.angle>=70) {
        dropDevice(pose,index);released.add(index);
      }
    });
    previousProgress = progress;
    stepCargo(dt);
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
