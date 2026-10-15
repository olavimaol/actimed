window.addEventListener('submit', function(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const form = event.target;
  let notice = form.querySelector('[data-replica-feedback]');
  if (!notice) { notice = document.createElement('p'); notice.dataset.replicaFeedback = ''; notice.setAttribute('role','status'); form.appendChild(notice); }
  notice.textContent = 'Demo form. Your message has not been sent.';
  notice.style.cssText = 'padding:20px 0;font:14px sans-serif;color:inherit';
}, true);
