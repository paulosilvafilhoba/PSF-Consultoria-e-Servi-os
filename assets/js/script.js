(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem('psf-theme');
  if (saved) root.dataset.theme = saved;
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) root.dataset.theme = 'light';

  const themeBtn = document.querySelector('[data-theme-toggle]');
  const setIcon = () => {
    if (!themeBtn) return;
    const knob = themeBtn.querySelector('.theme-toggle__knob');
    if (knob) knob.textContent = root.dataset.theme === 'light' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-label', root.dataset.theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro');
  };
  setIcon();
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('psf-theme', root.dataset.theme);
    setIcon();
  });

  const header = document.querySelector('.site-header');
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 16);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('.nav__links');
  menuBtn?.addEventListener('click', () => {
    const open = menu?.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();
