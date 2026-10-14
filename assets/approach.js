// Orbital SVG motion and visibility pause behavior adapted from Noctis Tint.
// Circular paths use paced arc length; each airframe stays rigid and points along its tangent.
(() => {
  const svg = document.querySelector('.approach-flight');
  if (!svg || typeof svg.pauseAnimations !== 'function') return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  const syncMotion = () => {
    const paused = preference.matches || !visible || document.hidden ||
      document.documentElement.classList.contains('motion-paused');
    svg.dataset.motion = paused ? 'paused' : 'running';
    if (paused) svg.pauseAnimations(); else svg.unpauseAnimations();
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  }, {threshold:.05}).observe(svg);
  new MutationObserver(syncMotion).observe(document.documentElement, {
    attributes:true, attributeFilter:['class']
  });
  preference.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  syncMotion();
})();
