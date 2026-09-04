<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let dialogRef = $state(null);
  let formMontant = $state('');
  let formLibelle = $state('');
  let formCategorie = $state('CAF / Aides');
  let formAccountId = $state('');
  let formDate = $state(new Date().toISOString().slice(0, 10));

  // Initialize default account to first checking account
  $effect(() => {
    if (appState.accounts.length > 0 && !formAccountId) {
      const checking = appState.accounts.find(a => a.TypePlacement === 'Courant');
      formAccountId = checking ? checking.ID : appState.accounts[0].ID;
    }
  });

  // Watch modal open state
  $effect(() => {
    if (appState.isIncomeDialogOpen) {
      if (!formAccountId && appState.accounts.length > 0) {
        const checking = appState.accounts.find(a => a.TypePlacement === 'Courant');
        formAccountId = checking ? checking.ID : appState.accounts[0].ID;
      }
      formDate = new Date().toISOString().slice(0, 10);
      if (dialogRef) {
        dialogRef.open = true;
      }
    } else {
      if (dialogRef) {
        dialogRef.open = false;
      }
    }
  });

  const QUICK_PRESETS = [
    { label: 'Virement CAF', cat: 'CAF / Aides', icon: '🏛️' },
    { label: 'Aide au Logement (APL)', cat: 'CAF / Aides', icon: '🏠' },
    { label: 'Prime d\'activité', cat: 'CAF / Aides', icon: '💼' },
    { label: 'Remboursement Mutuelle / Santé', cat: 'Remboursement', icon: '🏥' },
    { label: 'Cadeau / Virement', cat: 'Cadeau', icon: '🎁' },
    { label: 'Vente d\'occasion', cat: 'Vente', icon: '💶' }
  ];

  const CATEGORIES = [
    { id: 'CAF / Aides', label: '🏛️ CAF / Aides sociales' },
    { id: 'Remboursement', label: '🏥 Remboursement Mutuelle / Santé' },
    { id: 'Revenu', label: '💰 Autre Revenu' },
    { id: 'Prime', label: '💼 Prime / Bonus' },
    { id: 'Cadeau', label: '🎁 Cadeau / Don' },
    { id: 'Vente', label: '💶 Vente d\'occasion' },
    { id: 'Autre', label: '⚡ Autre rentrée' }
  ];

  function applyPreset(preset) {
    formLibelle = preset.label;
    formCategorie = preset.cat;
  }

  function addAmount(delta) {
    const cur = parseFloat(formMontant || 0);
    formMontant = (cur + delta).toFixed(2);
  }

  function closeDialog() {
    appState.isIncomeDialogOpen = false;
    if (dialogRef) {
      dialogRef.open = false;
    }
  }

  async function handleSubmitIncome() {
    const amount = parseFloat(formMontant);
    if (isNaN(amount) || amount <= 0) {
      appState.showToast("Le montant doit être supérieur à 0.");
      return;
    }
    if (!formLibelle.trim()) {
      appState.showToast("Le libellé de la rentrée est obligatoire.");
      return;
    }
    if (!formAccountId) {
      appState.showToast("Veuillez sélectionner un compte récepteur.");
      return;
    }

    const ok = await appState.createIncome({
      montant: amount,
      libelle: formLibelle.trim(),
      categorie: formCategorie,
      accountTargetId: formAccountId,
      date: formDate
    });

    if (ok) {
      formMontant = '';
      formLibelle = '';
      closeDialog();
    }
  }
</script>

<ui5-dialog
  bind:this={dialogRef}
  open={appState.isIncomeDialogOpen || undefined}
  header-text={i18n.t('income.dialogTitle')}
  onclose={closeDialog}
  style="--_ui5_dialog_content_min_width: 320px; --_ui5_dialog_content_max_width: 540px;"
