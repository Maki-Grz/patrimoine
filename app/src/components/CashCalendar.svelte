<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  let selectedCalendarAccount = $state(null);
  let selectedMonthOffset = $state(0); // 0 = current, 1 = next

  // Initialize selected checking account
  $effect(() => {
    if (appState.accounts.length > 0 && !selectedCalendarAccount) {
      const firstChecking = appState.accounts.find(a => a.TypePlacement === 'Courant');
      if (firstChecking) selectedCalendarAccount = firstChecking.ID;
      else selectedCalendarAccount = appState.accounts[0].ID;
    }
  });

  let matelasThreshold = $derived.by(() => {
    return parseFloat(appState.salaryConfig?.MatelasSecurite || 200);
  });

  /**
   * Checks if a recurring debit has already been paid in the current month.
   */
  function isPaidThisMonth(dateStr) {
    if (!dateStr) return false;
    const paidDate = new Date(dateStr);
    const now = new Date();
    return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
  }

  /**
   * Returns the localized month name for a given offset from the current month.
   */
  function getMonthName(offset) {
    const now = new Date();
    let month = now.getMonth() + offset;
    let year = now.getFullYear();
    if (month > 11) {
      month -= 12;
      year += 1;
    }
    const d = new Date(year, month, 1);
    const locale = i18n.currentLang === 'en' ? 'en-US' : 'fr-FR';
    const label = d.toLocaleString(locale, { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /**
   * Generates grid cells for the previsional cash calendar view.
   */
  function getCalendarCells() {
    const now = new Date();
    let month = now.getMonth() + selectedMonthOffset;
    let year = now.getFullYear();
    if (month > 11) {
      month -= 12;
      year += 1;
    }
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    let cells = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push(d);
    }
    return cells;
  }

  /**
   * Calculates net flow change (salary / split transfer) on pay day for a specific account.
   */
  function getNetSalaryImpactForAccount(accId) {
    if (!appState.salaryConfig) return 0;
    const netSalary = parseFloat(appState.salaryConfig.MontantNet || 0);

    const isSource = appState.flowNodes.some(n => n.Type === 'Source' && n.Account_ID === accId);
    if (isSource) {
      let outgoing = 0;
      appState.flowConnections.forEach(c => {
        const srcNode = appState.flowNodes.find(n => n.ID === c.SourceNode_ID);
        if (srcNode && srcNode.Account_ID === accId) {
          if (c.TypeRegle === 'FIXED') {
            outgoing += parseFloat(c.Valeur || 0);
          } else {
            const totalFixed = appState.flowConnections
              .filter(conn => appState.flowNodes.find(n => n.ID === conn.SourceNode_ID)?.Type === 'Source' && conn.TypeRegle === 'FIXED')
              .reduce((sum, conn) => sum + parseFloat(conn.Valeur || 0), 0);
            const remaining = Math.max(0, netSalary - totalFixed);
            outgoing += remaining * (parseFloat(c.Valeur || 0) / 100);
          }
        }
      });
      return netSalary - outgoing;
    }

    // Target or Transit account
    let incoming = 0;
    const myNodes = appState.flowNodes.filter(n => n.Account_ID === accId);
    myNodes.forEach(targetNode => {
      const incomingConns = appState.flowConnections.filter(c => c.TargetNode_ID === targetNode.ID);
      incomingConns.forEach(c => {
        if (c.TypeRegle === 'FIXED') {
          incoming += parseFloat(c.Valeur || 0);
        } else {
          const totalFixed = appState.flowConnections
            .filter(conn => appState.flowNodes.find(n => n.ID === conn.SourceNode_ID)?.Type === 'Source' && conn.TypeRegle === 'FIXED')
            .reduce((sum, conn) => sum + parseFloat(conn.Valeur || 0), 0);
          const remaining = Math.max(0, netSalary - totalFixed);
          incoming += remaining * (parseFloat(c.Valeur || 0) / 100);
        }
      });

      // Forwarding transfers if transit node
      const outgoingFromMe = appState.flowConnections.filter(c => c.SourceNode_ID === targetNode.ID);
      outgoingFromMe.forEach(c => {
        if (c.TypeRegle === 'PERCENT') {
          incoming -= incoming * (parseFloat(c.Valeur || 0) / 100);
        } else {
          incoming -= parseFloat(c.Valeur || 0);
        }
      });
    });

    return incoming;
  }

  // Previsional daily balances simulator
  let calendarSimulation = $derived.by(() => {
    if (!selectedCalendarAccount) return {};
    
    const acc = appState.accounts.find(a => a.ID === selectedCalendarAccount);
    if (!acc) return {};
    
    const now = new Date();
    const payDay = parseInt(appState.salaryConfig?.JourDePaie || 28);
    const salaryNetImpact = getNetSalaryImpactForAccount(acc.ID);
    
    function projectMonth(startBalance, year, month) {
      const totalDays = new Date(year, month + 1, 0).getDate();
      let currentBal = startBalance;
      let daysData = {};
      
      for (let d = 1; d <= totalDays; d++) {
        let dayDebits = appState.recurringDebits.filter(deb => {
          if (!deb.Actif || deb.Account_ID !== acc.ID || deb.JourDuMois !== d) return false;
          if (deb.Type === 'Manuel' && selectedMonthOffset === 0 && isPaidThisMonth(deb.DernierPaiementDate)) {
            return false;
          }
          return true;
        });
        let debitsSum = dayDebits.reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0);
        
        let salaryReceived = (d === payDay) ? salaryNetImpact : 0;
        
        let dayRealExpenses = [];
        let dayIncomes = [];
        if (selectedMonthOffset === 0) {
          dayRealExpenses = appState.transactions.filter(t => {
            if (t.Type !== 'Sortie' || t.Categorie === 'Logement' || t.Libelle?.toLowerCase().includes('loyer') || t.Type === 'Charge_Fixe' || t.AccountSource_ID !== acc.ID || !t.Date) return false;
            const tDate = new Date(t.Date);
            return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === d;
          });

          // Non-salary incoming transfers (e.g. CAF, APL, refunds, bonuses)
          dayIncomes = appState.transactions.filter(t => {
            if (t.Type !== 'Entree' || t.AccountTarget_ID !== acc.ID || !t.Date) return false;
            if (d === payDay && (t.Libelle?.toLowerCase().includes('salaire') || t.Categorie === 'Salaire' || t.Categorie === 'Revenu')) return false;
            const tDate = new Date(t.Date);
            return tDate.getFullYear() === year && tDate.getMonth() === month && tDate.getDate() === d;
          });
        }
        let realExpensesSum = dayRealExpenses.reduce((sum, t) => sum + parseFloat(t.Montant || 0), 0);
        let incomesSum = dayIncomes.reduce((sum, t) => sum + parseFloat(t.Montant || 0), 0);

        currentBal = Math.round((currentBal + salaryReceived + incomesSum - debitsSum - realExpensesSum) * 100) / 100;
        daysData[d] = {
          balance: currentBal,
          debits: dayDebits,
          debitsSum,
          realExpenses: dayRealExpenses,
          realExpensesSum,
          incomes: dayIncomes,
          incomesSum,
          salaryReceived
        };
      }
      return { daysData, endBalance: currentBal };
    }
    
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const today = now.getDate();
    
    // Project start of month from current balance
    let tempBal = parseFloat(acc.SoldeActuel || 0);
    for (let d = today; d >= 1; d--) {
      let dayDebits = appState.recurringDebits.filter(deb => {
        if (!deb.Actif || deb.Account_ID !== acc.ID || deb.JourDuMois !== d) return false;
        if (deb.Type === 'Manuel' && isPaidThisMonth(deb.DernierPaiementDate)) return false;
        return true;
      });
      let debitsSum = dayDebits.reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0);

      let dayRealExpenses = appState.transactions.filter(t => {
        if (t.Type !== 'Sortie' || t.Categorie === 'Logement' || t.Libelle?.toLowerCase().includes('loyer') || t.Type === 'Charge_Fixe' || t.AccountSource_ID !== acc.ID || !t.Date) return false;
        const tDate = new Date(t.Date);
        return tDate.getFullYear() === curYear && tDate.getMonth() === curMonth && tDate.getDate() === d;
      });
      let realExpensesSum = dayRealExpenses.reduce((sum, t) => sum + parseFloat(t.Montant || 0), 0);

      let dayIncomes = appState.transactions.filter(t => {
        if (t.Type !== 'Entree' || t.AccountTarget_ID !== acc.ID || !t.Date) return false;
        if (d === payDay && (t.Libelle?.toLowerCase().includes('salaire') || t.Categorie === 'Salaire' || t.Categorie === 'Revenu')) return false;
        const tDate = new Date(t.Date);
        return tDate.getFullYear() === curYear && tDate.getMonth() === curMonth && tDate.getDate() === d;
      });
      let incomesSum = dayIncomes.reduce((sum, t) => sum + parseFloat(t.Montant || 0), 0);

      let salaryReceived = (d === payDay) ? salaryNetImpact : 0;
      tempBal = tempBal - salaryReceived - incomesSum + debitsSum + realExpensesSum;
    }
    
    const curMonthProj = projectMonth(tempBal, curYear, curMonth);
    
    if (selectedMonthOffset === 1) {
      let nextYear = curYear;
      let nextMonth = curMonth + 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      const nextMonthProj = projectMonth(curMonthProj.endBalance, nextYear, nextMonth);
      return nextMonthProj.daysData;
    }
    
    return curMonthProj.daysData;
  });

  let minSimulatedBalance = $derived.by(() => {
    const values = Object.values(calendarSimulation).map(d => d.balance);
    if (values.length === 0) return 0;
    return Math.min(...values);
  });
