/* Keep this separate site outside Nuxt's internal router and page transitions. */
(function () {
  'use strict';

  if (window.__agrumeaSiteSwitcherInitialized) return;
  window.__agrumeaSiteSwitcherInitialized = true;

  function installLink() {
    document.querySelectorAll('.site-full-page-nav__inner').forEach(function (menu) {
      if (menu.querySelector('[data-site-switcher]')) return;

      var group = document.createElement('nav');
      group.className = 'site-switchers';
      group.setAttribute('data-site-switcher', '');
      group.setAttribute('aria-label', 'Other websites');

      [
        { title: 'Jesper Landberg', href: '/jesper/' },
        { title: 'Ricardo Chance', href: '/ricardo/' },
        { title: 'StringTune', href: '/string-tune/' },
        { title: 'Mantis', href: '/mantis/' },
        { title: 'AMANATION', href: '/amanation/' },
        { title: 'La Revoltosa', href: '/revoltosa/' }
      ].forEach(function (site) {
        var link = document.createElement('a');
        link.className = 'site-switcher';
        link.href = site.href;
        link.appendChild(document.createTextNode(site.title + ' '));

        var arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↗';
        link.appendChild(arrow);

        // A separate document must load normally, even if internal links use SPA routing.
        // Modified clicks retain the browser's normal new-tab/window behaviour.
        link.addEventListener('click', function (event) {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
              event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          event.stopPropagation();
          window.location.assign(link.href);
        }, true);
        group.appendChild(link);
      });

      menu.appendChild(group);
    });
  }

  var scheduled = false;
  function scheduleInstall() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      installLink();
    });
  }

  function start() {
    installLink();

    // Vue may replace the navigation when a route or language changes.
    // Watching child changes restores the links without touching compiled components.
    var observer = new MutationObserver(scheduleInstall);
    observer.observe(document.getElementById('__nuxt') || document.body, {
      childList: true,
      subtree: true
    });
    window.addEventListener('pageshow', scheduleInstall);
  }

  // Wait until the server-rendered menu has hydrated before adding custom DOM.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
