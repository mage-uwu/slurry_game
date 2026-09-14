(() => {
  const output = document.getElementById('visitor-total');
  async function update() {
    let id;
    // Retain only a random browser ID; no IP address, fingerprint or third-party service.
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const storage = window[name], key = 'monomage-visitor-v1';
        id = storage.getItem(key);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) {
          id = crypto.randomUUID();
          storage.setItem(key, id);
        }
        break;
      } catch { id = undefined; }
    }
    try {
      const response = await fetch('/api/visitors', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : {}),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return;
      const { total } = await response.json();
      if (output && Number.isSafeInteger(total) && total >= 0) {
        output.textContent = new Intl.NumberFormat(document.documentElement.lang || 'en').format(total);
      }
    } catch { /* Keep the neutral placeholder when the count cannot be reached. */ }
  }
  if (document.prerendering) document.addEventListener('prerenderingchange', update, { once: true });
  else update();
})();