</script>

<div class="page-title-container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
  <h1 class="page-title">{i18n.t('cal.previsionalTitle')}</h1>
  <div style="display: flex; gap: 8px; align-items: center;">
    <ui5-button icon="add" design="Positive" onclick={() => appState.isIncomeDialogOpen = true}>
      📥 {i18n.t('income.addBtn')}
    </ui5-button>
    <ui5-button icon="refresh" design="Transparent" onclick={() => appState.loadData()} title="Actualiser les données"></ui5-button>
  </div>
</div>

<div class="calendar-layout" style="display: flex; flex-direction: column; gap: 16px;">
  <!-- Month and Account selectors -->
  <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid var(--sap-border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
      <div class="form-group" style="margin: 0; min-width: 250px;">
        <label for="cal-acc-select" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; display: block; color: var(--sap-text-muted-color);">COMPTE COURANT À SIMULER</label>
        <ui5-select id="cal-acc-select" value={selectedCalendarAccount} onchange={(e) => selectedCalendarAccount = e.target.value} style="width: 100%;">
          {#each appState.accounts.filter(a => a.TypePlacement === 'Courant') as acc}
            <ui5-option selected={selectedCalendarAccount === acc.ID ? true : undefined} value={acc.ID}>
              {acc.Libelle} ({appState.formatCurrency(acc.SoldeActuel)})
            </ui5-option>
          {/each}
        </ui5-select>
      </div>
      
      <div class="form-group" style="margin: 0; min-width: 200px;">
        <label for="cal-month-select" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; display: block; color: var(--sap-text-muted-color);">{i18n.currentLang === 'fr' ? 'PÉRIODE DE SIMULATION' : 'SIMULATION PERIOD'}</label>
        <ui5-select id="cal-month-select" value={selectedMonthOffset.toString()} onchange={(e) => selectedMonthOffset = parseInt(e.target.value)} style="width: 100%;">
          <ui5-option selected={selectedMonthOffset === 0 ? true : undefined} value="0">Mois en cours ({getMonthName(0)})</ui5-option>
          <ui5-option selected={selectedMonthOffset === 1 ? true : undefined} value="1">Mois prochain ({getMonthName(1)})</ui5-option>
        </ui5-select>
      </div>

      <div style="display: flex; align-items: flex-end;">
        <ui5-button design="Emphasized" icon="add" onclick={() => appState.isIncomeDialogOpen = true}>
          📥 {i18n.t('income.btnSubmit')}
        </ui5-button>
      </div>
    </div>

    <div style="display: flex; gap: 16px;">
      <div style="background-color: var(--sap-background-color); border: 1px solid var(--sap-border-color); padding: 10px 20px; border-radius: 6px; text-align: center; min-width: 130px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
        <div style="font-size: 10px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">{i18n.t('cal.minBalance')}</div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: {minSimulatedBalance < 0 ? 'var(--sap-error-color)' : minSimulatedBalance < matelasThreshold ? 'var(--sap-warning-color)' : 'var(--sap-success-color)'};">
          {appState.formatCurrency(minSimulatedBalance)}
        </div>
      </div>
      <div style="background-color: var(--sap-background-color); border: 1px solid var(--sap-border-color); padding: 10px 20px; border-radius: 6px; text-align: center; min-width: 130px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
        <div style="font-size: 10px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">{i18n.t('cal.cashSecurity')}</div>
        <div>
          {#if minSimulatedBalance < 0}
            <span class="badge badge-error" style="font-size: 11px; padding: 4px 8px;">{i18n.t('cal.riskOverdraft')}</span>
          {:else if minSimulatedBalance < matelasThreshold}
            <span class="badge badge-warning" style="font-size: 11px; padding: 4px 8px;">{i18n.t('cal.tightCash')}</span>
          {:else}
            <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">{i18n.t('cal.secured')}</span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Calendar grid layout -->
  <div class="sap-card">
    <div class="sap-card-header">
      <span class="sap-card-title">{i18n.t('cal.cardTitle')}</span>
      <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
        {i18n.t('cal.cardSubtitle')}
      </span>
    </div>
    <div class="sap-card-body" style="padding: 20px;">
      <!-- Grid header with days of week -->
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; text-align: center; font-weight: bold; font-size: 11px; color: var(--sap-text-muted-color); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
        {#each (i18n.currentLang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']) as day}
          <div>{day}</div>
        {/each}
      </div>

      <!-- Calendar day cells -->
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px;">
        {#each getCalendarCells() as cell, idx}
          {#if cell === null}
            <div style="background-color: #fafbfc; border: 1px dashed var(--sap-border-light-color); border-radius: 6px; min-height: 100px; opacity: 0.3;"></div>
          {:else}
            {@const dayData = calendarSimulation[cell]}
            {@const isToday = selectedMonthOffset === 0 && cell === new Date().getDate()}
            <div 
              style="background-color: {isToday ? '#f3f7fb' : '#ffffff'}; border: 1px solid {isToday ? 'var(--sap-primary-color)' : dayData?.balance < 0 ? 'rgba(187, 0, 0, 0.4)' : dayData?.balance < matelasThreshold ? 'rgba(233, 115, 12, 0.3)' : 'var(--sap-border-color)'}; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s; box-shadow: {isToday ? '0 2px 8px rgba(10,110,209,0.15)' : 'none'};"
              class="cal-day-cell">
              
              <!-- Day Header -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: bold; font-size: 14px; color: {isToday ? 'var(--sap-primary-color)' : 'var(--sap-text-color)'};">
                  {cell}
                  {#if isToday}
                    <span style="font-size: 9px; background-color: var(--sap-primary-color); color: white; padding: 1px 4px; border-radius: 3px; margin-left: 4px; font-weight: normal; vertical-align: middle;">{i18n.t('cal.today')}</span>
                  {/if}
                </span>

                <!-- Indicators for operations on this day -->
                <div style="display: flex; gap: 4px;">
                  {#if dayData?.salaryReceived > 0}
                    <div style="width: 8px; height: 8px; background-color: var(--sap-success-color); border-radius: 50%;" title="{i18n.t('cal.salaryBadge')} : +{appState.formatCurrency(dayData.salaryReceived)}"></div>
                  {/if}
                  {#if dayData?.incomesSum > 0}
                    <div style="width: 8px; height: 8px; background-color: #107e3e; border-radius: 50%;" title="{dayData.incomes.length} {i18n.t('cal.incomeBadge')} : +{appState.formatCurrency(dayData.incomesSum)}"></div>
                  {/if}
                  {#if dayData?.debitsSum > 0}
                    <div style="width: 8px; height: 8px; background-color: var(--sap-error-color); border-radius: 50%;" title="{dayData.debits.length} {i18n.t('cal.debitBadge')} : -{appState.formatCurrency(dayData.debitsSum)}"></div>
                  {/if}
                  {#if dayData?.realExpensesSum > 0}
                    <div style="width: 8px; height: 8px; background-color: #e9730c; border-radius: 50%;" title="{dayData.realExpenses.length} {i18n.t('cal.livingBadge')} : -{appState.formatCurrency(dayData.realExpensesSum)}"></div>
                  {/if}
                </div>
              </div>

              <!-- Day details (Operations list) -->
              <div class="hide-on-mobile" style="flex: 1; margin: 4px 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: 50px;">
                {#if dayData?.salaryReceived > 0}
                  <div style="font-size: 9px; color: var(--sap-success-color); font-weight: bold; background-color: rgba(16, 126, 62, 0.08); padding: 2px; border-radius: 3px;">
                    💰 {i18n.t('cal.salaryBadge')} (+{Math.round(dayData.salaryReceived)} €)
                  </div>
                {/if}
                {#if dayData?.incomes && dayData.incomes.length > 0}
                  {#each dayData.incomes as inc}
                    <div style="font-size: 9px; color: #107e3e; font-weight: bold; background-color: rgba(16, 126, 62, 0.12); padding: 2px 4px; border-radius: 3px; display: flex; justify-content: space-between;" title="{inc.Libelle} : +{appState.formatCurrency(inc.Montant)}">
                      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;">📥 {inc.Libelle}</span>
                      <span>+{Math.round(inc.Montant)} €</span>
                    </div>
                  {/each}
                {/if}
                {#if dayData?.debits && dayData.debits.length > 0}
                  {#each dayData.debits as deb}
                    <div style="font-size: 9px; color: var(--sap-error-color); font-weight: 500; background-color: rgba(187, 0, 0, 0.05); padding: 2px; border-radius: 3px; display: flex; justify-content: space-between;" title="{deb.Libelle} : -{appState.formatCurrency(deb.Montant)}">
                      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;">{deb.Libelle}</span>
                      <span>-{Math.round(deb.Montant)} €</span>
                    </div>
                  {/each}
                {/if}
                {#if dayData?.realExpensesSum > 0}
                  <div style="font-size: 9px; color: #e9730c; font-weight: 500; background-color: rgba(233, 115, 12, 0.08); padding: 2px; border-radius: 3px; display: flex; justify-content: space-between;" title="{dayData.realExpenses.length} {i18n.t('cal.livingBadge')} : -{appState.formatCurrency(dayData.realExpensesSum)}">
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;">🛒 {i18n.t('cal.livingBadge')}</span>
                    <span>-{Math.round(dayData.realExpensesSum)} €</span>
                  </div>
                {/if}
              </div>

              <!-- Projected day balance -->
              {#if dayData}
                <div style="text-align: right; font-weight: bold; font-size: 12px; color: {dayData.balance < 0 ? 'var(--sap-error-color)' : dayData.balance < matelasThreshold ? 'var(--sap-warning-color)' : 'var(--sap-text-color)'}; border-top: 1px solid var(--sap-border-light-color); padding-top: 4px; margin-top: auto;">
                  {appState.formatCurrency(dayData.balance)}
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>
