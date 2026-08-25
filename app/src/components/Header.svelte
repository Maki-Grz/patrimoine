<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  function toggleSidebar() {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
  }
</script>

<header class="app-header">
  <div class="header-left">
    <button class="menu-toggle" onclick={toggleSidebar} title={i18n.t('sidebar.toggle')}>
      <ui5-icon name="menu" style="color: var(--sap-primary-color);"></ui5-icon>
    </button>
    <div class="header-logo">
      <ui5-icon name="money-bills"></ui5-icon>
      {i18n.t('header.title')}
      <span class="header-logo-sub">| {i18n.t('header.subtitle')}</span>
    </div>
  </div>
  <div class="header-right">
    <span class="env-badge">{i18n.t('header.btpDev')}</span>
    
    <!-- Language Selector Dropdown -->
    <ui5-select 
      class="lang-select" 
      onchange={(e) => i18n.setLanguage(e.target.value)} 
      style="width: 70px; margin-right: 15px; height: 32px;"
    >
      <ui5-option value="fr" selected={i18n.currentLang === 'fr'}>FR</ui5-option>
      <ui5-option value="en" selected={i18n.currentLang === 'en'}>EN</ui5-option>
    </ui5-select>

    <ui5-icon name="employee" style="color: var(--sap-text-muted-color); width: 24px; height: 24px; cursor: pointer;"></ui5-icon>
  </div>
</header>
