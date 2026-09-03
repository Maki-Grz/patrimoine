<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Modal reference and state declarations
  let debitDialogRef = $state(null);
  let manualPaymentDialogRef = $state(null);

  let isDebitDialogOpen = $state(false);
  let isEditingDebit = $state(false);
  let isManualPaymentDialogOpen = $state(false);

  let selectedPaymentDebit = $state(null);
  let manualPaymentAmount = $state(0);
  let updateDefaultAmount = $state(false);

  let debitForm = $state({
    ID: '',
    Libelle: '',
    Montant: 0,
    JourDuMois: 5,
    Account_ID: '',
    Actif: true,
    Type: 'Automatique'
  });

  // Check if paid this month
  function isPaidThisMonth(dateStr) {
    if (!dateStr) return false;
    const paidDate = new Date(dateStr);
    const now = new Date();
    return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
  }

  // Open manual payment confirmation
  function openManualPaymentDialog(deb) {
    selectedPaymentDebit = deb;
    manualPaymentAmount = deb.Montant;
    updateDefaultAmount = false;
    isManualPaymentDialogOpen = true;
    if (manualPaymentDialogRef && typeof manualPaymentDialogRef.show === 'function') {
      manualPaymentDialogRef.show();
    }
  }

  // Confirm manual payment and patch record
  async function confirmManualPayment() {
    if (!selectedPaymentDebit) return;
    if (manualPaymentAmount <= 0) {
      appState.showToast("Le montant doit être supérieur à 0.");
      return;
    }
    
    appState.loading = true;
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      
      // 1. Record the transaction in Transactions table
      const txPayload = {
        ID: appState.generateUUID(),
        Date: new Date().toISOString().slice(0, 19) + 'Z',
        Libelle: `Virement manuel : ${selectedPaymentDebit.Libelle}`,
        Montant: parseFloat(manualPaymentAmount),
        Type: 'Sortie',
        Categorie: selectedPaymentDebit.Categorie || 'Factures',
        Statut: 'Execute',
        AccountSource_ID: selectedPaymentDebit.Account_ID,
        AccountTarget_ID: null
      };
      
      const txRes = await fetch('/odata/v4/patrimoine/Transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txPayload)
      });
      
      if (!txRes.ok) {
        appState.showToast("Erreur lors de l'enregistrement de la transaction.");
        return;
      }
      
      // 2. Update RecurringDebit last payment date and optionally default amount
      const debitUpdate = {
        DernierPaiementDate: todayDate
      };
      if (updateDefaultAmount) {
        debitUpdate.Montant = parseFloat(manualPaymentAmount);
      }
      
      const debRes = await fetch(`/odata/v4/patrimoine/RecurringDebits(${selectedPaymentDebit.ID})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(debitUpdate)
      });
      
      if (debRes.ok) {
        appState.showToast(`Virement pour "${selectedPaymentDebit.Libelle}" validé avec succès !`);
        isManualPaymentDialogOpen = false;
        if (manualPaymentDialogRef && typeof manualPaymentDialogRef.close === 'function') {
          manualPaymentDialogRef.close();
        }
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la mise à jour de l'abonnement.");
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Open add debit dialog
  function openAddDebit() {
    if (appState.accounts.length === 0) {
      appState.showToast("Créez d'abord un compte.");
      return;
    }
    debitForm = { 
      ID: '', 
      Libelle: '', 
      Montant: 0, 
      JourDuMois: 5, 
      Account_ID: appState.accounts[0].ID, 
      Actif: true, 
      Type: 'Automatique' 
    };
    isEditingDebit = false;
    isDebitDialogOpen = true;
    if (debitDialogRef && typeof debitDialogRef.show === 'function') {
      debitDialogRef.show();
    }
  }

  // Open edit debit dialog
  function openEditDebit(deb) {
    debitForm = { 
      ID: deb.ID, 
      Libelle: deb.Libelle,
      Montant: deb.Montant,
      JourDuMois: deb.JourDuMois,
      Account_ID: deb.Account_ID || (deb.Account ? deb.Account.ID : ''),
      Actif: deb.Actif,
      Type: deb.Type || 'Automatique'
    };
    isEditingDebit = true;
    isDebitDialogOpen = true;
    if (debitDialogRef && typeof debitDialogRef.show === 'function') {
      debitDialogRef.show();
    }
  }

  // Save debit record
  async function saveDebit() {
    if (!debitForm.Libelle) {
      appState.showToast("Le libellé est requis.");
      return;
    }
    if (parseFloat(debitForm.Montant) <= 0) {
      appState.showToast("Le montant doit être supérieur à 0.");
      return;
    }

    isDebitDialogOpen = false;
    if (debitDialogRef) {
      try {
        debitDialogRef.open = false;
        debitDialogRef.removeAttribute('open');
        if (typeof debitDialogRef.close === 'function') {
          debitDialogRef.close();
        }
      } catch (err) {
        console.error("Error closing debit dialog:", err);
      }
    }

    appState.loading = true;
    try {
      let res;
      const payload = {
        Libelle: debitForm.Libelle,
        Montant: parseFloat(debitForm.Montant),
        JourDuMois: parseInt(debitForm.JourDuMois),
        Account_ID: debitForm.Account_ID,
        Actif: debitForm.Actif,
        Type: debitForm.Type || 'Automatique'
      };

      if (isEditingDebit) {
        res = await fetch(`/odata/v4/patrimoine/RecurringDebits(${debitForm.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        payload.ID = appState.generateUUID();
        res = await fetch('/odata/v4/patrimoine/RecurringDebits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        appState.showToast("Charge récurrente sauvegardée.");
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la sauvegarde.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Switch toggle handler
  async function toggleDebitStatus(deb, event) {
    const isChecked = event.target.checked;
    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/RecurringDebits(${deb.ID})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Actif: isChecked })
      });
      if (res.ok) {
        appState.showToast(isChecked ? `Abonnement "${deb.Libelle}" activé.` : `Abonnement "${deb.Libelle}" désactivé.`);
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la modification de l'état.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Delete debit record
  async function deleteDebit(id) {
    if (!confirm("Supprimer cette charge récurrente ?")) return;

    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/RecurringDebits(${id})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        appState.showToast("Charge récurrente supprimée.");
        await appState.loadData();
      } else {
        appState.showToast("Erreur de suppression.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }
</script>

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('rec.periodTitle')}</h1>
  <ui5-button icon="add" design="Emphasized" onclick={openAddDebit}>Nouvelle Charge</ui5-button>
</div>

<!-- Section 1: Manual Transfers & Rents -->
<div class="sap-card" style="margin-bottom: 20px;">
  <div class="sap-card-header">
    <span class="sap-card-title">Virements Manuels & Loyers (À effectuer vous-même)</span>
    <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
      Ces charges requièrent une action manuelle de votre part chaque mois. Validez-les une fois le virement bancaire émis.
    </span>
  </div>
  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th>Nom de la charge</th>
          <th class="hide-on-mobile">Jour cible</th>
          <th class="hide-on-mobile">Compte Débité</th>
          <th>Montant Récurrent</th>
          <th>Statut ce mois-ci</th>
          <th style="text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.recurringDebits.filter(deb => deb.Type === 'Manuel') as deb}
          {@const paid = isPaidThisMonth(deb.DernierPaiementDate)}
          <tr>
            <td style="font-weight: 600;">{deb.Libelle}</td>
            <td class="hide-on-mobile">Le {deb.JourDuMois} du mois</td>
            <td class="hide-on-mobile">{deb.Account ? deb.Account.Libelle : 'Inconnu'}</td>
            <td style="font-weight: bold; color: var(--sap-error-color);">{appState.formatCurrency(deb.Montant)}</td>
            <td>
              {#if paid}
                <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">🟢 Payé</span>
              {:else}
                <span class="badge badge-error" style="font-size: 11px; padding: 4px 8px;">🔴 En attente</span>
              {/if}
            </td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 4px; justify-content: flex-end;">
                <ui5-button icon="edit" design="Transparent" onclick={() => openEditDebit(deb)} title="Modifier"></ui5-button>
                {#if !paid}
                  <ui5-button icon="sys-enter-2" design="Emphasized" onclick={() => openManualPaymentDialog(deb)}>
                    Marquer comme payé
                  </ui5-button>
                {:else}
                  <ui5-button icon="sys-enter-2" design="Transparent" disabled>
                    Payé
                  </ui5-button>
                {/if}
                <ui5-button icon="delete" design="Transparent" onclick={() => deleteDebit(deb.ID)} title="Supprimer"></ui5-button>
              </div>
            </td>
          </tr>
        {/each}
        {#if appState.recurringDebits.filter(deb => deb.Type === 'Manuel').length === 0}
          <tr>
            <td colspan="6" style="text-align: center; color: var(--sap-text-muted-color); padding: 20px 0;">
              Aucun virement manuel configuré.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- Section 2: Automatic Subscriptions -->
<div class="sap-card">
  <div class="sap-card-header">
    <span class="sap-card-title">Abonnements Automatiques (Prélèvements SEPA, etc.)</span>
    <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
      Ces charges sont débitées automatiquement. Aucun virement manuel n'est requis.
    </span>
  </div>
  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th>Nom de l'abonnement</th>
          <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Jour du mois' : 'Day of Month'}</th>
          <th class="hide-on-mobile">Compte Débité</th>
          <th>Montant Mensuel</th>
          <th>État Actif</th>
          <th style="text-align: right;">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.recurringDebits.filter(deb => deb.Type !== 'Manuel') as deb}
          <tr>
            <td style="font-weight: 600;">{deb.Libelle}</td>
            <td class="hide-on-mobile">Le {deb.JourDuMois} du mois</td>
            <td class="hide-on-mobile">{deb.Account ? deb.Account.Libelle : 'Inconnu'}</td>
            <td style="font-weight: bold; color: var(--sap-error-color);">{appState.formatCurrency(deb.Montant)}</td>
            <td>
              <ui5-switch 
                checked={deb.Actif ? true : undefined}
                onchange={(e) => toggleDebitStatus(deb, e)}>
              </ui5-switch>
            </td>
            <td style="text-align: right;">
              <ui5-button icon="edit" design="Transparent" onclick={() => openEditDebit(deb)}></ui5-button>
              <ui5-button icon="delete" design="Transparent" onclick={() => deleteDebit(deb.ID)}></ui5-button>
            </td>
          </tr>
        {/each}
        {#if appState.recurringDebits.filter(deb => deb.Type !== 'Manuel').length === 0}
          <tr>
            <td colspan="6" style="text-align: center; color: var(--sap-text-muted-color); padding: 20px 0;">
              Aucun abonnement automatique configuré.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- RECURRING DEBIT DIALOG -->
<ui5-dialog open={isDebitDialogOpen || undefined} bind:this={debitDialogRef} header-text={isEditingDebit ? "Modifier la Charge" : "Ajouter une Charge"}>
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="deb-libelle">Libellé</label>
      <ui5-input 
        id="deb-libelle" 
        value={debitForm.Libelle}
        oninput={(e) => debitForm.Libelle = e.target.value}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="deb-type">Type de Charge</label>
      <ui5-select id="deb-type" value={debitForm.Type} onchange={(e) => debitForm.Type = e.target.value}>
        <ui5-option selected={debitForm.Type === 'Automatique' ? true : undefined} value="Automatique">Prélèvement Automatique</ui5-option>
        <ui5-option selected={debitForm.Type === 'Manuel' ? true : undefined} value="Manuel">Virement Manuel (Loyer, etc.)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="deb-montant">Montant Mensuel (€)</label>
      <ui5-input 
        id="deb-montant" 
        type="Number" 
        value={debitForm.Montant}
        oninput={(e) => debitForm.Montant = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="deb-day">Jour de prélèvement dans le mois</label>
      <ui5-input 
        id="deb-day" 
        type="Number" 
        min="1" 
        max="31" 
        value={debitForm.JourDuMois}
        oninput={(e) => debitForm.JourDuMois = parseInt(e.target.value || 1)}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="deb-account">Compte Débiteur</label>
      <ui5-select id="deb-account" value={debitForm.Account_ID} onchange={(e) => debitForm.Account_ID = e.target.value}>
        {#each appState.accounts as acc}
          <ui5-option selected={debitForm.Account_ID === acc.ID ? true : undefined} value={acc.ID}>
            {acc.Libelle}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group" style="flex-direction: row; align-items: center; justify-content: space-between; margin-top: 8px;">
      <label for="deb-active">Abonnement Actif ?</label>
      <ui5-checkbox 
        id="deb-active" 
        checked={debitForm.Actif ? true : undefined}
        onchange={(e) => debitForm.Actif = e.target.checked}>
      </ui5-checkbox>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      isDebitDialogOpen = false;
      if (debitDialogRef && typeof debitDialogRef.close === 'function') debitDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveDebit} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>

<!-- MANUAL PAYMENT VALIDATION DIALOG -->
<ui5-dialog open={isManualPaymentDialogOpen || undefined} bind:this={manualPaymentDialogRef} header-text="Valider le Virement Manuel">
  {#if selectedPaymentDebit}
    <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
      <p style="margin: 0; font-size: 13px; color: var(--sap-text-muted-color); line-height: 1.4;">
        Enregistrement du virement pour <strong>{selectedPaymentDebit.Libelle}</strong>.
      </p>
      
      <div class="form-group">
        <label for="man-pay-amount">Montant payé ce mois-ci (€)</label>
        <ui5-input 
          id="man-pay-amount" 
          type="Number" 
          value={manualPaymentAmount}
          oninput={(e) => manualPaymentAmount = parseFloat(e.target.value || 0)}>
        </ui5-input>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <ui5-checkbox 
          id="man-pay-update-default" 
          text="Mettre à jour le montant récurrent par défaut"
          checked={updateDefaultAmount ? true : undefined}
          onchange={(e) => updateDefaultAmount = e.target.checked}>
        </ui5-checkbox>
      </div>
    </div>
    <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
      <ui5-button onclick={() => {
        isManualPaymentDialogOpen = false;
        if (manualPaymentDialogRef && typeof manualPaymentDialogRef.close === 'function') manualPaymentDialogRef.close();
      }} design="Transparent">Annuler</ui5-button>
      <ui5-button onclick={confirmManualPayment} design="Emphasized" disabled={manualPaymentAmount <= 0 || appState.loading || undefined}>
        Valider et Enregistrer
      </ui5-button>
    </div>
  {/if}
</ui5-dialog>
