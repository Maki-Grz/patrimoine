<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let dialogRef = $state(null);

  // Form states initialized from userProfile
  let netSalary = $state(1458.25);
  let grossSalary = $state(1870);
  let payDay = $state(28);
  let livingBudget = $state(300);
  let safetyCushion = $state(200);

  // Synchronize when userProfile changes
  $effect(() => {
    if (appState.userProfile?.preferences) {
      const p = appState.userProfile.preferences;
      netSalary = p.montantNet || 1458.25;
      grossSalary = p.montantBrut || 1870;
      payDay = p.jourDePaie || 28;
      livingBudget = p.budgetVieCourante || 300;
      safetyCushion = p.matelasSecurite || 200;
    }
  });

  // User initials
  let userInitials = $derived.by(() => {
    if (!appState.userProfile?.displayName) return 'MP';
    const parts = appState.userProfile.displayName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  });

  function closeDialog() {
    appState.isProfileDialogOpen = false;
    if (dialogRef && typeof dialogRef.close === 'function') {
      dialogRef.close();
    }
  }

  async function handleSavePreferences() {
    const success = await appState.updateUserProfile({
      montantNet: parseFloat(netSalary),
      montantBrut: parseFloat(grossSalary),
      jourDePaie: parseInt(payDay),
      budgetVieCourante: parseFloat(livingBudget),
      matelasSecurite: parseFloat(safetyCushion)
    });
    if (success) {
      closeDialog();
    }
  }
</script>

<ui5-dialog 
  bind:this={dialogRef} 
  open={appState.isProfileDialogOpen || undefined} 
  header-text={i18n.t('profile.title')}
  style="--_ui5_dialog_content_max_width: 540px;">
  
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 20px;">
    
    <!-- BTP Identity Card -->
    <div style="display: flex; gap: 16px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background: var(--sap-primary-color); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; box-shadow: 0 2px 6px rgba(10,110,209,0.25);">
        {userInitials}
      </div>
      
      <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 16px; font-weight: bold; color: var(--sap-text-color);">
            {appState.userProfile?.displayName || 'Gestionnaire Patrimoine'}
          </span>
          <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: {appState.userProfile?.isBTP ? '#107e3e15' : '#0a6ed115'}; color: {appState.userProfile?.isBTP ? '#107e3e' : '#0a6ed1'}; border: 1px solid {appState.userProfile?.isBTP ? '#107e3e40' : '#0a6ed140'};">
            ● {appState.userProfile?.isBTP ? i18n.t('profile.btpCloud') : i18n.t('profile.btpDev')}
          </span>
        </div>
        
        <span style="font-size: 12px; color: var(--sap-text-muted-color);">
          {appState.userProfile?.email || 'maki.grz@patrimoine.local'}
        </span>
        
        <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 11px; color: var(--sap-text-muted-color);">
          <span>{i18n.t('profile.tenant')} : <strong>{appState.userProfile?.tenant || 'cf-eu10'}</strong></span>
          <span>•</span>
          <span>{i18n.t('profile.auth')} : <strong>{appState.userProfile?.authKind?.toUpperCase() || 'XSUAA'}</strong></span>
          <span>•</span>
          <span>{i18n.t('profile.space')} : <strong>{appState.userProfile?.space || 'production'}</strong></span>
        </div>
      </div>
    </div>

    <!-- BTP Role Collections -->
    <div>
      <div style="font-size: 12px; font-weight: bold; color: var(--sap-text-muted-color); text-transform: uppercase; margin-bottom: 6px;">
        {i18n.t('profile.rolesTitle')}
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        {#each (appState.userProfile?.roles || ['PatrimoineUser', 'Investor', 'PatrimoineAdmin']) as role}
          <div style="font-size: 11px; font-weight: 600; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 4px; padding: 3px 8px;">
            🛡️ {role}
          </div>
        {/each}
      </div>
    </div>

    <!-- Personal Wealth Configuration -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <div style="font-size: 12px; font-weight: bold; color: var(--sap-text-muted-color); text-transform: uppercase; margin-bottom: 12px;">
        {i18n.t('profile.paramsTitle')}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="form-group" style="margin: 0;">
          <label for="prof-salary-net" style="font-size: 12px;">{i18n.t('profile.netSalary')}</label>
          <ui5-input 
            id="prof-salary-net" 
            type="Number" 
            value={netSalary} 
            oninput={(e) => netSalary = e.target.value}>
          </ui5-input>
        </div>

        <div class="form-group" style="margin: 0;">
          <label for="prof-pay-day" style="font-size: 12px;">{i18n.t('profile.payDay')}</label>
          <ui5-input 
            id="prof-pay-day" 
            type="Number" 
            value={payDay} 
            oninput={(e) => payDay = e.target.value}>
          </ui5-input>
        </div>

        <div class="form-group" style="margin: 0;">
          <label for="prof-living-budget" style="font-size: 12px;">{i18n.t('profile.livingBudget')}</label>
          <ui5-input 
            id="prof-living-budget" 
            type="Number" 
            value={livingBudget} 
            oninput={(e) => livingBudget = e.target.value}>
          </ui5-input>
        </div>

        <div class="form-group" style="margin: 0;">
          <label for="prof-safety-cushion" style="font-size: 12px;">{i18n.t('profile.safetyCushion')}</label>
          <ui5-input 
            id="prof-safety-cushion" 
            type="Number" 
            value={safetyCushion} 
            oninput={(e) => safetyCushion = e.target.value}>
          </ui5-input>
        </div>
      </div>
    </div>

    <!-- RGPD & Data Protection Section -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <div style="font-size: 12px; font-weight: bold; color: var(--sap-text-muted-color); text-transform: uppercase; margin-bottom: 8px;">
        {i18n.t('profile.rgpdTitle')}
      </div>
      
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
          🔒 {i18n.t('profile.rgpdTde')}
        </span>
        <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">
          🛡️ {i18n.t('profile.rgpdTls')}
        </span>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <ui5-button 
          icon="download" 
          design="Transparent" 
          style="font-size: 11px; height: 32px;"
          onclick={() => appState.exportUserData()}>
          {i18n.t('profile.rgpdExport')}
        </ui5-button>

        <ui5-button 
          icon="delete" 
          design="Transparent" 
          style="font-size: 11px; height: 32px; color: var(--sap-error-color);"
          onclick={() => {
            if (confirm(i18n.t('profile.rgpdEraseConfirm'))) {
              appState.clearAllData();
              closeDialog();
            }
          }}>
          {i18n.t('profile.rgpdErase')}
        </ui5-button>
      </div>
    </div>

  </div>

  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={closeDialog} design="Transparent">{i18n.t('profile.closeBtn')}</ui5-button>
    <ui5-button onclick={handleSavePreferences} design="Emphasized">
      💾 {i18n.t('profile.saveBtn')}
    </ui5-button>
  </div>
</ui5-dialog>
