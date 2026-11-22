(function () {
  const pref = localStorage.getItem('sc_theme') || 'system';
  const dark =
    pref === 'dark' ||
    (pref === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
})();
