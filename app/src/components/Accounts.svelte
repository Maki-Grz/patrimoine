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
    Type: 'Courant',
    SoldeActuel: 0,
    TypePlacement: 'Courant',
    DateMaturite: '',
    TauxActuel: 0,
    IBAN: ''
  });

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
        accountForm.TauxActuel = 3.0; // standard livret rate
      }
    } else if (lowerVal.includes('pea') || lowerVal.includes('titre') || lowerVal.includes('actions') || lowerVal.includes('etf') || lowerVal.includes('bourse') || lowerVal.includes('placement') || lowerVal.includes('amundi')) {
      accountForm.TypePlacement = 'Actions';
      if (accountForm.TauxActuel === 0) {
        accountForm.TauxActuel = 5.0; // default stock performance estimation
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
      Type: 'Courant',
      SoldeActuel: 0,
      TypePlacement: 'Courant',
      DateMaturite: '',
      TauxActuel: 0,
      IBAN: ''
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
      IBAN: acc.IBAN || ''
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

    // Close the dialog immediately (optimistic UI)
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
        IBAN: accountForm.IBAN || null
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

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('acc.manageTitle')}</h1>
  <ui5-button icon="add" design="Emphasized" onclick={openAddAccount}>{i18n.currentLang === 'fr' ? 'Nouveau Compte' : 'New Account'}</ui5-button>
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
          <th>Libellé</th>
          <th>{i18n.currentLang === 'fr' ? 'Type de Compte' : 'Account Type'}</th>
          <th class="hide-on-mobile">IBAN</th>
          <th style="text-align: right; width: 220px;">{i18n.currentLang === 'fr' ? 'Solde Actuel' : 'Current Balance'}</th>
          <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Devise' : 'Currency'}</th>
          <th style="text-align: right; width: 100px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.accounts as acc}
          <tr>
            <td style="font-weight: 600;">
              {acc.Libelle}
              {#if acc.TypePlacement === 'Epargne'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-information-color); margin-top: 4px;">
                  Taux actuel: {acc.TauxActuel}%
                </div>
              {:else if acc.TypePlacement === 'Actions'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-critical-color); margin-top: 4px;">
                  Taux performance: {acc.TauxActuel}%
                </div>
              {:else if acc.TypePlacement === 'Verrouille'}
                <div style="font-weight: normal; font-size: 11px; color: var(--sap-error-color); margin-top: 4px;">
                  Bloqué jusqu'au: {acc.DateMaturite || 'N/A'}
                </div>
              {/if}
            </td>
            <td><span class="badge" style="background-color: var(--sap-background-color); color: var(--sap-text-color);">{acc.Type}</span></td>
            <td class="hide-on-mobile" style="font-family: monospace; font-size: 12px; color: var(--sap-text-muted-color);">{acc.IBAN || '-'}</td>
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
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
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
      <label for="acc-type">Type ou Catégorie de Compte</label>
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
      <label for="acc-placement">Type de Placement (Catégorie Globale)</label>
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
