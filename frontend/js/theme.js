/* ══════════════════════════════════════════════════════════════════════════
   theme.js — Phoneme Forge light/dark theme system
   • Reads localStorage('pf_theme')
   • Sets data-theme on <html> before paint (anti-flash)
   • Updates toggle button icon
   • Smooth transitions via CSS
══════════════════════════════════════════════════════════════════════════ */

(function () {
  const STORAGE_KEY = 'pf_theme';
  const DEFAULT     = 'dark';

  /* Apply theme immediately — called inline in <head> to prevent flash */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update toggle icon if button exists
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  /* Read saved preference, fall back to system preference, then default */
  function getPreferred() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return DEFAULT;
  }

  /* Public toggle */
  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || DEFAULT;
    const next    = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  /* Apply on load */
  applyTheme(getPreferred());

  /* Wire up button after DOM ready */
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      const theme = document.documentElement.getAttribute('data-theme') || DEFAULT;
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.addEventListener('click', window.toggleTheme);
    }
  });

  /* Listen for system preference changes */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
})();
