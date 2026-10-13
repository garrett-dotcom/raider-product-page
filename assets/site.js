(() => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const button = document.querySelector('.motion-control');
  const hero = document.querySelector('.hero');
  const aircraft = document.querySelector('.aircraft');
  const renderAircraft = window.createRaiderAircraft(document.querySelector('.aircraft-model'));
  const bay = document.querySelector('.payload-bay');

  const door = { angle:0, velocity:0 };
  const mobileFlight = () => hero.clientWidth <= 760;
  const releaseEnd = () => mobileFlight() ? .39 : .466;
  const phaseHistory = [];
  let lastPhase = '';
  const operateDoors = (progress,dt) => {
    const target = progress>.23 && progress<releaseEnd() ? 85 : 0;
    const steps = Math.max(1,Math.ceil(dt/.008));
    const step = dt/steps;
    for(let i=0;i<steps;i++) {
      // Critically damped rotary actuator, with closed/open mechanical stops.
      const frequency = target===0 ? 12 : 4;
      door.velocity += (frequency*frequency*(target-door.angle)-2*frequency*door.velocity)*step;
      door.angle = Math.max(0,Math.min(85,door.angle+door.velocity*step));
    }
    if (target===0 && door.angle<1) { door.angle=0;door.velocity=0; }

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
  let elapsed = 0;
  let artworkReady = false;
  let route = [];
  let distance = 0;
  let metersPerPixel = 1;
  let points = [];
  const duration = 24000;
  const cargo = [];
  const releases = [.305,.352,.399,.446];
  let previousProgress = 0;
  const released = new Set();
  const deviceArt = kind => kind === 'HDD'
    ? `<svg viewBox="0 0 72 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="hddCase" x1="8" y1="5" x2="64" y2="91" gradientUnits="userSpaceOnUse"><stop stop-color="#d7e0e5"/><stop offset=".45" stop-color="#707d86"/><stop offset="1" stop-color="#2b353c"/></linearGradient><radialGradient id="platter"><stop stop-color="#d9f2ff"/><stop offset=".2" stop-color="#718c9e"/><stop offset=".75" stop-color="#17242d"/><stop offset="1" stop-color="#05090c"/></radialGradient></defs>
        <rect x="2.5" y="2.5" width="67" height="91" rx="7" fill="#121a20" stroke="#9bd9ff" stroke-width="2"/><rect x="7" y="7" width="58" height="76" rx="5" fill="url(#hddCase)" stroke="#e3edf2" stroke-opacity=".55"/>
        <circle cx="34" cy="39" r="23" fill="url(#platter)" stroke="#c7dce8" stroke-width="1.4"/><circle cx="34" cy="39" r="5.8" fill="#111a20" stroke="#e8f5fb" stroke-width="2"/><circle cx="34" cy="39" r="1.7" fill="#9bd9ff"/>
        <path d="M58 68 39 43" stroke="#182329" stroke-width="6" stroke-linecap="round"/><path d="M58 68 39 43" stroke="#d6e4eb" stroke-width="2.6" stroke-linecap="round"/><circle cx="58" cy="68" r="6" fill="#28353d" stroke="#c6d9e3"/><path d="m38 43-5-2 4-5" fill="#eef8fb" stroke="#43545f"/>
        <g fill="#0a1014" stroke="#d5e3e9" stroke-width=".8"><circle cx="12" cy="12" r="2"/><circle cx="60" cy="12" r="2"/><circle cx="12" cy="77" r="2"/><circle cx="60" cy="77" r="2"/></g>
        <rect x="9" y="85" width="37" height="6" rx="1" fill="#161d21" stroke="#f7d64a"/><path d="M49 85h13v6H49" fill="#11181d" stroke="#9bd9ff"/><path d="M12 86v4m4-4v4m4-4v4m4-4v4m4-4v4m4-4v4m4-4v4m4-4v4" stroke="#f7d64a"/>
        <rect x="12" y="53" width="21" height="11" rx="1.5" fill="#e8eef0" fill-opacity=".88"/><text x="22.5" y="58.2" fill="#1b2931" font-size="4.5" text-anchor="middle" font-family="monospace" font-weight="700">RAIDER HDD</text><path d="M15 61h15" stroke="#52636d" stroke-width=".8"/>
      </svg>`
    : `<svg viewBox="0 0 72 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="ssdCase" x1="5" y1="4" x2="66" y2="92" gradientUnits="userSpaceOnUse"><stop stop-color="#303c43"/><stop offset=".55" stop-color="#121a1f"/><stop offset="1" stop-color="#05090c"/></linearGradient></defs>
        <rect x="4" y="2.5" width="64" height="91" rx="6" fill="url(#ssdCase)" stroke="#72db45" stroke-width="2"/><rect x="9" y="9" width="54" height="69" rx="3" fill="#0d241d" stroke="#6ba58c"/><path d="M13 14h46v59H13z" fill="#10382a" stroke="#7bbda0" stroke-opacity=".65"/>
        <g fill="#172126" stroke="#8ca0a8" stroke-width=".7"><rect x="17" y="19" width="15" height="12" rx="1"/><rect x="40" y="19" width="15" height="12" rx="1"/><rect x="17" y="38" width="15" height="12" rx="1"/><rect x="40" y="38" width="15" height="12" rx="1"/><rect x="25" y="57" width="22" height="10" rx="1"/></g>
        <g fill="#a6d68d"><circle cx="15" cy="16" r="1.2"/><circle cx="57" cy="16" r="1.2"/><circle cx="15" cy="70" r="1.2"/><circle cx="57" cy="70" r="1.2"/></g><path d="M33 25h6m-6 19h6m-11 8v4m16-4v4M20 34h32" stroke="#72db45" opacity=".8"/>
        <rect x="18" y="29" width="36" height="12" rx="2" fill="#dce9e2"/><text x="36" y="34.5" fill="#173224" font-size="5" text-anchor="middle" font-family="monospace" font-weight="700">RAIDER SSD</text><text x="36" y="38.7" fill="#375b49" font-size="3.8" text-anchor="middle" font-family="monospace">SOLID STATE</text>
        <rect x="10" y="83" width="40" height="8" rx="1" fill="#171e21" stroke="#f7d64a"/><path d="M53 83h10v8H53" fill="#0f1518" stroke="#9bd9ff"/><path d="M13 84v6m4-6v6m4-6v6m4-6v6m4-6v6m4-6v6m4-6v6m4-6v6m4-6v6" stroke="#f7d64a" stroke-width="1.2"/>
      </svg>`;
  const dropDevice = (pose, index) => {
    const kind = index % 2 === 0 ? 'HDD' : 'SSD';
    const element = document.createElement('div');
    element.className = 'cargo '+kind.toLowerCase();
    element.setAttribute('aria-hidden','true');
    element.dataset.kind = kind;
    element.innerHTML = deviceArt(kind);
    hero.append(element);
    const tangent = Math.hypot(pose.dx,pose.dy);
    const velocity = distance/(duration/1000)*metersPerPixel;
    const opening = bay.getBoundingClientRect();
    const stage = hero.getBoundingClientRect();
    const rackSlots=[-.33,-.11,.11,.33];
    const x=opening.x+opening.width*(.5+rackSlots[index])-stage.x;
    const y=opening.y+opening.height/2-stage.y;
    cargo.push({element, x, y, launchX:x, launchY:y,
      vx:pose.dx/tangent*velocity, vy:pose.dy/tangent*velocity+(kind==='HDD'?2.15:1.55),
      angle: index%2 ? -12 : 18, spin: index%2 ? -82 : 56,
      mass:kind==='HDD'?.45:.09, area:kind==='HDD'?.012:.006, age:0,
      rail:Math.max(12,aircraft.offsetWidth*.13)});
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
      // A short guided rack release begins inside the bay. Once clear, inherited
      // aircraft velocity, gravity, and aerodynamic drag own the trajectory.
      const u=Math.min(1,item.age/.28);
      const emergence=u*u*(3-2*u);
      const scale=.56+.44*emergence;
      const drawY=item.y+item.rail*emergence;
      item.element.style.opacity=String(Math.min(1,item.age/.07));
      item.element.style.transform=`translate3d(${item.x-item.element.offsetWidth/2}px,${drawY-item.element.offsetHeight/2}px,0) rotate(${item.angle}deg) scale(${scale})`;
      if (item.y>hero.clientHeight+100 || item.x < -150 || item.x>hero.clientWidth+150 || item.age>30) {
        item.element.remove();cargo.splice(i,1);
      }
    }
  };
  const noseAngle = Math.PI;
  const sample = progress => {
    const w = hero.clientWidth;
    if (progress <= .65) return {x:w*(1.2-1.3*progress),y:points[0].y,dx:-1.3*w,dy:0,ddx:0,ddy:0};
    const t = (progress-.65)/.35;
    const start = points[0];
    const end = points[3];
    const lead = -1.3*w*.35;
    const bend = end.x-start.x-lead;
    const rise = end.y-start.y;
    // A fourth-order turn has zero curvature and zero roll rate at entry.
    // It joins the level approach without a sudden roll or acceleration change.
    return {
      x:start.x+lead*t+bend*t*t*t*t,
      y:start.y+rise*t*t*t*t,
      dx:(lead+4*bend*t*t*t)/.35,
      dy:4*rise*t*t*t/.35,
      ddx:12*bend*t*t/(.35*.35),
      ddy:12*rise*t*t/(.35*.35)
    };
  };
  const buildRoute = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const mobile = w <= 760;
    const coordinates = mobile
      // Keep the mobile exit shallow: its tall viewport otherwise turns the
      // same relative rise into a steep climb across a narrow flight path.
      ? [[.355,.68],[.177333,.68],[.02,.68],[-.45,.58]]
      : [[.355,.28],[.177333,.28],[.02,.28],[-.3,-.10]];
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
    // tan(bank) = speed² * curvature / gravity; use a gentler mobile bank.
    const pixelsPerSecond = distance/(duration/1000);
    metersPerPixel = 9.81*Math.tan((mobile ? 16 : 28)*Math.PI/180)/(pixelsPerSecond*pixelsPerSecond*maximumCurvature);
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
    aircraft.style.transform = `translate3d(${x}px,${y}px,0) rotateZ(${heading*180/Math.PI}deg)`;
    aircraft.style.opacity = '1';
    renderAircraft(bank,door.angle,aircraft.offsetWidth);
    const phase = progress<.23 ? 'approach' : progress<releaseEnd()
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
    if (progress < previousProgress) {
      previousProgress = 0;
      released.clear();
      cargo.forEach(item => item.element.remove());
      cargo.length = 0;
    }
    operateDoors(progress,dt);
    const pose = paint(progress);
    const releaseTimes = mobileFlight() ? [.305,.324,.343,.362] : releases;
    releaseTimes.forEach((release,index) => {
      if (!released.has(index) && progress>=release && progress<releaseEnd() && door.angle>=70) {
        dropDevice(pose,index);released.add(index);
      }
    });
    previousProgress = progress;
    stepCargo(dt);
    frame=requestAnimationFrame(tick);
  };
  const start = () => { if (artworkReady && !paused && visible && !document.hidden && !frame) frame=requestAnimationFrame(tick); };
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
  // Start the flight only after both views are available, so a slow image load
  // cannot reveal the aircraft partway through its approach.
  Promise.all(['assets/b21-side.png','assets/b21-overhead-v3.png'].map(src =>
    new Promise(resolve => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = src;
    })
  )).then(() => { artworkReady = true; start(); });
  button.addEventListener('click',() => { paused=!paused;updateMotion(); });
  preference.addEventListener('change',event => { paused=event.matches;updateMotion(); });
  new ResizeObserver(() => { buildRoute();paint((elapsed%duration)/duration); }).observe(hero);
  new IntersectionObserver(entries => { visible=entries[0].isIntersecting;start(); }).observe(hero);
  document.addEventListener('visibilitychange',start);
})();
