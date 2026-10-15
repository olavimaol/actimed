(() => {
  function ready() {
    if (document.querySelector('.replica-site-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'replica-site-nav';
    nav.setAttribute('aria-label', 'Switch websites');
    nav.innerHTML = '<a href="/en/">← Agrumea Farm</a><span aria-hidden="true">/</span><a href="/jesper/">Jesper Landberg ↗</a>';
    document.body.appendChild(nav);
  }
  if (document.readyState !== 'complete') window.addEventListener('load', ready, {once: true});
  else ready();
})();
