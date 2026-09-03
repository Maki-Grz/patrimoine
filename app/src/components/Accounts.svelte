<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Dialog & Form States
  let isAccountDialogOpen = $state(false);
  let isEditingAccount = $state(false);
  let accountDialogRef = $state(null);
  
  let accountForm = $state({
    ID: '',
    Libelle: '',
    Type: 'Compte Courant',
    SoldeActuel: 0,
    TypePlacement: 'Courant',
    DateMaturite: '',
    TauxActuel: 0,
    IBAN: '',
    Plafond: '',
    Etablissement: '',
    Couleur: '#0a6ed1'
  });

  const PRESETS = [
    { label: 'Livret A (22 950 €)', libelle: 'Livret A', type: 'Livret A', placement: 'Epargne', plafond: 22950, taux: 3.0, couleur: '#107e3e' },
    { label: 'LDDS (12 000 €)', libelle: 'LDDS', type: 'LDDS', placement: 'Epargne', plafond: 12000, taux: 3.0, couleur: '#28a745' },
    { label: 'LEP (10 000 €)', libelle: 'LEP', type: 'LEP', placement: 'Epargne', plafond: 10000, taux: 4.0, couleur: '#20c997' },
    { label: 'PEA (150 000 €)', libelle: 'PEA ETF & Actions', type: 'PEA', placement: 'Actions', plafond: 150000, taux: 6.0, couleur: '#e9730c' },
    { label: 'Compte Courant', libelle: 'Compte Courant', type: 'Compte Courant', placement: 'Courant', plafond: '', taux: 0, couleur: '#0a6ed1' }
  ];

  function applyPreset(p) {
    accountForm.Libelle = p.libelle;
    accountForm.Type = p.type;
    accountForm.TypePlacement = p.placement;
    accountForm.Plafond = p.plafond !== '' ? p.plafond : '';
    accountForm.TauxActuel = p.taux;
    accountForm.Couleur = p.couleur;
  }

  let revealedIbans = $state({});

  function toggleRevealIban(id) {
    revealedIbans[id] = !revealedIbans[id];
  }

  function formatIban(iban, isRevealed = false) {
    if (!iban) return '-';
    if (isRevealed) return iban;
    const clean = iban.replace(/\s+/g, '');
    if (clean.length <= 8) return iban;
    return `${clean.slice(0, 4)} •••• •••• •••• ${clean.slice(-4)}`;
  }

  // Validation States
  let libelleError = $derived(
    accountForm.Libelle.trim() === '' 
      ? 'Le nom du compte est requis' 
      : (appState.accounts.some(a => a.Libelle.toLowerCase() === accountForm.Libelle.trim().toLowerCase() && a.ID !== accountForm.ID)
        ? 'Un compte porte déjà ce libellé' 
        : '')
  );

  let ibanError = $derived(
    accountForm.IBAN && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(accountForm.IBAN.replace(/\s/g, ''))
      ? 'IBAN invalide (doit commencer par 2 lettres suivies de 11 à 30 chiffres/lettres)'
      : ''
  );

  let isFormValid = $derived(accountForm.Libelle.trim() !== '' && libelleError === '' && ibanError === '');

  // Inline balance editing states
  let editingSoldeId = $state(null);
  let editingSoldeVal = $state(0);

  function startInlineEditSolde(acc) {
    editingSoldeId = acc.ID;
    editingSoldeVal = acc.SoldeActuel;
  }

  async function saveInlineSolde(acc) {
    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/Accounts(${acc.ID})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ SoldeActuel: parseFloat(editingSoldeVal || 0) })
      });
      if (res.ok) {
        appState.showToast(`Le solde du compte "${acc.Libelle}" a été mis à jour.`);
        editingSoldeId = null;
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la mise à jour du solde.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  function cancelInlineEdit() {
    editingSoldeId = null;
  }

  // Automatic mapping of Placement Category based on Account Type keywords
  function handleTypeInputChange(val) {
    accountForm.Type = val;
    
    // Auto-map placement type based on keywords
    const lowerVal = val.toLowerCase();
    if (lowerVal.includes('courant') || lowerVal.includes('chèque') || lowerVal.includes('cheque') || lowerVal.includes('transit')) {
      accountForm.TypePlacement = 'Courant';
    } else if (lowerVal.includes('livret') || lowerVal.includes('ldds') || lowerVal.includes('lep') || lowerVal.includes('épargne') || lowerVal.includes('cel') || lowerVal.includes('pel')) {
      accountForm.TypePlacement = 'Epargne';
      if (accountForm.TauxActuel === 0) {
        accountForm.TauxActuel = 3.0;
      }
      if (lowerVal.includes('livret a') && !accountForm.Plafond) {
        accountForm.Plafond = 22950;
      } else if (lowerVal.includes('ldds') && !accountForm.Plafond) {
        accountForm.Plafond = 12000;
      } else if (lowerVal.includes('lep') && !accountForm.Plafond) {
        accountForm.Plafond = 10000;
      }
    } else if (lowerVal.includes('pea') || lowerVal.includes('titre') || lowerVal.includes('actions') || lowerVal.includes('etf') || lowerVal.includes('bourse') || lowerVal.includes('placement') || lowerVal.includes('amundi')) {
      accountForm.TypePlacement = 'Actions';
      if (accountForm.TauxActuel === 0) {
        accountForm.TauxActuel = 5.0;
      }
      if (lowerVal.includes('pea') && !accountForm.Plafond) {
        accountForm.Plafond = 150000;
      }
    } else if (lowerVal.includes('pee') || lowerVal.includes('peg') || lowerVal.includes('bloqué') || lowerVal.includes('bloque') || lowerVal.includes('salariale') || lowerVal.includes('retraite') || lowerVal.includes('per')) {
      accountForm.TypePlacement = 'Verrouille';
    }
  }

  /**
   * Opens the dialog to add a new bank account.
   */
  function openAddAccount() {
    accountForm = {
      ID: '',
      Libelle: '',
      Type: 'Compte Courant',
      SoldeActuel: 0,
      TypePlacement: 'Courant',
      DateMaturite: '',
      TauxActuel: 0,
      IBAN: '',
      Plafond: '',
      Etablissement: '',
      Couleur: '#0a6ed1'
    };
    isEditingAccount = false;
    isAccountDialogOpen = true;
    if (accountDialogRef && typeof accountDialogRef.show === 'function') {
      accountDialogRef.show();
    }
  }

  /**
   * Opens the dialog to edit an existing bank account.
   * @param {object} acc - The account object.
   */
  function openEditAccount(acc) {
    accountForm = { 
      ID: acc.ID,
      Libelle: acc.Libelle,
      Type: acc.Type,
      SoldeActuel: acc.SoldeActuel,
      TypePlacement: acc.TypePlacement || 'Courant',
      DateMaturite: acc.DateMaturite || '',
      TauxActuel: acc.TauxActuel || 0,
      IBAN: acc.IBAN || '',
      Plafond: acc.Plafond || '',
      Etablissement: acc.Etablissement || '',
      Couleur: acc.Couleur || '#0a6ed1'
    };
    isEditingAccount = true;
    isAccountDialogOpen = true;
    if (accountDialogRef && typeof accountDialogRef.show === 'function') {
      accountDialogRef.show();
    }
  }

  /**
   * Saves the account currently in the form (creates or updates).
   * @returns {Promise<void>}
   */
  async function saveAccount() {
    if (!isFormValid) {
      appState.showToast("Veuillez corriger les erreurs avant d'enregistrer.");
      return;
    }

    isAccountDialogOpen = false;
    if (accountDialogRef) {
      try {
        accountDialogRef.open = false;
        accountDialogRef.removeAttribute('open');
        if (typeof accountDialogRef.close === 'function') {
          accountDialogRef.close();
        }
      } catch (err) {
        console.error("Error closing account dialog:", err);
      }
    }

    appState.loading = true;
    try {
      let res;
      const payload = {
        Libelle: accountForm.Libelle,
        Type: accountForm.Type,
        SoldeActuel: parseFloat(accountForm.SoldeActuel || 0),
        TypePlacement: accountForm.TypePlacement || 'Courant',
        DateMaturite: accountForm.DateMaturite ? accountForm.DateMaturite : null,
        TauxActuel: parseFloat(accountForm.TauxActuel || 0),
        IBAN: accountForm.IBAN || null,
        Plafond: accountForm.Plafond ? parseFloat(accountForm.Plafond) : null,
        Etablissement: accountForm.Etablissement || null,
        Couleur: accountForm.Couleur || null
      };

      if (isEditingAccount) {
        res = await fetch(`/odata/v4/patrimoine/Accounts(${accountForm.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        payload.ID = appState.generateUUID();
        res = await fetch('/odata/v4/patrimoine/Accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        appState.showToast(isEditingAccount ? "Compte mis à jour." : "Compte créé.");
        await appState.loadData();
      } else {
        const err = await res.json();
        appState.showToast("Erreur: " + (err.error?.message || "Action impossible."));
      }
    } catch (e) {
      appState.showToast("Erreur lors de la sauvegarde.");
    } finally {
      appState.loading = false;
    }
  }

  /**
   * Deletes a bank account by ID.
   * @param {string} id - The UUID of the account to delete.
   * @returns {Promise<void>}
   */
  async function deleteAccount(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce compte ? Cela supprimera également les règles et abonnements liés.")) return;

    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/Accounts(${id})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        appState.showToast("Compte supprimé.");
        await appState.loadData();
      } else {
        appState.showToast("Impossible de supprimer ce compte.");
      }
    } catch (e) {
      appState.showToast("Erreur de suppression.");
    } finally {
      appState.loading = false;
    }
  }
</script>

<div class="page-title-container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
  <h1 class="page-title">{i18n.t('acc.manageTitle')}</h1>
  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    <ui5-button icon="synchronize" design="Transparent" title="Recalculer les soldes à partir du grand livre" onclick={() => appState.recomputeBalances()}>{i18n.t('acc.btnReconcile')}</ui5-button>
    <ui5-button icon="refresh" design="Transparent" title="Restaurer les 7 comptes de démonstration avec graphe et règles" onclick={() => appState.resetDemoData()}>{i18n.t('acc.btnDemo')}</ui5-button>
    <ui5-button icon="delete" design="Transparent" style="color: var(--sap-error-color);" title="Vider la base de données (mode vierge sans données)" onclick={() => { if (confirm(i18n.t('acc.btnClearConfirm'))) appState.clearAllData(); }}>{i18n.t('acc.btnClear')}</ui5-button>
    <ui5-button icon="add" design="Emphasized" onclick={openAddAccount}>{i18n.currentLang === 'fr' ? 'Nouveau Compte' : 'New Account'}</ui5-button>
  </div>
</div>

<!-- Accounts Quick Stats Header -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
  <div style="background: #ffffff; border-left: 4px solid var(--sap-primary-color); border-radius: 4px; padding: 12px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Comptes Courants</span>
    <span style="font-size: 18px; font-weight: bold; margin-top: 4px; color: var(--sap-text-color);">
      {appState.formatCurrency(appState.accounts.filter(a => a.TypePlacement === 'Courant').reduce((sum, a) => sum + parseFloat(a.SoldeActuel || 0), 0))}
    </span>
  </div>
  <div style="background: #ffffff; border-left: 4px solid #107e3e; border-radius: 4px; padding: 12px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Livrets & Épargne</span>
    <span style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #107e3e;">
      {appState.formatCurrency(appState.accounts.filter(a => a.TypePlacement === 'Epargne').reduce((sum, a) => sum + parseFloat(a.SoldeActuel || 0), 0))}
    </span>
  </div>
  <div style="background: #ffffff; border-left: 4px solid #e9730c; border-radius: 4px; padding: 12px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Portefeuille Actions</span>
    <span style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #e9730c;">
      {appState.formatCurrency(appState.accounts.filter(a => a.TypePlacement === 'Actions').reduce((sum, a) => sum + parseFloat(a.SoldeActuel || 0), 0))}
    </span>
  </div>
  <div style="background: #ffffff; border-left: 4px solid #6f42c1; border-radius: 4px; padding: 12px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Avoirs Bloqués (PEG)</span>
    <span style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #6f42c1;">
      {appState.formatCurrency(appState.accounts.filter(a => a.TypePlacement === 'Verrouille').reduce((sum, a) => sum + parseFloat(a.SoldeActuel || 0), 0))}
    </span>
  </div>
</div>

<div class="sap-card">
  <div class="sap-card-header">
    <span class="sap-card-title">{i18n.currentLang === 'fr' ? 'Liste de vos comptes enregistrés' : 'List of your registered accounts'}</span>
  </div>
  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th>Libellé & Établissement</th>
          <th>{i18n.currentLang === 'fr' ? 'Type de Compte' : 'Account Type'}</th>
          <th class="hide-on-mobile">IBAN</th>
          <th style="text-align: right; width: 240px;">{i18n.currentLang === 'fr' ? 'Solde Actuel & Plafond' : 'Current Balance & Ceiling'}</th>
          <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Devise' : 'Currency'}</th>
          <th style="text-align: right; width: 100px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.accounts as acc}
          <tr>
            <td style="font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 6px;">
                {#if acc.Couleur}
                  <span style="width: 10px; height: 10px; border-radius: 50%; background-color: {acc.Couleur}; display: inline-block; flex-shrink: 0;"></span>
                {/if}
                <span>{acc.Libelle}</span>
              </div>
              {#if acc.Etablissement}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-text-muted-color); margin-top: 2px;">
                  🏛️ {acc.Etablissement}
                </div>
              {/if}
              {#if acc.TypePlacement === 'Epargne'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-information-color); margin-top: 2px;">
                  Taux annuel: {acc.TauxActuel}%
                </div>
              {:else if acc.TypePlacement === 'Actions'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-critical-color); margin-top: 2px;">
                  Rendement estimé: {acc.TauxActuel}%
                </div>
              {:else if acc.TypePlacement === 'Verrouille'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-error-color); margin-top: 2px;">
                  Bloqué jusqu'au: {acc.DateMaturite || 'N/A'}
                </div>
              {/if}
            </td>
            <td><span class="badge" style="background-color: var(--sap-background-color); color: var(--sap-text-color);">{acc.Type}</span></td>
            <td class="hide-on-mobile" style="vertical-align: middle;">
              {#if acc.IBAN}
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-family: monospace; font-size: 11px; color: var(--sap-text-muted-color);">
                    {formatIban(acc.IBAN, revealedIbans[acc.ID])}
                  </span>
                  <ui5-button 
                    icon={revealedIbans[acc.ID] ? "hide" : "show"} 
                    design="Transparent" 
                    style="width: 22px; height: 22px; min-width: 22px;" 
                    title={revealedIbans[acc.ID] ? "Masquer l'IBAN (Sécurité RGPD)" : "Afficher l'IBAN complet"}
                    onclick={() => toggleRevealIban(acc.ID)}>
                  </ui5-button>
                </div>
              {:else}
                <span style="color: var(--sap-text-muted-color); font-size: 12px;">-</span>
              {/if}
            </td>
            <td style="text-align: right; font-weight: bold; vertical-align: middle;">
              {#if editingSoldeId === acc.ID}
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 4px;">
                  <ui5-input 
                    type="Number" 
                    value={editingSoldeVal} 
                    style="width: 100px; height: 32px;" 
                    oninput={(e) => editingSoldeVal = parseFloat(e.target.value || 0)}>
                  </ui5-input>
                  <ui5-button icon="accept" design="Positive" style="width: 28px; height: 28px; min-width: 28px;" onclick={() => saveInlineSolde(acc)}></ui5-button>
                  <ui5-button icon="decline" design="Transparent" style="width: 28px; height: 28px; min-width: 28px; color: var(--sap-error-color);" onclick={cancelInlineEdit}></ui5-button>
                </div>
              {:else}
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px;">
                  <span style="color: {acc.SoldeActuel < 0 ? 'var(--sap-error-color)' : 'var(--sap-text-color)'}">
                    {appState.formatCurrency(acc.SoldeActuel)}
                  </span>
                  <ui5-button icon="edit" design="Transparent" title="Modifier le solde rapidement" style="height: 20px; width: 20px; min-width: 20px;" onclick={() => startInlineEditSolde(acc)}></ui5-button>
                </div>
              {/if}
              {#if acc.Plafond && parseFloat(acc.Plafond) > 0}
                {@const ratio = Math.round((parseFloat(acc.SoldeActuel || 0) / parseFloat(acc.Plafond)) * 100)}
                <div style="margin-top: 4px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                  <div style="font-size: 11px; font-weight: normal; color: {ratio > 100 ? '#d9383a' : 'var(--sap-text-muted-color)'};">
                    {ratio}% du plafond ({appState.formatCurrency(acc.Plafond)})
                  </div>
                  <div style="width: 130px; background: #e5e7eb; border-radius: 4px; height: 5px; overflow: hidden;">
                    <div style="width: {Math.min(100, Math.max(0, ratio))}%; height: 100%; background: {ratio > 100 ? '#d9383a' : (ratio >= 85 ? '#e9730c' : '#107e3e')};"></div>
                  </div>
                </div>
              {/if}
            </td>
            <td class="hide-on-mobile">{acc.Devise}</td>
            <td style="text-align: right;">
              <ui5-button icon="edit" design="Transparent" onclick={() => openEditAccount(acc)}></ui5-button>
              <ui5-button icon="delete" design="Transparent" onclick={() => deleteAccount(acc.ID)}></ui5-button>
            </td>
          </tr>
        {/each}

        {#if appState.accounts.length === 0}
          <tr>
            <td colspan="6" style="text-align: center; color: var(--sap-text-muted-color); padding: 40px 0;">
              Aucun compte configuré. Veuillez cliquer sur "Nouveau Compte" pour commencer.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- ACCOUNTS DIALOG -->
<ui5-dialog open={isAccountDialogOpen || undefined} bind:this={accountDialogRef} header-text={isEditingAccount ? "Modifier le Compte" : "Ajouter un Compte"}>
  <div style="padding: 16px; width: 360px; display: flex; flex-direction: column; gap: 14px;">
    {#if !isEditingAccount}
      <div class="form-group">
        <label style="font-size: 12px; color: var(--sap-text-muted-color); margin-bottom: 4px; display: block;">Modèles rapides (France) :</label>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          {#each PRESETS as preset}
            <ui5-button design="Transparent" style="height: 26px; font-size: 11px; padding: 0 8px;" onclick={() => applyPreset(preset)}>{preset.label}</ui5-button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="form-group">
      <label for="acc-libelle">Libellé du compte</label>
      <ui5-input 
        id="acc-libelle" 
        value={accountForm.Libelle}
        value-state={libelleError ? "Error" : "None"}
        oninput={(e) => accountForm.Libelle = e.target.value}>
        {#if libelleError}
          <div slot="valueStateMessage">{libelleError}</div>
        {/if}
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="acc-etablissement">Établissement / Banque (optionnel)</label>
      <ui5-input 
        id="acc-etablissement" 
        value={accountForm.Etablissement}
        placeholder="Ex: Boursorama, SG, BNP, Bourse Direct..."
        oninput={(e) => accountForm.Etablissement = e.target.value}>
      </ui5-input>
    </div>
    
    <div class="form-group">
      <label for="acc-type">Type de Compte</label>
      <ui5-input 
        id="acc-type" 
        value={accountForm.Type} 
        show-suggestions
        placeholder="Ex: Compte Courant, Livret A, LDDS, PEA, PEE..."
        oninput={(e) => handleTypeInputChange(e.target.value)}>
        <ui5-suggestion-item text="Compte Courant"></ui5-suggestion-item>
        <ui5-suggestion-item text="Livret A"></ui5-suggestion-item>
        <ui5-suggestion-item text="LDDS (Livret Développement Durable)"></ui5-suggestion-item>
        <ui5-suggestion-item text="LEP (Livret d'Épargne Populaire)"></ui5-suggestion-item>
        <ui5-suggestion-item text="PEA (Bourse / Actions)"></ui5-suggestion-item>
        <ui5-suggestion-item text="Compte Titres (Bourse)"></ui5-suggestion-item>
        <ui5-suggestion-item text="PEE / PEG (Épargne Salariale)"></ui5-suggestion-item>
        <ui5-suggestion-item text="PER (Retraite)"></ui5-suggestion-item>
        <ui5-suggestion-item text="Assurance Vie"></ui5-suggestion-item>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="acc-placement">Catégorie de Placement</label>
      <ui5-select id="acc-placement" value={accountForm.TypePlacement} onchange={(e) => accountForm.TypePlacement = e.target.value}>
        <ui5-option selected={accountForm.TypePlacement === 'Courant' ? true : undefined} value="Courant">Compte Courant / Transit</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Epargne' ? true : undefined} value="Epargne">Livret d'Épargne (Taux Fixe)</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Actions' ? true : undefined} value="Actions">Bourse & Actions (Taux Performance Variable)</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Verrouille' ? true : undefined} value="Verrouille">Épargne Salariale / Fonds Bloqués</ui5-option>
      </ui5-select>
    </div>

    {#if accountForm.TypePlacement === 'Epargne' || accountForm.TypePlacement === 'Actions'}
      <div class="form-group">
        <label for="acc-taux">Taux d'Intérêt / Performance Annuelle (%)</label>
        <ui5-input 
          id="acc-taux" 
          type="Number" 
          value={accountForm.TauxActuel}
          oninput={(e) => accountForm.TauxActuel = parseFloat(e.target.value || 0)}>
        </ui5-input>
      </div>
    {/if}

    <div class="form-group">
      <label for="acc-plafond">Plafond Réglementaire ou d'Alerte (€, optionnel)</label>
      <ui5-input 
        id="acc-plafond" 
        type="Number"
        value={accountForm.Plafond}
        placeholder="Ex: 22950 (Livret A), 12000 (LDDS)..."
        oninput={(e) => accountForm.Plafond = e.target.value}>
      </ui5-input>
    </div>

    {#if accountForm.TypePlacement === 'Verrouille'}
      <div class="form-group">
        <label for="acc-maturite">Date de Déblocage (Maturité)</label>
        <ui5-input 
          id="acc-maturite" 
          type="Date" 
          value={accountForm.DateMaturite}
          oninput={(e) => accountForm.DateMaturite = e.target.value}>
        </ui5-input>
      </div>
    {/if}

    <div class="form-group">
      <label for="acc-iban">IBAN (optionnel)</label>
      <ui5-input 
        id="acc-iban" 
        value={accountForm.IBAN}
        placeholder="FR76..."
        value-state={ibanError ? "Error" : "None"}
        oninput={(e) => accountForm.IBAN = e.target.value}>
        {#if ibanError}
          <div slot="valueStateMessage">{ibanError}</div>
        {/if}
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="acc-solde">Solde Actuel (€)</label>
      <ui5-input 
        id="acc-solde" 
        type="Number" 
        value={accountForm.SoldeActuel}
        oninput={(e) => accountForm.SoldeActuel = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      isAccountDialogOpen = false;
      if (accountDialogRef && typeof accountDialogRef.close === 'function') accountDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveAccount} design="Emphasized" disabled={!isFormValid || undefined}>Enregistrer</ui5-button>
  </div>
</ui5-dialog>
