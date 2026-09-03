<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Local component states
  let isExpenseDialogOpen = $state(false);
  let expenseDialogRef = $state(null);
  let selectedCategoryFilter = $state('TOUTES');
  let searchQuery = $state('');

  // Form states
  let formMontant = $state('');
  let formLibelle = $state('');
  let formCategorie = $state('Alimentation');
  let formAccountId = $state('');
  let formDate = $state(new Date().toISOString().slice(0, 10));

  // Initialize default account to first checking account
  $effect(() => {
    if (appState.accounts.length > 0 && !formAccountId) {
      const checking = appState.accounts.find(a => a.TypePlacement === 'Courant');
      formAccountId = checking ? checking.ID : appState.accounts[0].ID;
    }
  });

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
    { id: 'Alimentation', label: '🛒 Alimentation & Courses', color: '#107e3e' },
    { id: 'Restaurant', label: '🍽️ Restaurant & Sorties', color: '#e9730c' },
    { id: 'Transport', label: '⛽ Carburant & Transports', color: '#0a6ed1' },
    { id: 'Loisirs', label: '🛍️ Loisirs & Shopping', color: '#6f42c1' },
    { id: 'Sante', label: '💊 Santé & Pharmacie', color: '#20c997' },
    { id: 'Factures', label: '⚡ Factures Ponctuelles', color: '#17a2b8' },
    { id: 'Imprevu', label: '⚠️ Imprévus & Urgences', color: '#d9383a' }
  ];

  function openNewExpenseDialog() {
    formMontant = '';
    formLibelle = '';
    formCategorie = 'Alimentation';
    formDate = new Date().toISOString().slice(0, 10);
    const checking = appState.accounts.find(a => a.TypePlacement === 'Courant');
    formAccountId = checking ? checking.ID : (appState.accounts[0]?.ID || '');
    isExpenseDialogOpen = true;
    if (expenseDialogRef && typeof expenseDialogRef.show === 'function') {
      expenseDialogRef.show();
    }
  }

  function applyQuickLabel(item) {
    formLibelle = item.label;
    formCategorie = item.cat;
  }

  function addAmount(delta) {
    const current = parseFloat(formMontant || 0);
    formMontant = (current + delta).toFixed(2);
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

    isExpenseDialogOpen = false;
    if (expenseDialogRef && typeof expenseDialogRef.close === 'function') {
      expenseDialogRef.close();
    }

    await appState.createExpense({
      montant: amount,
      libelle: formLibelle.trim(),
      categorie: formCategorie,
      accountId: formAccountId,
      date: `${formDate}T${new Date().toISOString().slice(11, 19)}Z`
    });
  }

  async function handleDeleteExpense(tx) {
    if (!confirm(`Supprimer la dépense "${tx.Libelle}" (${appState.formatCurrency(tx.Montant)}) ? Le compte sera recrédité.`)) return;

    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/Transactions(${tx.ID})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        appState.showToast(`Dépense supprimée et solde réajusté.`);
        await appState.loadData();
      } else {
        appState.showToast("Impossible de supprimer la dépense.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Filtered expenses list (everyday expenses only: excludes rent/housing and fixed charges)
  let filteredExpenses = $derived.by(() => {
    let list = appState.transactions.filter(t => 
      t.Type === 'Sortie' && 
      t.Categorie !== 'Logement' && 
      !t.Libelle?.toLowerCase().includes('loyer') &&
      t.Type !== 'Charge_Fixe'
    );
    if (selectedCategoryFilter !== 'TOUTES') {
      list = list.filter(t => t.Categorie === selectedCategoryFilter);
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => (t.Libelle && t.Libelle.toLowerCase().includes(q)));
    }
    return list;
  });

  // Calculate percentage of living budget used
  let budgetPct = $derived.by(() => {
    if (!appState.budgetSummary || !appState.budgetSummary.budgetTotal) return 0;
    return Math.round((appState.budgetSummary.depensesCeMois / appState.budgetSummary.budgetTotal) * 100);
  });
</script>

<div class="page-title-container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
  <div>
    <h1 class="page-title">🛒 Dépenses Quotidiennes & Reste à Vivre</h1>
    <span style="font-size: 13px; color: var(--sap-text-muted-color);">
      Gérez les courses, restaurants et dépenses courantes du mois pour préserver vos soldes.
    </span>
  </div>
  <ui5-button icon="add" design="Emphasized" onclick={openNewExpenseDialog}>
     Nouvelle Dépense
  </ui5-button>
</div>

<!-- TOP KPI CARDS : LIVING BUDGET & REMAINING ALLOWANCE -->
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
  <!-- Card 1 : Budget du Mois -->
  <div style="background: #ffffff; border-left: 4px solid var(--sap-primary-color); border-radius: 6px; padding: 14px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Budget Mensuel de Vie</span>
    <span style="font-size: 22px; font-weight: bold; margin-top: 4px; color: var(--sap-text-color);">
      {appState.formatCurrency(appState.budgetSummary?.budgetTotal || 800)}
    </span>
    <span style="font-size: 11px; color: var(--sap-text-muted-color); margin-top: 4px;">
      Matelas de sécurité réservé : {appState.formatCurrency(appState.budgetSummary?.matelasSecurite || 500)}
    </span>
  </div>

  <!-- Card 2 : Dépensé ce mois-ci -->
  <div style="background: #ffffff; border-left: 4px solid {budgetPct > 100 ? '#d9383a' : (budgetPct >= 80 ? '#e9730c' : '#0a6ed1')}; border-radius: 6px; padding: 14px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Dépensé ce mois-ci</span>
    <span style="font-size: 22px; font-weight: bold; margin-top: 4px; color: {budgetPct > 100 ? '#d9383a' : 'var(--sap-text-color)'};">
      {appState.formatCurrency(appState.budgetSummary?.depensesCeMois || 0)}
    </span>
    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
      <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden;">
        <div style="width: {Math.min(100, Math.max(0, budgetPct))}%; height: 100%; background: {budgetPct > 100 ? '#d9383a' : (budgetPct >= 80 ? '#e9730c' : '#107e3e')};"></div>
      </div>
      <span style="font-size: 11px; font-weight: bold; color: {budgetPct > 100 ? '#d9383a' : 'var(--sap-text-muted-color)'};">{budgetPct}%</span>
    </div>
  </div>

  <!-- Card 3 : Reste à Vivre -->
  <div style="background: #ffffff; border-left: 4px solid {(appState.budgetSummary?.resteAVivre || 0) < 0 ? '#d9383a' : '#107e3e'}; border-radius: 6px; padding: 14px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Reste à Vivre Disponible</span>
    <span style="font-size: 22px; font-weight: bold; margin-top: 4px; color: {(appState.budgetSummary?.resteAVivre || 0) < 0 ? '#d9383a' : '#107e3e'};">
      {appState.formatCurrency(appState.budgetSummary?.resteAVivre || 0)}
    </span>
    <span style="font-size: 11px; color: var(--sap-text-muted-color); margin-top: 4px;">
      {(appState.budgetSummary?.resteAVivre || 0) < 0 ? '⚠️ Budget dépassé' : '🟢 Budget maîtrisé'}
    </span>
  </div>

  <!-- Card 4 : Rythme Journalier -->
  <div style="background: #ffffff; border-left: 4px solid #8950fc; border-radius: 6px; padding: 14px; box-shadow: var(--sap-shadow-card); display: flex; flex-direction: column;">
    <span style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Rythme Journalier Conseillé</span>
    <span style="font-size: 22px; font-weight: bold; margin-top: 4px; color: #8950fc;">
      {appState.formatCurrency(appState.budgetSummary?.rythmeJournalier || 0)} <span style="font-size: 13px; font-weight: normal; color: var(--sap-text-muted-color);">/ jour</span>
    </span>
    <span style="font-size: 11px; color: var(--sap-text-muted-color); margin-top: 4px;">
      Sur les {appState.budgetSummary?.joursRestants || 0} jours restants avant la paie
    </span>
  </div>
</div>

<!-- CATEGORY BREAKDOWN -->
{#if appState.budgetSummary && appState.budgetSummary.parCategorie}
  <div class="sap-card" style="margin-bottom: 20px;">
    <div class="sap-card-header">
      <span class="sap-card-title">Ventilation des Dépenses par Poste</span>
    </div>
    <div class="sap-card-body">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
        {#each CATEGORIES as cat}
          {@const spent = appState.budgetSummary.parCategorie[cat.id] || 0}
          {@const totalSpent = appState.budgetSummary.depensesCeMois || 1}
          {@const pct = Math.round((spent / totalSpent) * 100)}
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; font-weight: 600;">{cat.label}</span>
              <span style="font-size: 14px; font-weight: bold; color: {cat.color};">{appState.formatCurrency(spent)}</span>
            </div>
            <div style="width: 100%; background: #e2e8f0; border-radius: 3px; height: 5px; overflow: hidden;">
              <div style="width: {pct}%; height: 100%; background: {cat.color};"></div>
            </div>
            <span style="font-size: 11px; color: var(--sap-text-muted-color); text-align: right;">{pct}% des dépenses du mois</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- EXPENSES HISTORY & ACTIONS TABLE -->
<div class="sap-card">
  <div class="sap-card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
    <span class="sap-card-title">{i18n.t('expenses.history')} ({filteredExpenses.length})</span>
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <ui5-input
        placeholder={i18n.t('expenses.searchPlaceholder')}
        value={searchQuery}
        style="width: 180px; height: 32px;"
        oninput={(e) => searchQuery = e.target.value}>
      </ui5-input>
      <ui5-select onchange={(e) => selectedCategoryFilter = e.target.value} style="height: 32px;">
        <ui5-option value="TOUTES" selected={selectedCategoryFilter === 'TOUTES' ? true : undefined}>{i18n.t('expenses.allCategories')}</ui5-option>
        {#each CATEGORIES as cat}
          <ui5-option value={cat.id} selected={selectedCategoryFilter === cat.id ? true : undefined}>{cat.label}</ui5-option>
        {/each}
      </ui5-select>
    </div>
  </div>
  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th style="width: 110px;">{i18n.t('expenses.colDate')}</th>
          <th>{i18n.t('expenses.colLabel')}</th>
          <th class="hide-on-mobile">{i18n.t('expenses.colAccount')}</th>
          <th style="text-align: right; width: 140px;">{i18n.t('expenses.colAmount')}</th>
          <th style="text-align: right; width: 80px;">{i18n.t('expenses.colAction')}</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredExpenses as tx}
          {@const sourceAcc = appState.accounts.find(a => a.ID === tx.AccountSource_ID)}
          {@const catMeta = CATEGORIES.find(c => c.id === tx.Categorie)}
          <tr>
            <td style="font-size: 12px; color: var(--sap-text-muted-color); vertical-align: middle;">
              {tx.Date ? new Date(tx.Date).toLocaleDateString(i18n.currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: 600;">{tx.Libelle}</div>
              {#if catMeta}
                <div style="font-size: 11px; color: {catMeta.color}; font-weight: 500;">
                  {catMeta.label}
                </div>
              {/if}
            </td>
            <td class="hide-on-mobile" style="vertical-align: middle; font-size: 13px;">
              {#if sourceAcc}
                <span class="badge" style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">
                  {sourceAcc.Libelle}
                </span>
              {:else}
                <span style="color: var(--sap-text-muted-color);">-</span>
              {/if}
            </td>
            <td style="text-align: right; font-weight: bold; color: #d9383a; vertical-align: middle; font-size: 14px;">
              - {appState.formatCurrency(tx.Montant)}
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <ui5-button
                icon="delete"
                design="Transparent"
                style="color: var(--sap-error-color);"
                title={i18n.t('gen.delete')}
                onclick={() => handleDeleteExpense(tx)}>
              </ui5-button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" style="text-align: center; color: var(--sap-text-muted-color); padding: 24px;">
              {i18n.t('expenses.empty')}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- QUICK EXPENSE DIALOG -->
<ui5-dialog open={isExpenseDialogOpen || undefined} bind:this={expenseDialogRef} header-text={i18n.t('expenses.dialogTitle')}>
  <div style="padding: 16px; width: 360px; display: flex; flex-direction: column; gap: 14px;">
    <!-- Quick Label Suggestions -->
    <div class="form-group">
      <label style="font-size: 12px; color: var(--sap-text-muted-color); margin-bottom: 4px; display: block;">{i18n.t('expenses.quickModels')}</label>
      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
        {#each QUICK_LABELS as item}
          <ui5-button design="Transparent" style="height: 26px; font-size: 11px; padding: 0 8px;" onclick={() => applyQuickLabel(item)}>
            {item.label}
          </ui5-button>
        {/each}
      </div>
    </div>

    <!-- Montant avec raccourcis -->
    <div class="form-group">
      <label for="exp-montant">{i18n.t('gen.amount')} (€) *</label>
      <ui5-input
        id="exp-montant"
        type="Number"
        value={formMontant}
        placeholder="Ex: 45.50"
        oninput={(e) => formMontant = e.target.value}>
      </ui5-input>
      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <ui5-button design="Transparent" style="height: 24px; font-size: 11px;" onclick={() => addAmount(10)}>+10 €</ui5-button>
        <ui5-button design="Transparent" style="height: 24px; font-size: 11px;" onclick={() => addAmount(20)}>+20 €</ui5-button>
        <ui5-button design="Transparent" style="height: 24px; font-size: 11px;" onclick={() => addAmount(50)}>+50 €</ui5-button>
        <ui5-button design="Transparent" style="height: 24px; font-size: 11px;" onclick={() => addAmount(100)}>+100 €</ui5-button>
      </div>
    </div>

    <!-- Libelle -->
    <div class="form-group">
      <label for="exp-libelle">{i18n.t('gen.label')} *</label>
      <ui5-input
        id="exp-libelle"
        value={formLibelle}
        placeholder="Ex: Courses Carrefour, Bistro & Co..."
        oninput={(e) => formLibelle = e.target.value}>
      </ui5-input>
    </div>

    <!-- Categorie -->
    <div class="form-group">
      <label for="exp-categorie">{i18n.t('gen.type')}</label>
      <ui5-select id="exp-categorie" value={formCategorie} onchange={(e) => formCategorie = e.target.value}>
        {#each CATEGORIES as cat}
          <ui5-option value={cat.id} selected={formCategorie === cat.id ? true : undefined}>{cat.label}</ui5-option>
        {/each}
      </ui5-select>
    </div>

    <!-- Compte Source -->
    <div class="form-group">
      <label for="exp-account">{i18n.t('expenses.colAccount')}</label>
      <ui5-select id="exp-account" value={formAccountId} onchange={(e) => formAccountId = e.target.value}>
        {#each appState.accounts as acc}
          <ui5-option value={acc.ID} selected={formAccountId === acc.ID ? true : undefined}>
            {acc.Libelle} ({appState.formatCurrency(acc.SoldeActuel)})
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <!-- Date -->
    <div class="form-group">
      <label for="exp-date">{i18n.t('expenses.colDate')}</label>
      <ui5-input
        id="exp-date"
        type="Date"
        value={formDate}
        oninput={(e) => formDate = e.target.value}>
      </ui5-input>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      isExpenseDialogOpen = false;
      if (expenseDialogRef && typeof expenseDialogRef.close === 'function') expenseDialogRef.close();
    }} design="Transparent">{i18n.t('gen.cancel')}</ui5-button>
    <ui5-button onclick={handleSubmitExpense} design="Emphasized" disabled={!formMontant || !formLibelle.trim() || undefined}>
      {i18n.t('expenses.btnSubmit')}
    </ui5-button>
  </div>
</ui5-dialog>
