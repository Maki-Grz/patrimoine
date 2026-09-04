<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Local component filter states
  let selectedCategoryFilter = $state('TOUTES');
  let selectedTypeFilter = $state('TOUT');
  let searchQuery = $state('');

  const CATEGORIES = [
    { id: 'Alimentation', label: '🛒 Alimentation & Courses', color: '#107e3e' },
    { id: 'Restaurant', label: '🍽️ Restaurant & Sorties', color: '#e9730c' },
    { id: 'Transport', label: '⛽ Carburant & Transports', color: '#0a6ed1' },
    { id: 'Loisirs', label: '🛍️ Loisirs & Shopping', color: '#6f42c1' },
    { id: 'Sante', label: '💊 Santé & Pharmacie', color: '#20c997' },
    { id: 'Factures', label: '⚡ Factures Ponctuelles', color: '#17a2b8' },
    { id: 'Imprevu', label: '⚠️ Imprévus & Urgences', color: '#d9383a' }
  ];

  async function handleDeleteExpense(tx) {
    const isIncome = tx.Type === 'Entree';
    const actionDesc = isIncome ? "L'argent sera déduit du compte récepteur." : "Le compte débité sera recrédité.";
    if (!confirm(`Supprimer l'opération "${tx.Libelle}" (${appState.formatCurrency(tx.Montant)}) ? ${actionDesc}`)) return;

    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/Transactions(${tx.ID})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        appState.showToast(`Opération supprimée et solde réajusté.`);
        await appState.loadData();
      } else {
        appState.showToast("Impossible de supprimer l'opération.");
      }
    } catch (e) {
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Filtered transactions list (everyday expenses & extra incomes: excludes rent/housing and salary DAG items)
  let filteredExpenses = $derived.by(() => {
    let list = appState.transactions.filter(t => {
      // Exclude rent / fixed charges
      if (t.Categorie === 'Logement' || t.Libelle?.toLowerCase().includes('loyer') || t.Type === 'Charge_Fixe') {
        return false;
      }
      // If it's an income, exclude pure salary transfers
      if (t.Type === 'Entree' && (t.Libelle?.toLowerCase().includes('salaire') || t.Categorie === 'Salaire')) {
        return false;
      }
      if (selectedTypeFilter === 'Sortie') return t.Type === 'Sortie';
      if (selectedTypeFilter === 'Entree') return t.Type === 'Entree';
      return t.Type === 'Sortie' || t.Type === 'Entree';
    });

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
      Gérez les courses, restaurants, rentrées d'argent (CAF, etc.) et dépenses courantes du mois pour préserver vos soldes.
    </span>
  </div>
  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    <ui5-button icon="add" design="Positive" onclick={() => appState.isIncomeDialogOpen = true}>
      📥 {i18n.t('income.addBtn')}
    </ui5-button>
    <ui5-button icon="add" design="Emphasized" onclick={() => appState.isExpenseDialogOpen = true}>
      🛒 {i18n.t('expenses.newBtn')}
    </ui5-button>
  </div>
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
      <ui5-select onchange={(e) => selectedTypeFilter = e.target.value} style="height: 32px;">
        <ui5-option value="TOUT" selected={selectedTypeFilter === 'TOUT' ? true : undefined}>{i18n.t('expenses.filterAll')}</ui5-option>
        <ui5-option value="Sortie" selected={selectedTypeFilter === 'Sortie' ? true : undefined}>{i18n.t('expenses.filterExpenses')}</ui5-option>
        <ui5-option value="Entree" selected={selectedTypeFilter === 'Entree' ? true : undefined}>{i18n.t('expenses.filterIncomes')}</ui5-option>
      </ui5-select>
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
          {@const isIncome = tx.Type === 'Entree'}
          {@const relevantAcc = appState.accounts.find(a => a.ID === (isIncome ? tx.AccountTarget_ID : tx.AccountSource_ID))}
          {@const catMeta = CATEGORIES.find(c => c.id === tx.Categorie)}
          <tr>
            <td style="font-size: 12px; color: var(--sap-text-muted-color); vertical-align: middle;">
              {tx.Date ? new Date(tx.Date).toLocaleDateString(i18n.currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                <span>{tx.Libelle}</span>
                {#if isIncome}
                  <span class="badge" style="background-color: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; font-size: 10px; padding: 2px 6px;">
                    📥 Entrée
                  </span>
                {/if}
              </div>
              {#if catMeta}
                <div style="font-size: 11px; color: {catMeta.color}; font-weight: 500;">
                  {catMeta.label}
                </div>
              {:else if tx.Categorie}
                <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: 500;">
                  {tx.Categorie}
                </div>
              {/if}
            </td>
            <td class="hide-on-mobile" style="vertical-align: middle; font-size: 13px;">
              {#if relevantAcc}
                <span class="badge" style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">
                  {relevantAcc.Libelle}
                </span>
              {:else}
                <span style="color: var(--sap-text-muted-color);">-</span>
              {/if}
            </td>
            <td style="text-align: right; font-weight: bold; color: {isIncome ? '#107e3e' : '#d9383a'}; vertical-align: middle; font-size: 14px;">
              {isIncome ? '+ ' : '- '}{appState.formatCurrency(tx.Montant)}
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
