<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let dialogRef = $state(null);
  let newSoldeInput = $state('');
  let motifInput = $state('');
  let isUpdating = $state(false);

  // Filter history points for selected account
  let accountHistory = $derived.by(() => {
    if (!appState.selectedHistoryAccount) return [];
    const accId = appState.selectedHistoryAccount.ID;
    return appState.balanceHistory
      .filter(h => h.Account_ID === accId || (h.Account && h.Account.ID === accId))
      .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
  });

  // Calculate global variation across history
  let globalVariation = $derived.by(() => {
    if (accountHistory.length === 0) return null;
    const latest = accountHistory[0];
    const oldest = accountHistory[accountHistory.length - 1];
    const initialVal = parseFloat(oldest.AncienSolde || 0);
    const currentVal = parseFloat(latest.NouveauSolde || 0);
    const totalDelta = Math.round((currentVal - initialVal) * 100) / 100;
    const pct = initialVal > 0 ? ((totalDelta / initialVal) * 100).toFixed(2) : "0.00";
    return {
      totalDelta,
      pct,
      isPositive: totalDelta >= 0,
      latestDelta: parseFloat(latest.Delta || 0)
    };
  });

  // Generate SVG sparkline points
  let chartPoints = $derived.by(() => {
    if (accountHistory.length < 2) return null;
    const chronological = [...accountHistory].reverse();
    const values = chronological.map(h => parseFloat(h.NouveauSolde || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 360;
    const height = 80;
    const padding = 10;

    const points = values.map((val, idx) => {
      const x = padding + (idx / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - min) / range) * (height - 2 * padding);
      return { x: Math.round(x), y: Math.round(y), val, date: chronological[idx].Date };
    });

    const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');
    return { points, polylineStr, width, height };
  });

  // Sync dialog visibility
  $effect(() => {
    if (appState.isBalanceHistoryDialogOpen) {
      if (appState.selectedHistoryAccount) {
        newSoldeInput = String(appState.selectedHistoryAccount.SoldeActuel || '');
      }
      motifInput = '';
      if (dialogRef) {
        dialogRef.open = true;
      }
    } else {
      if (dialogRef) {
        dialogRef.open = false;
      }
    }
  });

  function closeDialog() {
    appState.isBalanceHistoryDialogOpen = false;
    appState.selectedHistoryAccount = null;
    if (dialogRef) {
      dialogRef.open = false;
    }
  }

  async function handleSaveValuation() {
    if (!appState.selectedHistoryAccount) return;
    const amount = parseFloat(newSoldeInput);
    if (isNaN(amount) || amount < 0) {
      appState.showToast("Le solde doit être un montant positif valide.");
      return;
    }

    isUpdating = true;
    const ok = await appState.updateAccountValuation(
      appState.selectedHistoryAccount.ID,
      amount,
      motifInput.trim() || `Actualisation manuelle de la valorisation (${amount.toFixed(2)} €)`
    );
    isUpdating = false;

    if (ok) {
      motifInput = '';
    }
  }
</script>

<ui5-dialog
  bind:this={dialogRef}
  open={appState.isBalanceHistoryDialogOpen || undefined}
  header-text={i18n.t('evolution.dialogTitle')}
  onclose={closeDialog}
  style="--_ui5_dialog_content_min_width: 340px; --_ui5_dialog_content_max_width: 680px;"
>
  <div class="dialog-content" style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
    {#if appState.selectedHistoryAccount}
      {@const acc = appState.selectedHistoryAccount}
      
      <!-- Account Header Banner -->
      <div style="background: #f8fafc; border: 1px solid var(--sap-border-color); border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="font-size: 16px; font-weight: bold; color: var(--sap-text-color); display: flex; align-items: center; gap: 8px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background-color: {acc.Couleur || '#0a6ed1'}; display: inline-block;"></span>
            {acc.Libelle}
          </div>
          <div style="font-size: 12px; color: var(--sap-text-muted-color); margin-top: 2px;">
            🏛️ {acc.Etablissement || 'Banque'} &bull; {acc.Type} ({acc.TypePlacement})
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-size: 11px; color: var(--sap-text-muted-color);">{i18n.t('evolution.currentBalance')}</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--sap-primary-color);">
            {appState.formatCurrency(acc.SoldeActuel)}
          </div>
          {#if globalVariation}
            <div style="font-size: 11px; font-weight: bold; color: {globalVariation.isPositive ? '#107e3e' : '#d9383a'}; margin-top: 2px;">
              {globalVariation.isPositive ? '↗ +' : '↘ '}{appState.formatCurrency(globalVariation.latestDelta)}
              {#if globalVariation.pct !== '0.00'}
                ({globalVariation.isPositive ? '+' : ''}{globalVariation.pct}%)
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Sparkline chart if multiple points exist -->
      {#if chartPoints}
        <div style="background: #ffffff; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div style="width: 100%; display: flex; justify-content: space-between; font-size: 11px; color: var(--sap-text-muted-color);">
            <span>Courbe d'évolution du solde</span>
            <span>{accountHistory.length} relevés</span>
          </div>
          <svg viewBox="0 0 {chartPoints.width} {chartPoints.height}" style="width: 100%; height: 90px; overflow: visible;">
            <!-- Line -->
            <polyline
              fill="none"
              stroke="var(--sap-primary-color)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              points={chartPoints.polylineStr}
            />
            <!-- Data dots -->
            {#each chartPoints.points as pt}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="#ffffff"
                stroke="var(--sap-primary-color)"
                stroke-width="2"
              >
                <title>{appState.formatDate(pt.date)} : {appState.formatCurrency(pt.val)}</title>
              </circle>
            {/each}
          </svg>
        </div>
      {/if}

      <!-- Quick update valuation section -->
      <div style="background: #fdfdfd; border: 1px dashed var(--sap-border-color); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 12px; font-weight: bold; color: var(--sap-text-color);">
          📈 {i18n.t('evolution.addValuation')}
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <ui5-input
              type="Number"
              placeholder={i18n.t('evolution.newBalanceLabel')}
              value={newSoldeInput}
              oninput={(e) => newSoldeInput = e.target.value}
            ></ui5-input>
          </div>
          <div style="flex: 2; min-width: 200px;">
            <ui5-input
              placeholder={i18n.t('evolution.motifLabel')}
              value={motifInput}
              oninput={(e) => motifInput = e.target.value}
            ></ui5-input>
          </div>
          <ui5-button
            design="Emphasized"
            icon="save"
            onclick={handleSaveValuation}
            disabled={isUpdating || !newSoldeInput || undefined}
          >
            {i18n.t('evolution.saveValuation')}
          </ui5-button>
        </div>
      </div>

      <!-- History Log Table -->
      <div>
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: var(--sap-text-color);">
          📜 {i18n.t('evolution.subtitle')}
        </div>
        <div style="max-height: 240px; overflow-y: auto; border: 1px solid var(--sap-border-color); border-radius: 6px;">
          <table class="sap-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid var(--sap-border-color); text-align: left;">
                <th style="padding: 8px 10px;">{i18n.t('evolution.colDate')}</th>
                <th style="padding: 8px 10px;">{i18n.t('evolution.colOldNew')}</th>
                <th style="padding: 8px 10px; text-align: right;">{i18n.t('evolution.colDelta')}</th>
                <th style="padding: 8px 10px;">{i18n.t('evolution.colMotif')}</th>
              </tr>
            </thead>
            <tbody>
              {#each accountHistory as item}
                {@const delta = parseFloat(item.Delta || 0)}
                {@const isPos = delta >= 0}
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 10px; color: var(--sap-text-muted-color); white-space: nowrap;">
                    {appState.formatDate(item.Date)}
                  </td>
                  <td style="padding: 8px 10px; font-weight: 500;">
                    {appState.formatCurrency(item.AncienSolde)} ➔ <strong>{appState.formatCurrency(item.NouveauSolde)}</strong>
                  </td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: {isPos ? '#107e3e' : '#d9383a'}; white-space: nowrap;">
                    {isPos ? '+' : ''}{appState.formatCurrency(delta)}
                  </td>
                  <td style="padding: 8px 10px; color: var(--sap-text-color);">
                    {item.Motif || 'Ajustement de solde'}
                  </td>
                </tr>
              {/each}
              {#if accountHistory.length === 0}
                <tr>
                  <td colspan="4" style="text-align: center; color: var(--sap-text-muted-color); padding: 16px;">
                    {i18n.t('evolution.noHistory')}
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>

  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px; display: flex; justify-content: flex-end;">
    <ui5-button onclick={closeDialog} design="Transparent">{i18n.t('gen.close')}</ui5-button>
  </div>
</ui5-dialog>
