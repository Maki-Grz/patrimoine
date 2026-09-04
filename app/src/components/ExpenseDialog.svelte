<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let dialogRef = $state(null);
  let formMontant = $state('');
  let formLibelle = $state('');
  let formCategorie = $state('Alimentation');
  let formAccountId = $state('');
  let formDate = $state(new Date().toISOString().slice(0, 10));

  const QUICK_LABELS = [
    { label: 'Courses Supermarché', cat: 'Alimentation' },
    { label: 'Déjeuner Restaurant', cat: 'Restaurant' },
    { label: 'Dîner Sortie', cat: 'Restaurant' },
    { label: 'Boulangerie', cat: 'Alimentation' },
    { label: 'Plein Carburant', cat: 'Transport' },
    { label: 'Pharmacie / Soins', cat: 'Sante' },
    { label: 'Shopping / Loisirs', cat: 'Loisirs' },
    { label: 'Dépense Imprévue', cat: 'Imprevu' }
  ];

  const CATEGORIES = [
    { id: 'Alimentation', label: '🛒 Alimentation & Courses' },
    { id: 'Restaurant', label: '🍽️ Restaurant & Sorties' },
    { id: 'Transport', label: '⛽ Carburant & Transports' },
    { id: 'Loisirs', label: '🛍️ Loisirs & Shopping' },
    { id: 'Sante', label: '💊 Santé & Pharmacie' },
    { id: 'Factures', label: '⚡ Factures Ponctuelles' },
    { id: 'Imprevu', label: '⚠️ Imprévus & Urgences' }
  ];

  // Watch modal open state
  $effect(() => {
    if (appState.isExpenseDialogOpen) {
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

  function applyQuickLabel(item) {
    formLibelle = item.label;
    formCategorie = item.cat;
  }

  function addAmount(delta) {
    const current = parseFloat(formMontant || 0);
    formMontant = (current + delta).toFixed(2);
  }

  function closeDialog() {
    appState.isExpenseDialogOpen = false;
    if (dialogRef) {
      dialogRef.open = false;
    }
  }

  async function handleSubmitExpense() {
    const amount = parseFloat(formMontant);
    if (isNaN(amount) || amount <= 0) {
      appState.showToast("Le montant doit être supérieur à 0.");
      return;
    }
    if (!formLibelle.trim()) {
      appState.showToast("Le libellé de la dépense est requis.");
      return;
    }
    if (!formAccountId) {
      appState.showToast("Veuillez sélectionner un compte à débiter.");
      return;
    }

    const success = await appState.createExpense({
      montant: amount,
      libelle: formLibelle.trim(),
      categorie: formCategorie,
      accountId: formAccountId,
      date: `${formDate}T${new Date().toISOString().slice(11, 19)}Z`
    });

    if (success) {
      formMontant = '';
      formLibelle = '';
      closeDialog();
    }
  }
</script>

<ui5-dialog
  bind:this={dialogRef}
  open={appState.isExpenseDialogOpen || undefined}
  header-text={i18n.t('expenses.dialogTitle')}
  onclose={closeDialog}
  style="--_ui5_dialog_content_min_width: 320px; --_ui5_dialog_content_max_width: 520px;"
>
  <div class="dialog-content" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
    <!-- Quick Label Suggestions -->
    <div class="form-group">
      <label style="font-size: 12px; color: var(--sap-text-muted-color); margin-bottom: 6px; display: block;">
        {i18n.t('expenses.quickModels')}
      </label>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        {#each QUICK_LABELS as item}
          <button
            type="button"
            class="preset-chip"
            onclick={() => applyQuickLabel(item)}
          >
            {item.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Amount input with quick pills -->
    <div class="form-group">
      <label for="exp-montant" class="form-label">
        {i18n.t('gen.amount')} (€) <span style="color: var(--sap-error-color);">*</span>
      </label>
      <div style="display: flex; gap: 8px; align-items: center;">
        <ui5-input
          id="exp-montant"
          type="Number"
          placeholder="Ex: 45.50"
          value={formMontant}
          oninput={(e) => formMontant = e.target.value}
          style="flex: 1; font-weight: bold; font-size: 15px;"
        ></ui5-input>
        <span style="font-weight: bold; font-size: 16px; color: var(--sap-text-color);">€</span>
      </div>
      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <button type="button" class="amount-pill" onclick={() => addAmount(10)}>+10 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(20)}>+20 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(50)}>+50 €</button>
        <button type="button" class="amount-pill" onclick={() => addAmount(100)}>+100 €</button>
      </div>
    </div>

    <!-- Label input -->
    <div class="form-group">
      <label for="exp-libelle" class="form-label">
        {i18n.t('gen.label')} <span style="color: var(--sap-error-color);">*</span>
      </label>
      <ui5-input
        id="exp-libelle"
        placeholder="Ex: Courses Supermarché, Restaurant..."
        value={formLibelle}
        oninput={(e) => formLibelle = e.target.value}
      ></ui5-input>
    </div>

    <!-- Category selector -->
    <div class="form-group">
      <label for="exp-categorie" class="form-label">{i18n.t('gen.type')}</label>
      <select
        id="exp-categorie"
        class="custom-select"
        value={formCategorie}
        onchange={(e) => formCategorie = e.target.value}
      >
        {#each CATEGORIES as cat}
          <option value={cat.id}>{cat.label}</option>
        {/each}
      </select>
    </div>

    <!-- Debited Account -->
    <div class="form-group">
      <label for="exp-account" class="form-label">{i18n.t('expenses.colAccount')}</label>
      <select
        id="exp-account"
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
      <label for="exp-date" class="form-label">{i18n.t('expenses.colDate')}</label>
      <input
        id="exp-date"
        type="date"
        class="custom-input-date"
        bind:value={formDate}
      />
    </div>
  </div>

  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px; display: flex; justify-content: flex-end; gap: 8px;">
    <ui5-button onclick={closeDialog} design="Transparent">{i18n.t('gen.cancel')}</ui5-button>
    <ui5-button
      onclick={handleSubmitExpense}
      design="Emphasized"
      disabled={!formMontant || !formLibelle.trim() || undefined}
    >
      🛒 {i18n.t('expenses.btnSubmit')}
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
    color: var(--sap-text-muted-color);
  }
  .preset-chip {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    padding: 4px 10px;
    font-size: 11px;
    color: #334155;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .preset-chip:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
  }
  .amount-pill {
    background: #eef2ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.15s;
  }
  .amount-pill:hover {
    background: #e0e7ff;
  }
  .custom-select, .custom-input-date {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    background-color: #ffffff;
    color: var(--sap-text-color);
    box-sizing: border-box;
  }
  .custom-select:focus, .custom-input-date:focus {
    outline: none;
    border-color: var(--sap-primary-color);
  }
</style>
