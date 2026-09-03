<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Derived KPIs
  let totalWealth = $derived(appState.accounts.reduce((sum, acc) => sum + parseFloat(acc.SoldeActuel || 0), 0));
  let totalSavings = $derived(appState.accounts.filter(acc => acc.Type !== 'Courant').reduce((sum, acc) => sum + parseFloat(acc.SoldeActuel || 0), 0));
  let totalCharges = $derived(appState.recurringDebits.filter(deb => deb.Actif).reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0));

  // Color Palette for charts
  const COLORS = ['#0a6ed1', '#107e3e', '#e9730c', '#6f42c1', '#17a2b8', '#007bff', '#28a745', '#ffc107', '#dc3545'];

  function getColor(index) {
    return COLORS[index % COLORS.length];
  }

  function getCoordinatesForPercent(percent) {
    const x = Math.cos(2 * Math.PI * percent - Math.PI / 2);
    const y = Math.sin(2 * Math.PI * percent - Math.PI / 2);
    return [x, y];
  }

  let chartPaths = $derived.by(() => {
    if (totalWealth <= 0) return [];
    let cumulativePercent = 0;
    const activeAccounts = appState.accounts.filter(a => parseFloat(a.SoldeActuel) > 0);

    return activeAccounts.map((account, index) => {
      const percent = parseFloat(account.SoldeActuel) / totalWealth;
      const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
      cumulativePercent += percent;
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

      const largeArcFlag = percent > 0.5 ? 1 : 0;
      const r = 80;

      const startXScaled = startX * r;
      const startYScaled = startY * r;
      const endXScaled = endX * r;
      const endYScaled = endY * r;

      let pathData;
      if (percent >= 0.999) {
        pathData = `M 0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r} Z`;
      } else {
        pathData = `M 0 0 L ${startXScaled} ${startYScaled} A ${r} ${r} 0 ${largeArcFlag} 1 ${endXScaled} ${endYScaled} Z`;
      }

      return {
        d: pathData,
        color: getColor(index),
        libelle: account.Libelle,
        solde: account.SoldeActuel,
        percent: (percent * 100).toFixed(1)
      };
    });
  });

  // 5-Year Wealth Evolution Simulation
  let projectionData = $derived.by(() => {
    let years = [];
    const currentYear = new Date().getFullYear();
    const yearlyNetSalary = appState.salaryConfig ? parseFloat(appState.salaryConfig.MontantNet || 0) * 12 : appState.currentSalaryAmount * 12;
    const yearlyCharges = totalCharges * 12;

    // Copy initial balances
    let balances = appState.accounts.map(a => ({
      id: a.ID,
      solde: parseFloat(a.SoldeActuel || 0),
      type: a.TypePlacement,
      taux: parseFloat(a.TauxActuel || 0)
    }));

    for (let y = 0; y <= 5; y++) {
      if (y === 0) {
        const total = balances.reduce((sum, b) => sum + b.solde, 0);
        years.push({
          label: `${currentYear}`,
          wealth: Math.max(0, Math.round(total))
        });
      } else {
        // Compound rates for savings/actions
        balances.forEach(b => {
          if (b.type === 'Epargne' || b.type === 'Actions') {
            b.solde = b.solde * (1 + b.taux / 100);
          }
        });

        // Add net savings from salary (salary - charges)
        const netAddition = Math.max(0, yearlyNetSalary - yearlyCharges);

        // Distribute net addition to checking accounts proportionally or just add it
        const firstChecking = balances.find(b => b.type === 'Courant');
        if (firstChecking) {
          firstChecking.solde += netAddition;
        } else if (balances.length > 0) {
          balances[0].solde += netAddition;
        }

        const total = balances.reduce((sum, b) => sum + b.solde, 0);
        years.push({
          label: `${currentYear + y}`,
          wealth: Math.max(0, Math.round(total))
        });
      }
    }
    return years;
  });
</script>

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('dash.title')}</h1>
  <ui5-button icon="refresh" design="Transparent" onclick={() => appState.loadData()} title={i18n.t('dash.titleRefresh')}></ui5-button>
</div>

<!-- KPI Cards -->
<div class="dashboard-kpis">
  <div class="kpi-card kpi-patrimoine">
    <span class="kpi-title">{i18n.t('dash.kpiWealth')}</span>
    <span class="kpi-value">{appState.formatCurrency(totalWealth)}</span>
    <span class="kpi-subtitle">{i18n.t('dash.kpiWealthSub', { count: appState.accounts.length })}</span>
  </div>
  <div class="kpi-card kpi-epargne">
    <span class="kpi-title">{i18n.t('dash.kpiSavings')}</span>
    <span class="kpi-value">{appState.formatCurrency(totalSavings)}</span>
    <span class="kpi-subtitle">{i18n.t('dash.kpiSavingsSub')}</span>
  </div>
  <div class="kpi-card kpi-charges">
    <span class="kpi-title">{i18n.t('dash.kpiCharges')}</span>
    <span class="kpi-value">{appState.formatCurrency(totalCharges)}</span>
    <span class="kpi-subtitle">{i18n.t('dash.kpiChargesSub')}</span>
  </div>
