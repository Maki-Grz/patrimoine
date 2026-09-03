<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let sideNavRef = $state(null);

  // Handle sidebar navigation changes
  function handleNavChange(event) {
    const selectedItem = event.detail.item;
    appState.activeTab = selectedItem.getAttribute('data-tab');
    if (window.innerWidth < 768) {
      appState.sidebarCollapsed = true;
    }
  }

  // Programmatic event listener registration for UI5 side navigation
  $effect(() => {
    if (sideNavRef) {
      const listener = (event) => handleNavChange(event);
      sideNavRef.addEventListener('selection-change', listener);
      return () => {
        sideNavRef.removeEventListener('selection-change', listener);
      };
    }
  });
</script>

<aside class="app-sidebar {appState.sidebarCollapsed ? 'collapsed' : ''}">
  <ui5-side-navigation bind:this={sideNavRef}>
    <ui5-side-navigation-item 
      text={i18n.t('nav.dashboard')} 
      icon="home" 
      selected={appState.activeTab === 'dashboard'} 
      data-tab="dashboard">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.accounts')} 
      icon="wallet" 
      selected={appState.activeTab === 'comptes'} 
      data-tab="comptes">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.distribution')} 
      icon="process" 
      selected={appState.activeTab === 'distribution'} 
      data-tab="distribution">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.flowGraph')} 
      icon="org-chart" 
      selected={appState.activeTab === 'graphe'} 
      data-tab="graphe">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.recurring')} 
      icon="credit-card" 
      selected={appState.activeTab === 'abonnements'} 
      data-tab="abonnements">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.expenses')} 
      icon="cart" 
      selected={appState.activeTab === 'depenses'} 
      data-tab="depenses">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.calendar')} 
      icon="calendar" 
      selected={appState.activeTab === 'calendar'} 
      data-tab="calendar">
    </ui5-side-navigation-item>
    <ui5-side-navigation-item 
      text={i18n.t('nav.logs')} 
      icon="document-text" 
      selected={appState.activeTab === 'logs'} 
      data-tab="logs">
    </ui5-side-navigation-item>
  </ui5-side-navigation>
</aside>
