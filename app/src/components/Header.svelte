<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';
  import UserProfileDialog from './UserProfileDialog.svelte';

  function toggleSidebar() {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
  }

  function openProfile() {
    appState.isProfileDialogOpen = true;
  }

  let userInitials = $derived.by(() => {
    if (!appState.userProfile?.displayName) return 'MG';
    const parts = appState.userProfile.displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  });
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
    <ui5-button
      design="Emphasized"
      icon="add"
      style="height: 32px; margin-right: 10px;"
      onclick={() => appState.activeTab = 'depenses'}
    >
      {i18n.t('expenses.newBtn')}
    </ui5-button>

    <button 
      class="env-badge" 
      onclick={openProfile} 
      title="SAP BTP Environment"
      style="cursor: pointer; background: transparent; border: none; font-family: inherit;">
      {appState.userProfile?.isBTP ? i18n.t('header.btpCloud') : i18n.t('header.btpDev')}
    </button>

    <!-- Language Selector Dropdown -->
    <ui5-select
      class="lang-select"
      onchange={(e) => i18n.setLanguage(e.target.value)}
      style="width: 70px; margin-right: 12px; height: 32px;"
    >
      <ui5-option value="fr" selected={i18n.currentLang === 'fr'}>FR</ui5-option>
      <ui5-option value="en" selected={i18n.currentLang === 'en'}>EN</ui5-option>
    </ui5-select>

    <!-- Interactive User Profile Avatar Chip -->
    <div
      class="user-profile-chip"
      onclick={openProfile}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openProfile(); }}
      title="Profil SAP BTP - {appState.userProfile?.displayName || 'Utilisateur'}"
      style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 3px 8px 3px 4px; border-radius: 20px; background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.08); transition: background 0.2s;"
      role="button"
      tabindex="0">
      <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: var(--sap-primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">
        {userInitials}
        <span style="position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%; background: {appState.userProfile?.isBTP ? '#107e3e' : '#0a6ed1'}; border: 1.5px solid white;"></span>
      </div>
      <span class="hide-on-mobile" style="font-size: 12px; font-weight: 600; color: var(--sap-text-color);">
        {appState.userProfile?.displayName?.split(' ')[0] || 'Profil'}
      </span>
    </div>
  </div>
</header>

<UserProfileDialog />