</div>

<!-- Living Budget / Reste à Vivre Banner -->
{#if appState.budgetSummary}
  {@const budget = appState.budgetSummary}
  {@const pct = Math.round(((budget.depensesCeMois || 0) / (budget.budgetTotal || 1)) * 100)}
  <div style="background: #ffffff; border-radius: 6px; box-shadow: var(--sap-shadow-card); padding: 16px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; border-left: 5px solid {pct > 100 ? '#d9383a' : (pct >= 80 ? '#e9730c' : '#107e3e')};">
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">🛒</span>
        <div>
          <div style="font-size: 14px; font-weight: bold; color: var(--sap-text-color);">Reste à Vivre & Dépenses Quotidiennes</div>
          <div style="font-size: 11px; color: var(--sap-text-muted-color);">Suivi en direct des courses, restaurants et sorties du mois</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <ui5-button design="Emphasized" icon="add" onclick={() => appState.activeTab = 'depenses'}> Dépense</ui5-button>
        <ui5-button design="Transparent" icon="navigation-right-arrow" onclick={() => appState.activeTab = 'depenses'}>Détails</ui5-button>
      </div>
    </div>

    <!-- Progress Bar -->
    <div style="width: 100%; background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
      <div style="width: {Math.min(100, Math.max(0, pct))}%; height: 100%; background: {pct > 100 ? '#d9383a' : (pct >= 80 ? '#e9730c' : '#107e3e')}; transition: width 0.3s ease;"></div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px;">
      <div>
        <span style="color: var(--sap-text-muted-color);">Dépensé :</span>
        <strong style="color: {pct > 100 ? '#d9383a' : 'var(--sap-text-color)'};"> {appState.formatCurrency(budget.depensesCeMois)}</strong>
        <span style="color: var(--sap-text-muted-color);"> / Budget {appState.formatCurrency(budget.budgetTotal)} ({pct}%)</span>
      </div>
      <div>
        <span style="color: var(--sap-text-muted-color);">Disponible :</span>
        <strong style="color: {budget.resteAVivre < 0 ? '#d9383a' : '#107e3e'}; font-size: 13px;"> {appState.formatCurrency(budget.resteAVivre)}</strong>
        <span style="color: var(--sap-text-muted-color); font-size: 11px;"> (~{appState.formatCurrency(budget.rythmeJournalier)} / jour, reste {budget.joursRestants}j)</span>
      </div>
    </div>
  </div>
{/if}

<!-- Secondary Grid -->
<div class="grid-2col">
  <!-- Left: Accounts summary -->
  <div class="sap-card">
    <div class="sap-card-header">
      <span class="sap-card-title">{i18n.t('dash.cardTitle')}</span>
      <ui5-button design="Emphasized" icon="add" onclick={() => appState.activeTab = 'comptes'}>{i18n.t('dash.manageAccounts')}</ui5-button>
    </div>
    <div class="sap-card-body">
      <table class="sap-table">
        <thead>
          <tr>
            <th>{i18n.t('dash.colAccount')}</th>
            <th>{i18n.t('dash.colType')}</th>
            <th style="text-align: right;">{i18n.t('dash.colBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {#each appState.accounts as acc}
            <tr>
              <td style="font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  {#if acc.Couleur}
                    <span style="width: 8px; height: 8px; border-radius: 50%; background-color: {acc.Couleur}; display: inline-block; flex-shrink: 0;"></span>
                  {/if}
                  <span>{acc.Libelle}</span>
                </div>
                {#if acc.Etablissement}
                  <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: normal; margin-top: 2px;">
                    🏛️ {acc.Etablissement}
                  </div>
                {/if}
              </td>
              <td>
                <span class="badge" style="background-color: var(--sap-background-color); color: var(--sap-text-color);">
                  {acc.Type}
                </span>
              </td>
              <td style="text-align: right; font-weight: bold; color: {acc.SoldeActuel < 0 ? 'var(--sap-error-color)' : 'var(--sap-text-color)'}">
                <div>{appState.formatCurrency(acc.SoldeActuel)}</div>
                {#if acc.Plafond && parseFloat(acc.Plafond) > 0}
                  {@const ratio = Math.round((parseFloat(acc.SoldeActuel || 0) / parseFloat(acc.Plafond)) * 100)}
                  <div style="font-size: 10px; font-weight: normal; color: {ratio > 100 ? '#d9383a' : 'var(--sap-text-muted-color)'}; margin-top: 2px;">
                    {ratio}% du plafond
                  </div>
                  <div style="width: 90px; margin-left: auto; background: #e5e7eb; border-radius: 3px; height: 4px; overflow: hidden; margin-top: 2px;">
                    <div style="width: {Math.min(100, Math.max(0, ratio))}%; height: 100%; background: {ratio > 100 ? '#d9383a' : (ratio >= 85 ? '#e9730c' : '#107e3e')};"></div>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
          {#if appState.accounts.length === 0}
            <tr>
              <td colspan="3" style="text-align: center; color: var(--sap-text-muted-color); padding: 20px;">
                {i18n.currentLang === 'fr' ? 'Aucun compte configuré. Rendez-vous dans "Mes Comptes" pour ajouter des comptes.' : 'No accounts configured. Go to "Accounts & Wealth" to add accounts.'}
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Right: Visual distribution -->
  <div class="sap-card">
    <div class="sap-card-header">
      <span class="sap-card-title">{i18n.currentLang === 'fr' ? 'Répartition du patrimoine' : 'Wealth Distribution'}</span>
    </div>
    <div class="sap-card-body" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
      {#if totalWealth > 0}
        <div class="chart-container">
          <svg viewBox="-100 -100 200 200" width="180" height="180">
            {#each chartPaths as slice}
              <path d={slice.d} fill={slice.color} />
            {/each}
            <circle cx="0" cy="0" r="54" fill="#ffffff" />
            <text x="0" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="var(--sap-text-color)">
              {appState.formatCurrency(totalWealth)}
            </text>
          </svg>
        </div>
        <div style="width: 100%;">
          {#each chartPaths as slice}
            <div class="legend-item" style="margin-bottom: 6px;">
              <div class="legend-color" style="background-color: {slice.color};"></div>
              <div style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{slice.libelle}</div>
              <div style="font-weight: 600;">{slice.percent}%</div>
            </div>
          {/each}
        </div>
      {:else}
        <div style="text-align: center; color: var(--sap-text-muted-color); padding: 40px 0;">
          {i18n.currentLang === 'fr' ? 'Données insuffisantes pour tracer le graphique.' : 'Insufficient data to plot chart.'}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- 5-Year Simulation Card -->
<div class="sap-card" style="margin-bottom: 20px;">
  <div class="sap-card-header">
    <span class="sap-card-title">{i18n.t('dash.projectionTitle')}</span>
  </div>
  <div class="sap-card-body" style="padding: 20px;">
    <p style="font-size: 12px; color: var(--sap-text-muted-color); margin-bottom: 20px; font-style: italic;">
      {i18n.currentLang === 'fr'
        ? "Note : Cette projection est une simulation d'évolution du patrimoine à 5 ans basée sur les taux d'intérêt/performance de vos comptes et l'épargne résiduelle mensuelle (salaire net moins charges fixes)."
        : "Note: This projection is a 5-year wealth simulation based on interest/performance rates of your accounts and monthly residual savings (net salary minus fixed charges)."}
    </p>

    <!-- SVG Bar Chart -->
    <div style="width: 100%; height: 220px; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 20px 10px 10px 10px; border-bottom: 2px solid var(--sap-border-color); overflow-x: auto;">
      {#each projectionData as item}
        {@const maxVal = Math.max(...projectionData.map(d => d.wealth), 1)}
        {@const heightPercent = (item.wealth / maxVal) * 100}
        <div style="flex: 1; min-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end;">
          <span style="font-size: 11px; font-weight: bold; color: var(--sap-primary-color); white-space: nowrap;">
            {appState.formatCurrency(item.wealth)}
          </span>
          <div
            style="width: 100%; height: {heightPercent}%; max-height: 140px; background: linear-gradient(180deg, var(--sap-primary-color) 0%, rgba(10, 110, 209, 0.4) 100%); border-radius: 4px 4px 0 0; transition: height 0.5s ease-in-out; cursor: pointer;"
            title="Patrimoine projeté en {item.label} : {appState.formatCurrency(item.wealth)}">
          </div>
          <span style="font-size: 11px; font-weight: bold; color: var(--sap-text-muted-color);">
            {item.label}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Latest Transactions Card -->
<div class="sap-card">
  <div class="sap-card-header">
    <span class="sap-card-title">{i18n.currentLang === 'fr' ? 'Dernières opérations' : 'Recent Operations'}</span>
  </div>
  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Type de flux' : 'Flow Type'}</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.transactions.slice(0, 5) as tx}
          <tr>
            <td>{appState.formatDate(tx.Date)}</td>
            <td style="font-weight: 500;">{tx.Libelle}</td>
            <td class="hide-on-mobile">
              <span class="badge {tx.Type === 'Entree' ? 'badge-success' : tx.Type === 'Sortie' ? 'badge-error' : 'badge-warning'}">
                {tx.Type === 'Virement_Split' ? 'Virement Split' : tx.Type}
              </span>
            </td>
            <td style="text-align: right; font-weight: bold; color: {tx.Type === 'Entree' ? 'var(--sap-success-color)' : 'var(--sap-error-color)'}">
              {tx.Type === 'Entree' ? '+' : '-'}{appState.formatCurrency(tx.Montant)}
            </td>
          </tr>
        {/each}
        {#if appState.transactions.length === 0}
          <tr>
            <td colspan="4" style="text-align: center; color: var(--sap-text-muted-color); padding: 20px;">
              {i18n.currentLang === 'fr' ? 'Aucune transaction récente enregistrée.' : 'No recent transactions recorded.'}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
