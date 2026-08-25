<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let detailLogDialog = $state(null);
  let selectedLogDetails = $state(null);

  // Filter logs for historical charting
  let successLogs = $derived(appState.executionLogs.filter(log => log.Statut === 'SUCCESS').slice(0, 5));

  let historicalCharts = $derived.by(() => {
    return successLogs.map(log => {
      let parsed = {};
      try {
        parsed = JSON.parse(log.DetailsJSON || '{}');
      } catch (e) {
        parsed = {};
      }
      
      const salary = parseFloat(parsed.salaryAmount || 3200);
      let categories = { Epargne: 0, Actions: 0, Verrouille: 0, Courant: 0 };
      
      const txs = parsed.transactions || [];
      if (txs.length > 0) {
        txs.forEach(tx => {
          const targetAcc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
          const type = targetAcc ? targetAcc.TypePlacement : 'Courant';
          if (categories[type] !== undefined) {
            categories[type] += parseFloat(tx.Montant || 0);
          } else {
            categories.Courant += parseFloat(tx.Montant || 0);
          }
        });
      } else if (parsed.allocations) {
        parsed.allocations.forEach(alloc => {
          const targetAcc = appState.accounts.find(a => a.ID === (alloc.targetNodeId ? (appState.flowNodes.find(n => n.ID === alloc.targetNodeId)?.Account_ID) : alloc.accountId));
          const type = targetAcc ? targetAcc.TypePlacement : 'Courant';
          if (categories[type] !== undefined) {
            categories[type] += parseFloat(alloc.amountAllocated || 0);
          } else {
            categories.Courant += parseFloat(alloc.amountAllocated || 0);
          }
        });
      }
      
      const totalAllocated = Object.values(categories).reduce((sum, val) => sum + val, 0);
      const leftover = Math.max(0, salary - totalAllocated);
      categories.Courant += leftover;
      
      return {
        timestamp: log.Timestamp,
        salary,
        categories: [
          { name: 'Épargne', value: categories.Epargne, percent: Math.round((categories.Epargne / salary) * 100), color: '#107e3e' },
          { name: 'Actions & Variable', value: categories.Actions, percent: Math.round((categories.Actions / salary) * 100), color: '#e9730c' },
          { name: 'Bloqué (PEG/PEE)', value: categories.Verrouille, percent: Math.round((categories.Verrouille / salary) * 100), color: '#6f42c1' },
          { name: 'Compte Courant', value: categories.Courant, percent: Math.round((categories.Courant / salary) * 100), color: '#0a6ed1' }
        ]
      };
    });
  });

  /**
   * Opens the dialog displaying execution details for a log.
   * @param {object} log - The execution log object.
   */
  function showLogDetails(log) {
    selectedLogDetails = log;
    try {
      selectedLogDetails.parsedDetails = JSON.parse(log.DetailsJSON || '{}');
    } catch (e) {
      selectedLogDetails.parsedDetails = log.DetailsJSON;
    }
    if (detailLogDialog) detailLogDialog.open = true;
  }
</script>

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('logs.title')}</h1>
  <ui5-button icon="refresh" design="Transparent" onclick={() => appState.loadData()}></ui5-button>
</div>

<!-- Visual Distribution History -->
{#if historicalCharts.length > 0}
  <div class="sap-card" style="margin-bottom: 20px;">
    <div class="sap-card-header">
      <span class="sap-card-title">Historique des 5 dernières répartitions de salaire</span>
    </div>
    <div class="sap-card-body" style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <div style="width: 12px; height: 12px; background-color: #107e3e; border-radius: 2px;"></div>
          <span>Épargne Livrets</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <div style="width: 12px; height: 12px; background-color: #e9730c; border-radius: 2px;"></div>
          <span>Actions & Placements</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <div style="width: 12px; height: 12px; background-color: #6f42c1; border-radius: 2px;"></div>
          <span>Bloqué (PEG/PEE)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <div style="width: 12px; height: 12px; background-color: #0a6ed1; border-radius: 2px;"></div>
          <span>Compte Courant</span>
        </div>
      </div>

      {#each historicalCharts as chart}
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--sap-text-muted-color);">
            <span>Répartition du {appState.formatDate(chart.timestamp)}</span>
            <span>Total : {appState.formatCurrency(chart.salary)}</span>
          </div>
          <div style="width: 100%; height: 24px; background-color: var(--sap-border-light-color); border-radius: 4px; display: flex; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
            {#each chart.categories as cat}
              {#if cat.value > 0}
                <div 
                  style="width: {cat.percent}%; height: 100%; background-color: {cat.color}; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; transition: width 0.3s;"
                  title="{cat.name} : {appState.formatCurrency(cat.value)} ({cat.percent}%)">
                  {#if cat.percent > 7}
                    {cat.percent}%
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<div class="sap-card">
  <div class="sap-card-header">
    <span class="sap-card-title">Traçabilité des opérations de distribution et flux</span>
  </div>

  <div class="sap-card-body">
    <table class="sap-table">
      <thead>
        <tr>
          <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Horodatage' : 'Timestamp'}</th>
          <th>Statut</th>
          <th>Message de l'opération</th>
          <th style="text-align: right;">Détails</th>
        </tr>
      </thead>
      <tbody>
        {#each appState.executionLogs as log}
          <tr>
            <td class="hide-on-mobile">{appState.formatDate(log.Timestamp)}</td>
            <td>
              <span class="badge {log.Statut === 'SUCCESS' ? 'badge-success' : 'badge-error'}">
                {log.Statut}
              </span>
            </td>
            <td style="font-weight: 500;">{log.Message}</td>
            <td style="text-align: right;">
              <ui5-button icon="document-text" design="Transparent" onclick={() => showLogDetails(log)}>Inspecter</ui5-button>
            </td>
          </tr>
        {/each}
        {#if appState.executionLogs.length === 0}
          <tr>
            <td colspan="4" style="text-align: center; color: var(--sap-text-muted-color); padding: 40px 0;">
              Aucun journal d'exécution enregistré.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- LOGS DETAIL DIALOG -->
<ui5-dialog bind:this={detailLogDialog} header-text="Détails du Log d'Exécution">
  {#if selectedLogDetails}
    <div style="padding: 16px; width: 420px; display: flex; flex-direction: column; gap: 12px;">
      <div><strong>Statut :</strong> 
        <span class="badge {selectedLogDetails.Statut === 'SUCCESS' ? 'badge-success' : 'badge-error'}">
          {selectedLogDetails.Statut}
        </span>
      </div>
      <div><strong>Date :</strong> {appState.formatDate(selectedLogDetails.Timestamp)}</div>
      <div><strong>Message :</strong> {selectedLogDetails.Message}</div>
      <div style="margin-top: 8px;">
        <strong>Données Techniques (JSON) :</strong>
        <pre style="background: #f4f6f8; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px; max-height: 200px; margin-top: 4px;">
          {JSON.stringify(selectedLogDetails.parsedDetails, null, 2)}
        </pre>
      </div>
    </div>
  {/if}
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => { if (detailLogDialog) detailLogDialog.open = false; }} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>
