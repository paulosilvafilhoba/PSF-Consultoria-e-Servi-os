(() => {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, columns, drops;
  const chars = '01PSF{}<>IA';
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    columns = Math.floor(w / 24);
    drops = Array.from({ length: columns }, () => Math.random() * h / 24);
  }
  function draw() {
    const isLight = document.documentElement.dataset.theme === 'light';
    ctx.fillStyle = isLight ? 'rgba(245,248,255,0.08)' : 'rgba(5,7,11,0.11)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '16px JetBrains Mono, monospace';
    ctx.fillStyle = isLight ? 'rgba(11,103,217,.55)' : 'rgba(57,255,20,.58)';
    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(text, i * 24, drops[i] * 24);
      if (drops[i] * 24 > h && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.42;
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize(); draw();
})();
