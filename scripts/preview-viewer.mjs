// Standalone read-only viewer. No API, credentials or external resources are embedded.
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function previewHtml(screens, css, date) {
  const entries = screens.map(({ id, title, path, parent }) => ({ id, title, path, parent }));
  const templates = screens
    .map((screen) => `<template id="view-${escapeHtml(screen.id)}">${screen.html}</template>`)
    .join('\n');
  const config = JSON.stringify(entries).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>Clara · visualização offline</title>
<style>${css.replace(/<\/style/gi, '<\\/style')}
:root { --offline-bar: 98px; }
.offline-toolbar { position: sticky; top: 0; z-index: 500; background: #10283b; color: #fff; padding: 12px 24px; display: flex; gap: 10px 22px; flex-wrap: wrap; align-items: center; box-shadow: 0 2px 12px #0002; }
.offline-toolbar strong { color: #b4f3d8; font-size: 16px; }
.offline-toolbar p { font-size: 12px; line-height: 1.5; color: #e0ebef; max-width: 700px; }
.offline-toolbar label { font-size: 12px; margin-left: auto; display: grid; gap: 5px; }
.offline-toolbar select { padding: 8px; background: #fff; color: #10283b; border: 1px solid #7995a5; border-radius: 8px; max-width: min(340px, 86vw); }
.offline-toolbar nav { display: flex; gap: 8px; }
.offline-toolbar button { background: #214558; border: 1px solid #6c8b9c; color: white; padding: 8px 12px; border-radius: 8px; font-size: 12px; }
.offline-toolbar button:hover { background: #326379; }
.sidebar { top: var(--offline-bar); height: calc(100dvh - var(--offline-bar)); }
.recharts-responsive-container > div { width: 100% !important; height: 100% !important; }
.recharts-wrapper { width: 100% !important; max-width: 100% !important; }
.recharts-surface { width: 100% !important; height: auto !important; }
.offline-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); width: max-content; max-width: calc(100vw - 32px); z-index: 1000; background: #10283b; color: white; padding: 14px 20px; border-radius: 12px; box-shadow: 0 4px 30px #0003; font-size: 14px; }
input:disabled, textarea:disabled, select:disabled { opacity: 1; color: var(--text); cursor: default; }
.offline-toolbar select:disabled { color: #10283b; }
@media (max-width: 700px) { .offline-toolbar { padding: 10px 14px; gap: 8px; } .offline-toolbar label { margin-left: 0; } .offline-toolbar p { font-size: 11px; } }
@media print { .offline-toolbar, .offline-toast { display: none; } .sidebar { position: static; } .app-main { margin: 0; } }
</style></head><body>
<header class="offline-toolbar" aria-label="Visualização offline do Clara">
<div><strong>Clara · visualização offline</strong><p>${screens.length} telas · Exemplos fictícios de ${escapeHtml(date)}. Navegue pelo site e painel. Formulários e históricos são exemplos para consulta; login, alterações e exportações exigem a versão conectada.</p></div>
<nav aria-label="Atalhos da visualização"><button type="button" data-view="inicio">Site</button><button type="button" data-view="painel">Painel</button></nav>
<label>Escolha uma tela<select id="offline-screen">${screens.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.title)}</option>`).join('')}</select></label>
</header><div id="offline-root"></div><p id="offline-toast" class="offline-toast" role="status" hidden></p>
${templates}
<script>
(() => {
  'use strict';
  const screens = ${config};
  const root = document.getElementById('offline-root');
  const picker = document.getElementById('offline-screen');
  const toast = document.getElementById('offline-toast');
  const paths = new Map(screens.filter(s => !s.parent).map(s => [s.path, s.id]));
  paths.set('/app/', 'painel');
  let current, timer;
  const buttonViews = {
    'Nova conta': 'nova-conta', 'Nova categoria': 'nova-categoria', 'Nova movimentação': 'nova-movimentacao',
    'Novo cartão': 'novo-cartao', 'Nova meta': 'nova-meta', 'Nova dívida': 'nova-divida',
    'Adicionar bem ou investimento': 'novo-bem', 'Registrar compra': 'nova-compra',
    'Definir limite': 'orcamento', 'Registrar progresso': 'aporte',
    'Registrar reembolso': 'reembolso'
  };
  function notice() {
    toast.textContent = 'Este HTML é para consulta. Alterações, autenticação e exportações precisam do Clara conectado ao servidor. Veja outros exemplos no menu de telas.';
    toast.hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { toast.hidden = true; }, 6000);
  }
  function render(id) {
    const view = screens.find(s => s.id === id) || screens[0];
    current = view; picker.value = view.id;
    root.replaceChildren(document.getElementById('view-' + view.id).content.cloneNode(true));
    document.title = view.title + ' · Clara offline';
    document.documentElement.dataset.theme = view.id === 'painel-escuro' ? 'dark' : 'light';
    const dialog = root.querySelector('dialog');
    if (dialog) { dialog.removeAttribute('open'); dialog.showModal(); dialog.addEventListener('cancel', e => { e.preventDefault(); navigate(view.parent || 'painel'); }); }
    root.querySelectorAll('button').forEach(button => {
      const name = button.getAttribute('aria-label') || button.textContent.trim().replace(/\\s+/g, ' ');
      if (buttonViews[name]) button.dataset.view = buttonViews[name];
      if (view.parent && name === 'Fechar') button.dataset.view = view.parent;
    });
    document.querySelector('.offline-toolbar p').setAttribute('aria-live', 'off');
    window.scrollTo(0, 0);
  }
  function navigate(id) { if (location.hash.slice(1) === id) render(id); else location.hash = id; }
  window.addEventListener('hashchange', () => render(location.hash.slice(1)));
  picker.addEventListener('change', () => navigate(picker.value));
  document.addEventListener('submit', e => { e.preventDefault(); notice(); });
  document.addEventListener('click', e => {
    const target = e.target.closest('button, a'); if (!target) return;
    if (target.dataset.view) { e.preventDefault(); navigate(target.dataset.view); return; }
    if (target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href') || '';
      if (paths.has(href)) { navigate(paths.get(href)); return; }
      if (href.startsWith('#')) { const section = root.querySelector('[id="' + CSS.escape(href.slice(1)) + '"]'); if (section) { section.scrollIntoView({ behavior: 'smooth' }); return; } }
      notice(); return;
    }
    const name = target.getAttribute('aria-label') || target.textContent.trim().replace(/\\s+/g, ' ');
    if (name === 'Abrir menu financeiro' || name === 'Fechar menu') { root.querySelector('.sidebar')?.classList.toggle('is-open'); return; }
    if (name === 'Ativar modo escuro' || name === 'Ativar modo claro') {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; return;
    }
    if (name === 'Extrato') { navigate('extrato'); return; }
    if (name === 'Histórico de aportes') { navigate('historico-meta'); return; }
    if (name.startsWith('Detalhes da fatura')) { navigate('fatura'); return; }
    if (name === 'Histórico de pagamentos') { navigate('historico-divida'); return; }
    if (name === 'Histórico de avaliações') { navigate('historico-investimento'); return; }
    notice();
  });
  new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--offline-bar', entry.target.offsetHeight + 'px')).observe(document.querySelector('.offline-toolbar'));
  render(location.hash.slice(1) || 'inicio');
})();
</script></body></html>`;
}
