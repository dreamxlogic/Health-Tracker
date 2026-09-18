// Shared progressive-enhancement layer for accessibility, keyboard input and PWA behavior.
// It intentionally works with the current declarative runtime so existing data/rendering stays intact.
(function () {
  const INTERACTIVE = 'button,a,input,textarea,select,summary';

  function accessibleName(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 140);
  }

  function enhance(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const select = (selector) => [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
    select('div').forEach((el) => {
      if (el.children.length === 0 && el.textContent.trim() === 'Profile') el.textContent = 'Settings';
    });
    select('[style*="cursor: pointer"],[style*="cursor:pointer"]').forEach((el) => {
      if (el.matches(INTERACTIVE) || el.getAttribute('role')) return;
      el.classList.add('hcc-action');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      const name = accessibleName(el);
      const inferred = (/^\d{1,2}$/.test(name) && getComputedStyle(el).aspectRatio !== 'auto') ? `Day ${name}` : (name || (el.querySelector('line[x1="12"][y1="5"]') ? 'Add a log' : 'Action'));
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', inferred);
      if (!el.dataset.hccKeybound) {
        el.dataset.hccKeybound = '1';
        el.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          el.click();
        });
      }
    });

    select('[data-hcc-slider],[style*="touch-action: none"]').forEach((el) => {
      el.setAttribute('role', 'slider');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-valuemin', el.dataset.min || '0');
      el.setAttribute('aria-valuemax', el.dataset.max || '10');
      const context = accessibleName(el.parentElement || el);
      const value = el.dataset.value || (context.match(/\b(?:10|[0-9])\b/) || ['0'])[0];
      el.setAttribute('aria-valuenow', value);
      el.setAttribute('aria-label', el.dataset.label || context.slice(0, 60) || 'Rating');
      if (/\b(Add|Choose|Optional)\b/i.test(context)) el.setAttribute('aria-valuetext', 'Not set');
      if (!el.dataset.hccSliderbound) {
        el.dataset.hccSliderbound = '1';
        el.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const min = Number(el.getAttribute('aria-valuemin') || 0), max = Number(el.getAttribute('aria-valuemax') || 10);
          const current = Number(el.getAttribute('aria-valuenow') || min);
          const next = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, current + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1)));
          const rect = el.getBoundingClientRect(), x = rect.left + ((next - min) / Math.max(1, max - min)) * rect.width, y = rect.top + rect.height / 2;
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' }));
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' }));
          el.setAttribute('aria-valuenow', String(next)); el.removeAttribute('aria-valuetext');
        });
      }
    });

    select('[data-hcc-dialog]').forEach((el) => {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      if (el.dataset.title) el.setAttribute('aria-label', el.dataset.title);
    });

    select('[role="switch"]').forEach((el) => {
      el.setAttribute('tabindex', '0');
      const bg = getComputedStyle(el).backgroundColor;
      el.setAttribute('aria-checked', String(!/228, 226, 238|246, 245, 251/.test(bg)));
      if (!el.dataset.hccKeybound) {
        el.dataset.hccKeybound = '1';
        el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); } });
      }
    });

    select('[data-hcc-scroll-rail]').forEach((el) => {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'region');
      if (el.dataset.label) el.setAttribute('aria-label', el.dataset.label);
      if (!el.dataset.hccRailbound) {
        el.dataset.hccRailbound = '1';
        el.addEventListener('keydown', (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          el.scrollBy({ left: event.key === 'ArrowRight' ? 150 : -150, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
      }
    });
  }

  function start() {
    enhance(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) enhance(node);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.addEventListener('unhandledrejection', (event) => {
      const prior = document.getElementById('hcc-runtime-error'); if (prior) prior.remove();
      const alert = document.createElement('div'); alert.id = 'hcc-runtime-error'; alert.setAttribute('role', 'alert');
      alert.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(90px + env(safe-area-inset-bottom,0px));z-index:2147483646;background:#8b2d28;color:#fff;padding:13px 16px;border-radius:14px;font:700 13px/1.4 system-ui;box-shadow:0 12px 30px rgba(50,20,20,.3)';
      alert.textContent = 'That change could not be saved. Your previous data is still available. Please try again or export a backup.';
      document.body.appendChild(alert); setTimeout(() => alert.remove(), 7000);
      console.error('[Health Tracker] Unhandled save error', event.reason);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
