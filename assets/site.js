(() => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const button = document.querySelector('.motion-control');
  const hero = document.querySelector('.hero');
  const aircraft = document.querySelector('.aircraft');
  const sideView = document.querySelector('.side-view');
  const bankView = document.querySelector('.bank-view');
  const bay = document.querySelector('.payload-bay');
  const farDoor = document.querySelector('.door-far');
  const nearDoor = document.querySelector('.door-near');
  const door = { angle:0, velocity:0 };
  const phaseHistory = [];
  let lastPhase = '';
  const operateDoors = (progress,dt) => {
    const target = progress>.23 && progress<.466 ? 85 : 0;
    const steps = Math.max(1,Math.ceil(dt/.008));
    const step = dt/steps;
    for(let i=0;i<steps;i++) {
      // Critically damped rotary actuator, with closed/open mechanical stops.
      const frequency = target===0 ? 6 : 4;
      door.velocity += (frequency*frequency*(target-door.angle)-2*frequency*door.velocity)*step;
      door.angle = Math.max(0,Math.min(85,door.angle+door.velocity*step));
    }
    if (target===0 && door.angle<1) { door.angle=0;door.velocity=0; }
    farDoor.style.transform = `rotateX(${90+door.angle}deg)`;
    nearDoor.style.transform = `rotateX(${90-door.angle}deg)`;
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
    cargo.push({element, x:opening.x+opening.width/2-stage.x, y:Math.max(opening.bottom,farDoor.getBoundingClientRect().bottom,nearDoor.getBoundingClientRect().bottom)-stage.y+element.offsetHeight/2+2,
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
    if (progress <= .68) return {x:w*(1.2-1.3*progress),y:points[0].y,dx:-1.3*w,dy:0,ddx:0,ddy:0};
    const t = (progress-.68)/.32;
    const start = points[0];
    const end = points[3];
    const lead = -1.3*w*.32;
    const bend = end.x-start.x-lead;
    const rise = end.y-start.y;
    // A fourth-order turn has zero curvature and zero roll rate at entry.
    // It joins the level approach without a sudden roll or acceleration change.
    return {
      x:start.x+lead*t+bend*t*t*t*t,
      y:start.y+rise*t*t*t*t,
      dx:(lead+4*bend*t*t*t)/.32,
      dy:4*rise*t*t*t/.32,
      ddx:12*bend*t*t/(.32*.32),
      ddy:12*rise*t*t/(.32*.32)
    };
  };
  const buildRoute = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const mobile = w <= 760;
    const coordinates = mobile
      ? [[.316,.63],[.177333,.63],[.02,.63],[-.3,.42]]
      : [[.316,.28],[.177333,.28],[.02,.28],[-.3,-.10]];
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
    // One persistent fuselage and one wing surface: no frame/image swaps.
    // The profile covers the wing root; the same wing gradually projects into view as it rolls.
    sideView.style.opacity = '1';
    bankView.style.opacity = '1';
    bankView.style.transform = `translateY(-50%) scaleY(${Math.tan(Math.abs(bank)*Math.PI/180)}) rotate(38deg)`;
    const phase = progress<.23 ? 'approach' : progress<.466
      ? door.angle<70 ? 'opening' : 'release'
      : door.angle>=1 ? 'closing' : Math.abs(bank)>1 ? 'bank' : 'level-exit';
    aircraft.dataset.flightPhase = phase;
    if (phase!==lastPhase) {
      phaseHistory.push({phase,doorAngle:Math.round(door.angle*100)/100,bankAngle:Math.round(bank*100)/100,released:released.size});
      if (phaseHistory.length>12) phaseHistory.shift();
      aircraft.dataset.phaseHistory=JSON.stringify(phaseHistory);
      lastPhase=phase;
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
