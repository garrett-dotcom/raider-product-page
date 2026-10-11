(() => {
  const root = document.documentElement;
  const header = document.querySelector('header');
  const button = document.querySelector('.motion-control');
  const updateHeader = () => header?.classList.toggle('at-top', window.scrollY < 40);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  if (!button) return;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const updateMotion = () => {
    root.classList.toggle('motion-paused', paused);
    root.classList.toggle('motion-enabled', !paused);
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
    button.querySelector('.motion-label').textContent = paused ? 'Motion off' : 'Motion on';
  };
  updateMotion();
  button.addEventListener('click', () => { paused = !paused; updateMotion(); });
})();