>
  <div class="dialog-content" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
    <p style="font-size: 13px; color: var(--sap-text-muted-color); margin: 0;">
      {i18n.t('income.subtitle')}
    </p>

    <!-- Quick Suggestions -->
    <div>
      <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: var(--sap-text-color);">
        ⚡ Suggestions rapides :
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        {#each QUICK_PRESETS as preset}
          <button
            type="button"
            class="preset-chip"
            onclick={() => applyPreset(preset)}
          >
            {preset.icon} {preset.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Amount input with quick pills -->
    <div class="form-group">
      <label for="income-montant" class="form-label">
        {i18n.t('income.amountLabel')} <span style="color: var(--sap-error-color);">*</span>
      </label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <ui5-input
          id="income-montant"
          type="Number"
          placeholder="0.00"
          value={formMontant}
          oninput={(e) => formMontant = e.target.value}
          style="flex: 1; font-weight: bold; font-size: 15px;"
        ></ui5-input>
        <span style="font-weight: bold; font-size: 16px; color: var(--sap-text-color);">€</span>
      </div>
      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <button type="button" class="amount-pill" onclick={() => addAmount(50)}>+50 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(100)}>+100 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(200)}>+200 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(500)}>+500 €</button>
      </div>
    </div>

    <!-- Label input -->
    <div class="form-group">
      <label for="income-libelle" class="form-label">
        {i18n.t('income.labelLabel')} <span style="color: var(--sap-error-color);">*</span>
      </label>
      <ui5-input
        id="income-libelle"
        placeholder="Ex: Virement CAF, Remboursement CPAM, Prime..."
        value={formLibelle}
        oninput={(e) => formLibelle = e.target.value}
      ></ui5-input>
    </div>

    <!-- Category selection -->
    <div class="form-group">
      <label for="income-cat" class="form-label">{i18n.t('income.categoryLabel')}</label>
      <select
        id="income-cat"
        class="custom-select"
        value={formCategorie}
        onchange={(e) => formCategorie = e.target.value}
      >
        {#each CATEGORIES as cat}
          <option value={cat.id}>{cat.label}</option>
        {/each}
      </select>
    </div>

    <!-- Target Account selection -->
    <div class="form-group">
      <label for="income-account" class="form-label">
        {i18n.t('income.targetAccount')} <span style="color: var(--sap-error-color);">*</span>
      </label>
      <select
        id="income-account"
        class="custom-select"
        value={formAccountId}
        onchange={(e) => formAccountId = e.target.value}
      >
        {#each appState.accounts as acc}
          <option value={acc.ID}>
            {acc.Libelle} ({appState.formatCurrency(acc.SoldeActuel)})
          </option>
        {/each}
      </select>
    </div>

    <!-- Date input -->
    <div class="form-group">
      <label for="income-date" class="form-label">{i18n.t('income.dateLabel')}</label>
      <input
        id="income-date"
        type="date"
        class="custom-input-date"
        bind:value={formDate}
      />
    </div>

    <!-- Information message -->
    <div style="background: rgba(16, 126, 62, 0.08); border-left: 4px solid #107e3e; border-radius: 4px; padding: 10px 12px; font-size: 12px; color: #107e3e; display: flex; gap: 8px; align-items: flex-start;">
      <span style="font-size: 16px;">💡</span>
      <span>{i18n.t('income.notice')}</span>
    </div>
  </div>

  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px; display: flex; justify-content: flex-end; gap: 8px;">
    <ui5-button onclick={closeDialog} design="Transparent">{i18n.t('gen.cancel')}</ui5-button>
    <ui5-button
      onclick={handleSubmitIncome}
      design="Emphasized"
      disabled={!formMontant || !formLibelle.trim() || undefined}
    >
      📥 {i18n.t('income.btnSubmit')}
    </ui5-button>
  </div>
</ui5-dialog>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--sap-text-color);
  }
  .custom-select, .custom-input-date {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid var(--sap-border-color);
    border-radius: 4px;
    background: var(--sap-background-color);
    color: var(--sap-text-color);
    box-sizing: border-box;
  }
  .custom-select:focus, .custom-input-date:focus {
    outline: none;
    border-color: var(--sap-primary-color);
  }
  .preset-chip {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--sap-text-color);
    cursor: pointer;
    transition: all 0.2s;
  }
  .preset-chip:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
  }
  .amount-pill {
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    color: #4338ca;
    cursor: pointer;
    transition: background 0.15s;
  }
  .amount-pill:hover {
    background: #e0e7ff;
  }
</style>
