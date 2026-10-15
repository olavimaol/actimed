(() => {
  const banner = document.querySelector('#kncc-banner');
  const key = 'revoltosa-replica-consent';
  function show(value) { if (banner) banner.style.display = value ? 'block' : 'none'; }
  window.knccEditConsent = () => show(true);
  let consent = null; try { consent = localStorage.getItem(key); } catch {}
  show(!consent);
  if (banner) banner.addEventListener('click', event => {
    const button = event.target.closest('[data-kncc]'); if (!button) return;
    const action = button.dataset.kncc;
    if (action === 'toggle-details') {
      const details = banner.querySelector('.kncc-details');
      if (details) details.style.display = details.style.display === 'none' ? 'block' : 'none';
    } else {
      try { localStorage.setItem(key, action); } catch {}
      show(false);
    }
  });
  window.addEventListener('submit', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const form = event.target;
    let notice = form.querySelector('[data-replica-feedback]');
    if (!notice) { notice = document.createElement('p'); notice.dataset.replicaFeedback = ''; notice.setAttribute('role','status'); form.appendChild(notice); }
    notice.textContent = 'Formulario de demostración. No se ha enviado ningún mensaje.';
    notice.style.cssText = 'padding:20px 0;font:14px/1.5 sans-serif;color:inherit';
  }, true);
})();
