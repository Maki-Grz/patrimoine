<script>
  import { onMount } from 'svelte';
  import { i18n } from './lib/i18n.svelte.js';

  // UI5 Web Components Imports
  import "@ui5/webcomponents/dist/Button.js";
  import "@ui5/webcomponents/dist/Input.js";
  import "@ui5/webcomponents/dist/Select.js";
  import "@ui5/webcomponents/dist/Option.js";
  import "@ui5/webcomponents/dist/Toast.js";
  import "@ui5/webcomponents/dist/Dialog.js";
  import "@ui5/webcomponents/dist/Icon.js";
  import "@ui5/webcomponents/dist/Switch.js";
  import "@ui5/webcomponents/dist/Label.js";
  import "@ui5/webcomponents/dist/CheckBox.js";
  import "@ui5/webcomponents/dist/BusyIndicator.js";
  import "@ui5/webcomponents/dist/MessageStrip.js";
  
  // UI5 Fiori Components
  import "@ui5/webcomponents-fiori/dist/SideNavigation.js";
  import "@ui5/webcomponents-fiori/dist/SideNavigationItem.js";
  import "@ui5/webcomponents-fiori/dist/Wizard.js";

  // UI5 Icons Registration
  // Import AllIcons.js to register the loaders for both v4 and v5 SAP-icons collection and resolve all console errors
  import "@ui5/webcomponents-icons/dist/AllIcons.js";



  // Svelte 5 Reactive State
  let activeTab = $state('dashboard');
  let sidebarCollapsed = $state(false);
  
  let accounts = $state([]);
  let salaryConfig = $state(null);
  let allocationRules = $state([]);
  let transactions = $state([]);
  let recurringDebits = $state([]);
  let executionLogs = $state([]);
  let loading = $state(false);
  let executionStatus = $state(null);
  let flowNodes = $state([]);
  let flowConnections = $state([]);
  let interestRateHistory = $state([]);
  let stockFluctuations = $state([]);
  let projectionYears = $state(5);
  let activeDragNode = $state(null);
  let dragOffset = { x: 0, y: 0 };

  // Dialog & Toast References and States
  let toastMessage = $state('');
  let selectedLogDetails = $state(null);
  
  let accountDialogRef = $state(null);
  let ruleDialogRef = $state(null);
  let debitDialogRef = $state(null);
  let detailLogDialog = $state(null);
  let toastRef = $state(null);
  let sideNavRef = $state(null);

  // Dialog Open States (Declarative)
  let isAccountDialogOpen = $state(false);
  let isRuleDialogOpen = $state(false);
  let isDebitDialogOpen = $state(false);
  let isManualPaymentDialogOpen = $state(false);


  // Edit / Add Form States
  let accountForm = $state({ ID: '', Libelle: '', Type: 'Courant', SoldeActuel: 0, TypePlacement: 'Courant', DateMaturite: '', TauxActuel: 0, IBAN: '' });

  let nodeForm = $state({ Label: '', Type: 'Transit', Account_ID: '' });
  let connectionForm = $state({ SourceNode_ID: '', TargetNode_ID: '', TypeRegle: 'PERCENT', Valeur: 0 });
  let nodeAllocatedAmounts = $state({});

  let nodeDialogRef = $state(null);
  let connectionDialogRef = $state(null);
  let nodesListDialogRef = $state(null);
  let connectionsListDialogRef = $state(null);
  let isEditingAccount = $state(false);

  let ruleForm = $state({ ID: '', Account_ID: '', PourcentageOuMontantFixe: 'PERCENT', Valeur: 0 });
  let isEditingRule = $state(false);

  let debitForm = $state({ ID: '', Libelle: '', Montant: 0, JourDuMois: 5, Account_ID: '', Actif: true, Type: 'Automatique' });

  let isEditingDebit = $state(false);

  // Salary Split Execution State
  let currentSalaryAmount = $state(3200);
  let proposedTransactions = $state([]);
  let pendingTransactions = $state([]);
  let distributionDialogRef = $state(null);
  let wizardActiveStep = $state(1);

  // Auto-calculation split background effect
  let salaryDebounceTimeout;
  $effect(() => {
    const amount = currentSalaryAmount;
    if (amount > 0 && activeTab === 'distribution') {
      clearTimeout(salaryDebounceTimeout);
      salaryDebounceTimeout = setTimeout(async () => {
        try {
          const res = await fetch('/odata/v4/patrimoine/calculateSalarySplit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaryAmount: amount })
          });
          if (res.ok) {
            const result = await res.json();
            const txs = JSON.parse(result.value || '[]');
            proposedTransactions = txs.map(tx => ({ ...tx, checked: true }));
          }
        } catch (e) {
          console.error("Erreur calculateSalarySplit:", e);
        }
      }, 250);
    } else {
      proposedTransactions = [];
    }
  });

  // Derived state for Select All checkbox
  let allSelected = $derived(proposedTransactions.length > 0 && proposedTransactions.every(tx => tx.checked));
  
  /**
   * Toggles the selection status of all proposed salary split transactions.
   * @param {any} event - The checkbox change event.
   */
  function toggleSelectAll(event) {
    const isChecked = event.target.checked;
    proposedTransactions.forEach(tx => tx.checked = isChecked);
  }


  // Derived state for Select All checkbox (remaining transactions table)
  let allPendingSelected = $derived(pendingTransactions.length > 0 && pendingTransactions.every(tx => tx.checked));
  
  /**
   * Toggles the selection status of all pending transactions.
   * @param {any} event - The checkbox change event.
   */
  function togglePendingSelectAll(event) {
    const isChecked = event.target.checked;
    pendingTransactions.forEach(tx => tx.checked = isChecked);
  }

  // Projected Savings Rate calculation for current proposed split
  let popupSavingsRate = $derived.by(() => {
    const total = currentSalaryAmount || 1;
    const epargne = proposedTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
        if (targetAcc && targetAcc.TypePlacement !== 'Courant') {
          return sum + parseFloat(tx.Montant || 0);
        }
        return sum;
      }, 0);
    return Math.round((epargne / total) * 100);
  });

  let popupSavingsAmount = $derived.by(() => {
    return proposedTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
        if (targetAcc && targetAcc.TypePlacement !== 'Courant') {
          return sum + parseFloat(tx.Montant || 0);
        }
        return sum;
      }, 0);
  });

  // Real-time flow node previews
  let graphPreviewAllocations = $derived.by(() => {
    if (currentSalaryAmount <= 0) return {};
    const allocs = simulateGraphSplit(currentSalaryAmount);
    const sums = {};
    const sourceNode = flowNodes.find(n => n.Type === 'Source');
    if (sourceNode) {
      sums[sourceNode.ID] = currentSalaryAmount;
    }
    allocs.forEach(alloc => {
      const tgtNode = flowNodes.find(n => n.Label === alloc.targetLabel);
      if (tgtNode) {
        sums[tgtNode.ID] = (sums[tgtNode.ID] || 0) + alloc.amount;
      }
    });
    return sums;
  });


  // Projected Savings Rate calculation for pending transactions table
  let pendingSavingsRate = $derived.by(() => {
    const total = currentSalaryAmount || 1;
    const epargne = pendingTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
        if (targetAcc && targetAcc.TypePlacement !== 'Courant') {
          return sum + parseFloat(tx.Montant || 0);
        }
        return sum;
      }, 0);
    return Math.round((epargne / total) * 100);
  });

  let pendingSavingsAmount = $derived.by(() => {
    return pendingTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
        if (targetAcc && targetAcc.TypePlacement !== 'Courant') {
          return sum + parseFloat(tx.Montant || 0);
        }
        return sum;
      }, 0);
  });

  // Derived state for the wizard simulation step
  let simulatedDistribution = $derived.by(() => {
    let categories = { Epargne: 0, Actions: 0, Verrouille: 0, Courant: 0 };
    
    const totalAllocated = proposedTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
        const type = targetAcc ? targetAcc.TypePlacement : 'Courant';
        const amount = parseFloat(tx.Montant || 0);
        if (categories[type] !== undefined) {
          categories[type] += amount;
        } else {
          categories.Courant += amount;
        }
        return sum + amount;
      }, 0);

    const leftover = Math.max(0, currentSalaryAmount - totalAllocated);
    categories.Courant += leftover;

    return {
      epargne: categories.Epargne,
      actions: categories.Actions,
      verrouille: categories.Verrouille,
      courant: categories.Courant,
      totalAllocated,
      leftover,
      savingsRate: currentSalaryAmount > 0 ? Math.round((categories.Epargne / currentSalaryAmount) * 100) : 0
    };
  });

  let simulatedChartPaths = $derived.by(() => {
    const total = currentSalaryAmount || 1;
    const data = [
      { libelle: 'Épargne Livrets', value: simulatedDistribution.epargne, color: '#107e3e' },
      { libelle: 'Actions & Placements', value: simulatedDistribution.actions, color: '#e9730c' },
      { libelle: 'Bloqué (PEG/PEE)', value: simulatedDistribution.verrouille, color: '#6f42c1' },
      { libelle: 'Compte Courant', value: simulatedDistribution.courant, color: '#0a6ed1' }
    ].filter(item => item.value > 0);

    let cumulativePercent = 0;

    function getCoordinatesForPercent(percent) {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    }

    return data.map(item => {
      const percent = item.value / total;
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
        color: item.color,
        libelle: item.libelle,
        value: item.value,
        percent: (percent * 100).toFixed(1)
      };
    });
  });

  // Copy transfer details helper
  /**
   * Copies transfer details to the clipboard in a human-readable format.
   * @param {object} tx - The transaction object.
   */
  function copyTransferDetails(tx) {
    const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
    const sourceAcc = accounts.find(a => a.ID === tx.AccountSource_ID);
    const targetIBAN = targetAcc && targetAcc.IBAN ? targetAcc.IBAN : '';
    
    let textToCopy = `=== ${i18n.currentLang === 'fr' ? 'Détails' : 'Details'} du virement ===\n`;
    textToCopy += `De : ${tx.AccountSourceLibelle || (sourceAcc ? sourceAcc.Libelle : (i18n.currentLang === 'fr' ? 'Compte Source' : 'Source Account'))}\n`;
    textToCopy += `Vers : ${tx.AccountTargetLibelle || (targetAcc ? targetAcc.Libelle : (i18n.currentLang === 'fr' ? 'Compte Cible' : 'Target Account'))}\n`;
    if (targetIBAN) {
      textToCopy += `IBAN Cible : ${targetIBAN}\n`;
    }
    textToCopy += `Montant : ${formatCurrency(tx.Montant)}\n`;
    textToCopy += `Motif : ${tx.Libelle}`;
    
    navigator.clipboard.writeText(textToCopy);
    showToast("Détails du virement copiés !");
  }

  // Historical distributions visual parser
  let successLogs = $derived(executionLogs.filter(log => log.Statut === 'SUCCESS').slice(0, 5));

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
          const targetAcc = accounts.find(a => a.ID === tx.AccountTarget_ID);
          const type = targetAcc ? targetAcc.TypePlacement : 'Courant';
          if (categories[type] !== undefined) {
            categories[type] += parseFloat(tx.Montant || 0);
          } else {
            categories.Courant += parseFloat(tx.Montant || 0);
          }
        });
      } else if (parsed.allocations) {
        parsed.allocations.forEach(alloc => {
          const targetAcc = accounts.find(a => a.ID === (alloc.targetNodeId ? (flowNodes.find(n => n.ID === alloc.targetNodeId)?.Account_ID) : alloc.accountId));
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

  // PENDING TRANSACTIONS DIALOG STATES
  let editPendingDialogRef = $state(null);
  let isPendingFormDialogOpen = $state(false);
  let pendingForm = $state({ ID: '', Libelle: '', Montant: 0, AccountSource_ID: '', AccountTarget_ID: '' });

  // MANUAL PAYMENT DIALOG STATES & FUNCTIONS
  let manualPaymentDialogRef = $state(null);
  let selectedPaymentDebit = $state(null);
  let manualPaymentAmount = $state(0);
  let updateDefaultAmount = $state(false);

  /**
   * Checks if a recurring debit has already been paid in the current month.
   * @param {string} dateStr - The date string of the last payment.
   * @returns {boolean} True if paid this month, false otherwise.
   */
  function isPaidThisMonth(dateStr) {
    if (!dateStr) return false;
    const paidDate = new Date(dateStr);
    const now = new Date();
    return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
  }

  /**
   * Opens the manual payment confirmation dialog for a recurring debit.
   * @param {object} deb - The recurring debit object.
   */
  function openManualPaymentDialog(deb) {
    selectedPaymentDebit = deb;
    manualPaymentAmount = deb.Montant;
    updateDefaultAmount = false;
    isManualPaymentDialogOpen = true;
    if (manualPaymentDialogRef && typeof manualPaymentDialogRef.show === 'function') {
      manualPaymentDialogRef.show();
    }
  }

  /**
   * Confirms and registers a manual payment for a recurring debit.
   * @returns {Promise<void>}
   */
  async function confirmManualPayment() {
    if (!selectedPaymentDebit) return;
    if (manualPaymentAmount <= 0) {
      showToast("Le montant doit être supérieur à 0.");
      return;
    }
    
    loading = true;
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      
      // 1. Record the actual transaction in Transactions
      const txPayload = {
        ID: generateUUID(),
        Date: new Date().toISOString().slice(0, 19) + 'Z',
        Libelle: `Virement manuel : ${selectedPaymentDebit.Libelle}`,
        Montant: -parseFloat(manualPaymentAmount),
        Type: 'Abonnement',
        AccountSource_ID: selectedPaymentDebit.Account_ID,
        AccountTarget_ID: null
      };
      
      const txRes = await fetch('/odata/v4/patrimoine/Transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txPayload)
      });
      
      if (!txRes.ok) {
        showToast("Erreur lors de l'enregistrement de la transaction.");
        loading = false;
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
        showToast(`Virement pour "${selectedPaymentDebit.Libelle}" validé avec succès !`);
        isManualPaymentDialogOpen = false;
        if (manualPaymentDialogRef && typeof manualPaymentDialogRef.close === 'function') {
          manualPaymentDialogRef.close();
        }
        await loadData();
      } else {
        showToast("Erreur lors de la mise à jour de l'abonnement.");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de connexion.");
    } finally {
      loading = false;
    }
  }




  // CASH FLOW FORECAST CALENDAR STATES & LOGIC
  let selectedCalendarAccount = $state(null);
  let selectedMonthOffset = $state(0); // 0 = current, 1 = next

  $effect(() => {
    if (accounts.length > 0 && !selectedCalendarAccount) {
      const firstChecking = accounts.find(a => a.TypePlacement === 'Courant');
      if (firstChecking) selectedCalendarAccount = firstChecking.ID;
      else selectedCalendarAccount = accounts[0].ID;
    }
  });

  /**
   * Returns the French month name for a given offset from the current month.
   * @param {number} offset - The month offset.
   * @returns {string} The month name.
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
    const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /**
   * Generates grid cells for the previsional cash calendar view.
   * @returns {object[]} The calendar grid cells.
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

  let calendarSimulation = $derived.by(() => {
    if (!selectedCalendarAccount) return {};
    
    const acc = accounts.find(a => a.ID === selectedCalendarAccount);
    if (!acc) return {};
    
    const now = new Date();
    
    /**
     * Projects accounts balances for a single future month.
     * @param {number} startBalance - Initial balance.
     * @param {number} year - The projection year.
     * @param {number} month - The projection month index (1-12).
     * @returns {number} The ending balance after salary and recurring debits.
     */
    function projectMonth(startBalance, year, month) {
      const totalDays = new Date(year, month + 1, 0).getDate();
      let currentBal = startBalance;
      let daysData = {};
      
      for (let d = 1; d <= totalDays; d++) {
        let dayDebits = recurringDebits.filter(deb => {
          if (!deb.Actif || deb.Account_ID !== acc.ID || deb.JourDuMois !== d) return false;
          if (deb.Type === 'Manuel' && selectedMonthOffset === 0 && isPaidThisMonth(deb.DernierPaiementDate)) {
            return false;
          }
          return true;
        });
        let debitsSum = dayDebits.reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0);
        
        let salaryReceived = 0;
        if (salaryConfig && d === (salaryConfig.JourDePaie || 27)) {
          const sourceNodes = flowNodes.filter(n => n.Type === 'Source' && n.Account_ID === acc.ID);
          if (sourceNodes.length > 0) {
            salaryReceived = parseFloat(salaryConfig.MontantNet || 0);
            
            // Subtract outgoing transfers calculated by flow connections
            let outgoingSplit = 0;
            flowConnections.forEach(c => {
              const srcNode = flowNodes.find(n => n.ID === c.SourceNode_ID);
              if (srcNode && srcNode.Account_ID === acc.ID) {
                if (c.TypeRegle === 'FIXED') {
                  outgoingSplit += parseFloat(c.Valeur || 0);
                } else {
                  if (srcNode.Type === 'Source') {
                    const totalFixed = flowConnections
                      .filter(conn => flowNodes.find(n => n.ID === conn.SourceNode_ID)?.Type === 'Source' && conn.TypeRegle === 'FIXED')
                      .reduce((sum, conn) => sum + parseFloat(conn.Valeur || 0), 0);
                    const remaining = Math.max(0, salaryConfig.MontantNet - totalFixed);
                    outgoingSplit += remaining * (parseFloat(c.Valeur || 0) / 100);
                  }
                }
              }
            });
            salaryReceived -= outgoingSplit;
          }
        }
        
        currentBal = currentBal + salaryReceived - debitsSum;
        daysData[d] = {
          balance: currentBal,
          debits: dayDebits,
          debitsSum,
          salaryReceived
        };
      }
      return { daysData, endBalance: currentBal };
    }
    
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const today = now.getDate();
    
    let tempBal = acc.SoldeActuel;
    for (let d = today; d > 1; d--) {
      let dayDebits = recurringDebits.filter(deb => {
        if (!deb.Actif || deb.Account_ID !== acc.ID || deb.JourDuMois !== d) return false;
        if (deb.Type === 'Manuel' && isPaidThisMonth(deb.DernierPaiementDate)) {
          return false;
        }
        return true;
      });
      let debitsSum = dayDebits.reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0);

      
      let salaryReceived = 0;
      if (salaryConfig && d === (salaryConfig.JourDePaie || 27)) {
        const sourceNodes = flowNodes.filter(n => n.Type === 'Source' && n.Account_ID === acc.ID);
        if (sourceNodes.length > 0) {
          salaryReceived = parseFloat(salaryConfig.MontantNet || 0);
          let outgoingSplit = 0;
          flowConnections.forEach(c => {
            const srcNode = flowNodes.find(n => n.ID === c.SourceNode_ID);
            if (srcNode && srcNode.Account_ID === acc.ID) {
              if (c.TypeRegle === 'FIXED') {
                outgoingSplit += parseFloat(c.Valeur || 0);
              } else {
                if (srcNode.Type === 'Source') {
                  const totalFixed = flowConnections
                    .filter(conn => flowNodes.find(n => n.ID === conn.SourceNode_ID)?.Type === 'Source' && conn.TypeRegle === 'FIXED')
                    .reduce((sum, conn) => sum + parseFloat(conn.Valeur || 0), 0);
                  const remaining = Math.max(0, salaryConfig.MontantNet - totalFixed);
                  outgoingSplit += remaining * (parseFloat(c.Valeur || 0) / 100);
                }
              }
            }
          });
          salaryReceived -= outgoingSplit;
        }
      }
      tempBal = tempBal - salaryReceived + debitsSum;
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





  // Formatters
  /**
   * Formats a numeric value into a Euro currency string.
   * @param {number|string} value - The numeric value.
   * @returns {string} The formatted currency string.
   */
  function formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  /**
   * Formats an ISO date string into a French readable date (DD/MM/YYYY HH:MM).
   * @param {string} dateStr - The ISO date string.
   * @returns {string} The formatted date string.
   */
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateStr));
  }

  // Safe Fallback UUID Generator
  /**
   * Generates a standard RFC4122 v4 UUID.
   * @returns {string} A random UUID.
   */
  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Show Toast
  /**
   * Displays a toast notification with the specified message.
   * @param {string} message - The message to show.
   */
  function showToast(message) {
    toastMessage = message;
    console.log("Toast:", message);
    try {
      if (toastRef && typeof toastRef.show === 'function') {
        toastRef.show();
      }
    } catch (e) {
      console.warn("Could not display toast alert:", e);
    }
  }


  // Drag & drop handlers for visual flow nodes
  /**
   * Handles the mousedown event on a flow node to start drag operations.
   * @param {MouseEvent} e - The mousedown event.
   * @param {object} node - The flow node object.
   */
  function handleMouseDown(e, node) {
    activeDragNode = node;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Handles the mousemove event to update the dragged flow node's position.
   * @param {MouseEvent} e - The mousemove event.
   */
  function handleMouseMove(e) {
    if (activeDragNode) {
      const container = document.getElementById('flow-graph-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const x = Math.round(e.clientX - containerRect.left - dragOffset.x);
      const y = Math.round(e.clientY - containerRect.top - dragOffset.y);
      activeDragNode.PosX = Math.max(10, Math.min(680, x));
      activeDragNode.PosY = Math.max(10, Math.min(480, y));
    }
  }

  /**
   * Handles the mouseup event to complete dragging and save node coordinates.
   * @returns {Promise<void>}
   */
  async function handleMouseUp() {
    if (activeDragNode) {
      const nodeToSave = activeDragNode;
      activeDragNode = null;
      try {
        await fetch(`/odata/v4/patrimoine/FlowNodes(${nodeToSave.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ PosX: nodeToSave.PosX, PosY: nodeToSave.PosY })
        });
      } catch (err) {
        console.error("Erreur de sauvegarde de position:", err);
      }
    }
  }

  // Client-side DAG simulator to preview split
  /**
   * Simulates the salary split calculation locally using flow nodes and connections.
   * @param {number} salaryAmount - The net salary amount.
   * @returns {object[]} The list of simulated split allocations.
   */
  function simulateGraphSplit(salaryAmount) {
    if (!flowNodes || flowNodes.length === 0 || !flowConnections || flowConnections.length === 0 || !salaryAmount || salaryAmount <= 0) return [];
    
    const nodesMap = new Map(flowNodes.map(n => [n.ID, { ...n }]));
    const outgoing = new Map(flowNodes.map(n => [n.ID, []]));
    const inDegrees = {};
    for (const node of flowNodes) {
      inDegrees[node.ID] = 0;
    }
    for (const conn of flowConnections) {
      if (outgoing.has(conn.SourceNode_ID)) {
        outgoing.get(conn.SourceNode_ID).push(conn);
      }
      inDegrees[conn.TargetNode_ID] = (inDegrees[conn.TargetNode_ID] || 0) + 1;
    }

    const incomingBalances = {};
    for (const node of flowNodes) {
      incomingBalances[node.ID] = 0;
    }

    const queue = [];
    for (const node of flowNodes) {
      if (inDegrees[node.ID] === 0 || node.Type === 'Source') {
        queue.push(node.ID);
      }
    }

    const sourceNodes = flowNodes.filter(n => n.Type === 'Source');
    if (sourceNodes.length > 0) {
      incomingBalances[sourceNodes[0].ID] = salaryAmount;
    } else if (queue.length > 0) {
      incomingBalances[queue[0]] = salaryAmount;
    }

    const allocations = [];
    const visited = {};

    while (queue.length > 0) {
      const currId = queue.shift();
      visited[currId] = (visited[currId] || 0) + 1;
      if (visited[currId] > 30) continue;

      const currNode = nodesMap.get(currId);
      const currAmount = incomingBalances[currId];
      if (!currNode || currAmount <= 0) continue;

      const conns = outgoing.get(currId) || [];
      if (conns.length === 0) continue;

      const fixedConns = conns.filter(c => c.TypeRegle === 'FIXED');
      const percentConns = conns.filter(c => c.TypeRegle === 'PERCENT');

      let remaining = currAmount;

      for (const conn of fixedConns) {
        const val = parseFloat(conn.Valeur || 0);
        const allocated = Math.round(Math.min(remaining, val) * 100) / 100;
        if (allocated > 0) {
          remaining -= allocated;
          incomingBalances[conn.TargetNode_ID] += allocated;
          const targetNode = nodesMap.get(conn.TargetNode_ID);
          allocations.push({
            sourceLabel: currNode.Label,
            targetLabel: targetNode ? targetNode.Label : 'Inconnu',
            amount: allocated,
            type: 'FIXED',
            valeur: val
          });
        }
        inDegrees[conn.TargetNode_ID]--;
        if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
          queue.push(conn.TargetNode_ID);
        }
      }

      const totalPercentSource = currAmount;
      for (const conn of percentConns) {
        const percent = parseFloat(conn.Valeur || 0);
        const val = totalPercentSource * (percent / 100);
        const allocated = Math.round(Math.min(remaining, val) * 100) / 100;
        if (allocated > 0) {
          remaining -= allocated;
          incomingBalances[conn.TargetNode_ID] += allocated;
          const targetNode = nodesMap.get(conn.TargetNode_ID);
          allocations.push({
            sourceLabel: currNode.Label,
            targetLabel: targetNode ? targetNode.Label : 'Inconnu',
            amount: allocated,
            type: 'PERCENT',
            valeur: percent
          });
        }
        inDegrees[conn.TargetNode_ID]--;
        if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
          queue.push(conn.TargetNode_ID);
        }
      }
    }

    return allocations;
  }

  // Load All Data from OData v4 backend
  /**
   * Loads all financial data, configurations, rules, and logs from the CAP OData backend.
   * @returns {Promise<void>}
   */
  async function loadData() {
    loading = true;
    try {
      const [accRes, salRes, ruleRes, txRes, debRes, logRes, nodeRes, connRes, rateRes, stockRes, pendingRes] = await Promise.all([
        fetch('/odata/v4/patrimoine/Accounts'),
        fetch('/odata/v4/patrimoine/SalaryConfig'),
        fetch('/odata/v4/patrimoine/AllocationRules?$expand=Account'),
        fetch('/odata/v4/patrimoine/Transactions?$orderby=Date desc'),
        fetch('/odata/v4/patrimoine/RecurringDebits?$expand=Account'),
        fetch('/odata/v4/patrimoine/ExecutionLogs?$orderby=Timestamp desc'),
        fetch('/odata/v4/patrimoine/FlowNodes?$expand=Account'),
        fetch('/odata/v4/patrimoine/FlowConnections'),
        fetch('/odata/v4/patrimoine/InterestRateHistory'),
        fetch('/odata/v4/patrimoine/StockFluctuations'),
        fetch('/odata/v4/patrimoine/PendingTransactions?$expand=AccountSource,AccountTarget')
      ]);

      if (accRes.ok) {
        const data = await accRes.json();
        accounts = data.value || [];
      }
      if (salRes.ok) {
        const data = await salRes.json();
        salaryConfig = data.value && data.value[0] ? data.value[0] : null;
        if (salaryConfig) {
          currentSalaryAmount = parseFloat(salaryConfig.MontantNet);
        }
      }
      if (ruleRes.ok) {
        const data = await ruleRes.json();
        allocationRules = data.value || [];
      }
      if (txRes.ok) {
        const data = await txRes.json();
        transactions = data.value || [];
      }
      if (debRes.ok) {
        const data = await debRes.json();
        recurringDebits = data.value || [];
      }
      if (logRes.ok) {
        const data = await logRes.json();
        executionLogs = data.value || [];
      }
      if (nodeRes.ok) {
        const data = await nodeRes.json();
        flowNodes = data.value || [];
      }
      if (connRes.ok) {
        const data = await connRes.json();
        flowConnections = data.value || [];
      }
      if (rateRes.ok) {
        const data = await rateRes.json();
        interestRateHistory = data.value || [];
      }
      if (stockRes.ok) {
        const data = await stockRes.json();
        stockFluctuations = data.value || [];
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        const rawPending = data.value || [];
        pendingTransactions = rawPending.map(item => ({ ...item, checked: true }));
        if (pendingTransactions.length > 0 && wizardActiveStep === 1) {
          wizardActiveStep = 4;
        }
      }
    } catch (err) {
      console.error("Erreur de chargement des données : ", err);
      showToast("Erreur de connexion avec le serveur CAP.");
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (window.innerWidth < 768) {
      sidebarCollapsed = true;
    }
    loadData();
  });


  // Programmatic event listener registration for UI5 side navigation to resolve custom dashed event issues in Svelte 5
  $effect(() => {
    if (sideNavRef) {
      const listener = (event) => handleNavChange(event);
      sideNavRef.addEventListener('selection-change', listener);
      return () => {
        sideNavRef.removeEventListener('selection-change', listener);
      };
    }
  });

  // Derived KPIs
  let totalWealth = $derived(accounts.reduce((sum, acc) => sum + parseFloat(acc.SoldeActuel || 0), 0));
  let totalSavings = $derived(accounts.filter(acc => acc.Type !== 'Courant').reduce((sum, acc) => sum + parseFloat(acc.SoldeActuel || 0), 0));
  let totalCharges = $derived(recurringDebits.filter(deb => deb.Actif).reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0));

  // Color Palette for charts
  const COLORS = ['#0a6ed1', '#107e3e', '#e9730c', '#6f42c1', '#17a2b8', '#007bff', '#28a745', '#ffc107', '#dc3545'];
  /**
   * Returns a color from the dashboard chart color palette.
   * @param {number} index - The palette index.
   * @returns {string} The hex color code.
   */
  function getColor(index) {
    return COLORS[index % COLORS.length];
  }

  // SVG Chart slice calculation
  function getCoordinatesForPercent(percent) {
    const x = Math.cos(2 * Math.PI * percent - Math.PI / 2);
    const y = Math.sin(2 * Math.PI * percent - Math.PI / 2);
    return [x, y];
  }

  let chartPaths = $derived.by(() => {
    if (totalWealth <= 0) return [];
    let cumulativePercent = 0;
    const activeAccounts = accounts.filter(a => parseFloat(a.SoldeActuel) > 0);
    
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

  // Dynamic Rule Validation based on Graph connections
  let rulesSummary = $derived.by(() => {
    let totalFixed = 0;
    let totalPercent = 0;
    flowConnections.forEach(c => {
      const srcNode = flowNodes.find(n => n.ID === c.SourceNode_ID);
      if (srcNode && srcNode.Type === 'Source') {
        if (c.TypeRegle === 'FIXED') totalFixed += parseFloat(c.Valeur || 0);
        else totalPercent += parseFloat(c.Valeur || 0);
      }
    });

    const allocatedFixed = totalFixed;
    const remainingForPercent = Math.max(0, currentSalaryAmount - totalFixed);
    const allocatedPercent = remainingForPercent * (totalPercent / 100);
    const totalAllocated = totalFixed + allocatedPercent;
    
    return {
      totalFixed,
      totalPercent,
      totalAllocated,
      isValid: totalFixed <= currentSalaryAmount && totalPercent <= 100
    };
  });

  // ACCOUNTS CRUD
  /**
   * Opens the dialog to add a new bank account.
   */
  function openAddAccount() {
    accountForm = { ID: '', Libelle: '', Type: 'Courant', SoldeActuel: 0, TypePlacement: 'Courant', DateMaturite: '', TauxActuel: 0, IBAN: '' };
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
    if (!accountForm.Libelle) {
      showToast("Le libellé est requis.");
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
        payload.ID = generateUUID();
        res = await fetch('/odata/v4/patrimoine/Accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        showToast(isEditingAccount ? "Compte mis à jour." : "Compte créé.");
        await loadData();
      } else {
        const err = await res.json();
        showToast("Erreur: " + (err.error?.message || "Action impossible."));
      }
    } catch (e) {
      showToast("Erreur lors de la sauvegarde.");
    }
  }





  /**
   * Deletes a bank account by ID.
   * @param {string} id - The UUID of the account to delete.
   * @returns {Promise<void>}
   */
  async function deleteAccount(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce compte ? Cela supprimera également les règles et abonnements liés.")) return;

    try {
      const res = await fetch(`/odata/v4/patrimoine/Accounts(${id})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast("Compte supprimé.");
        loadData();
      } else {
        showToast("Impossible de supprimer ce compte.");
      }
    } catch (e) {
      showToast("Erreur de suppression.");
    }
  }

  // ALLOCATION RULES CRUD
  /**
   * Opens the dialog to add a new allocation rule.
   */
  function openAddRule() {
    if (accounts.length === 0) {
      showToast("Créez d'abord un compte.");
      return;
    }
    ruleForm = { ID: '', Account_ID: accounts[0].ID, PourcentageOuMontantFixe: 'PERCENT', Valeur: 0 };
    isEditingRule = false;
    isRuleDialogOpen = true;
    if (ruleDialogRef && typeof ruleDialogRef.show === 'function') {
      ruleDialogRef.show();
    }
  }

  /**
   * Opens the dialog to edit an existing allocation rule.
   * @param {object} rule - The allocation rule object.
   */
  function openEditRule(rule) {
    ruleForm = { 
      ID: rule.ID, 
      Account_ID: rule.Account_ID || (rule.Account ? rule.Account.ID : ''),
      PourcentageOuMontantFixe: rule.PourcentageOuMontantFixe,
      Valeur: rule.Valeur
    };
    isEditingRule = true;
    isRuleDialogOpen = true;
    if (ruleDialogRef && typeof ruleDialogRef.show === 'function') {
      ruleDialogRef.show();
    }
  }

  /**
   * Saves the allocation rule currently in the form (creates or updates).
   * @returns {Promise<void>}
   */
  async function saveRule() {
    if (!ruleForm.Account_ID) {
      showToast("Sélectionnez un compte cible.");
      return;
    }
    if (parseFloat(ruleForm.Valeur) <= 0) {
      showToast("Saisissez une valeur supérieure à 0.");
      return;
    }

    // Close the dialog immediately (optimistic UI)
    isRuleDialogOpen = false;
    if (ruleDialogRef) {
      try {
        ruleDialogRef.open = false;
        ruleDialogRef.removeAttribute('open');
        if (typeof ruleDialogRef.close === 'function') {
          ruleDialogRef.close();
        }
      } catch (err) {
        console.error("Error closing rule dialog:", err);
      }
    }

    try {
      let res;
      const payload = {
        Account_ID: ruleForm.Account_ID,
        PourcentageOuMontantFixe: ruleForm.PourcentageOuMontantFixe,
        Valeur: parseFloat(ruleForm.Valeur)
      };

      if (isEditingRule) {
        res = await fetch(`/odata/v4/patrimoine/AllocationRules(${ruleForm.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        payload.ID = generateUUID();
        res = await fetch('/odata/v4/patrimoine/AllocationRules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        showToast("Règle enregistrée.");
        await loadData();
      } else {
        showToast("Erreur lors de la sauvegarde.");
      }
    } catch (e) {
      showToast("Erreur de connexion.");
    }
  }





  /**
   * Deletes an allocation rule by ID.
   * @param {string} id - The UUID of the rule to delete.
   * @returns {Promise<void>}
   */
  async function deleteRule(id) {
    if (!confirm("Supprimer cette règle de répartition ?")) return;

    try {
      const res = await fetch(`/odata/v4/patrimoine/AllocationRules(${id})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast("Règle supprimée.");
        loadData();
      } else {
        showToast("Erreur de suppression.");
      }
    } catch (e) {
      showToast("Erreur de connexion.");
    }
  }

  // FLOW NODES & CONNECTIONS CRUD
  /**
   * Opens the flow nodes management list dialog.
   */
  function openManageNodes() {
    if (nodesListDialogRef) {
      nodesListDialogRef.open = true;
      if (typeof nodesListDialogRef.show === 'function') nodesListDialogRef.show();
    }
  }

  /**
   * Opens the flow connections management list dialog.
   */
  function openManageConnections() {
    if (connectionsListDialogRef) {
      connectionsListDialogRef.open = true;
      if (typeof connectionsListDialogRef.show === 'function') connectionsListDialogRef.show();
    }
  }

  /**
   * Opens the dialog to add a new flow node.
   */
  function openAddNode() {
    nodeForm = { Label: '', Type: 'Transit', Account_ID: '' };
    if (nodeDialogRef) {
      nodeDialogRef.open = true;
      if (typeof nodeDialogRef.show === 'function') nodeDialogRef.show();
    }
  }

  /**
   * Saves the flow node currently in the form.
   * @returns {Promise<void>}
   */
  async function saveNode() {
    try {
      const posX = 100 + Math.floor(Math.random() * 200);
      const posY = 100 + Math.floor(Math.random() * 200);
      
      const payload = {
        Label: nodeForm.Label || 'Nouveau Nœud',
        Type: nodeForm.Type,
        Account_ID: nodeForm.Account_ID ? nodeForm.Account_ID : null,
        PosX: posX,
        PosY: posY
      };

      const res = await fetch('/odata/v4/patrimoine/FlowNodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Nœud créé avec succès !");
        if (nodeDialogRef) {
          nodeDialogRef.open = false;
          if (typeof nodeDialogRef.close === 'function') nodeDialogRef.close();
        }
        await loadData();
      } else {
        showToast("Erreur lors de la création du nœud.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Deletes a flow node by ID.
   * @param {string} id - The UUID of the node to delete.
   * @returns {Promise<void>}
   */
  async function deleteNode(id) {
    if (!confirm("Voulez-vous supprimer ce nœud ? Ses liaisons associées seront également supprimées.")) return;
    try {
      const connectedConns = flowConnections.filter(c => c.SourceNode_ID === id || c.TargetNode_ID === id);
      for (const conn of connectedConns) {
        await fetch(`/odata/v4/patrimoine/FlowConnections(${conn.ID})`, { method: 'DELETE' });
      }

      const res = await fetch(`/odata/v4/patrimoine/FlowNodes(${id})`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Nœud supprimé.");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Opens the dialog to add a new flow connection.
   */
  function openAddConnection() {
    connectionForm = { SourceNode_ID: '', TargetNode_ID: '', TypeRegle: 'PERCENT', Valeur: 0 };
    if (connectionDialogRef) {
      connectionDialogRef.open = true;
      if (typeof connectionDialogRef.show === 'function') connectionDialogRef.show();
    }
  }

  /**
   * Saves the flow connection currently in the form.
   * @returns {Promise<void>}
   */
  async function saveConnection() {
    if (!connectionForm.SourceNode_ID || !connectionForm.TargetNode_ID) {
      showToast("Veuillez sélectionner un nœud source et cible.");
      return;
    }
    if (connectionForm.SourceNode_ID === connectionForm.TargetNode_ID) {
      showToast("Le nœud source et cible ne peuvent pas être identiques.");
      return;
    }
    try {
      const payload = {
        SourceNode_ID: connectionForm.SourceNode_ID,
        TargetNode_ID: connectionForm.TargetNode_ID,
        TypeRegle: connectionForm.TypeRegle,
        Valeur: parseFloat(connectionForm.Valeur || 0)
      };

      const res = await fetch('/odata/v4/patrimoine/FlowConnections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Liaison créée avec succès !");
        if (connectionDialogRef) {
          connectionDialogRef.open = false;
          if (typeof connectionDialogRef.close === 'function') connectionDialogRef.close();
        }
        await loadData();
      } else {
        showToast("Erreur lors de la création de la liaison.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Deletes a flow connection by ID.
   * @param {string} id - The UUID of the connection to delete.
   * @returns {Promise<void>}
   */
  async function deleteConnection(id) {
    if (!confirm("Voulez-vous supprimer cette liaison ?")) return;
    try {
      const res = await fetch(`/odata/v4/patrimoine/FlowConnections(${id})`, { method: 'DELETE' });
      if (res.ok) {
        showToast("Liaison supprimée.");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // RECURRING DEBITS CRUD
  /**
   * Opens the dialog to add a new recurring debit.
   */
  function openAddDebit() {
    if (accounts.length === 0) {
      showToast("Créez d'abord un compte.");
      return;
    }
    debitForm = { ID: '', Libelle: '', Montant: 0, JourDuMois: 5, Account_ID: accounts[0].ID, Actif: true, Type: 'Automatique' };
    isEditingDebit = false;
    isDebitDialogOpen = true;
    if (debitDialogRef && typeof debitDialogRef.show === 'function') {
      debitDialogRef.show();
    }
  }

  /**
   * Opens the dialog to edit an existing recurring debit.
   * @param {object} deb - The recurring debit object.
   */
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

  /**
   * Saves the recurring debit currently in the form (creates or updates).
   * @returns {Promise<void>}
   */
  async function saveDebit() {
    if (!debitForm.Libelle) {
      showToast("Le libellé est requis.");
      return;
    }
    if (parseFloat(debitForm.Montant) <= 0) {
      showToast("Le montant doit être supérieur à 0.");
      return;
    }

    // Close the dialog immediately (optimistic UI)
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
        payload.ID = generateUUID();
        res = await fetch('/odata/v4/patrimoine/RecurringDebits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        showToast("Charge récurrente sauvegardée.");
        await loadData();
      } else {
        showToast("Erreur lors de la sauvegarde.");
      }
    } catch (e) {
      showToast("Erreur de connexion.");
    }
  }




  /**
   * Toggles the active status of a recurring debit.
   * @param {object} deb - The recurring debit object.
   * @param {any} event - The switch toggle event.
   * @returns {Promise<void>}
   */
  async function toggleDebitStatus(deb, event) {
    const isChecked = event.target.checked;
    try {
      const res = await fetch(`/odata/v4/patrimoine/RecurringDebits(${deb.ID})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Actif: isChecked })
      });
      if (res.ok) {
        showToast(isChecked ? `Abonnement "${deb.Libelle}" activé.` : `Abonnement "${deb.Libelle}" désactivé.`);
        loadData();
      } else {
        showToast("Erreur lors de la modification de l'état.");
      }
    } catch (e) {
      showToast("Erreur de connexion.");
    }
  }

  /**
   * Deletes a recurring debit by ID.
   * @param {string} id - The UUID of the debit to delete.
   * @returns {Promise<void>}
   */
  async function deleteDebit(id) {
    if (!confirm("Supprimer cette charge récurrente ?")) return;

    try {
      const res = await fetch(`/odata/v4/patrimoine/RecurringDebits(${id})`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast("Charge récurrente supprimée.");
        loadData();
      } else {
        showToast("Erreur de suppression.");
      }
    } catch (e) {
      showToast("Erreur de connexion.");
    }
  }

  // SAVE CONFIRMED TRANSFERS TO BACKEND (INLINE EXECUTION)
  /**
   * Submits the confirmed proposed split transactions to the backend.
   * @returns {Promise<void>}
   */
  async function saveConfirmedSplit() {
    const checkedTxs = proposedTransactions.filter(tx => tx.checked);
    if (checkedTxs.length === 0) {
      showToast("Veuillez cocher au moins une transaction.");
      return;
    }

    loading = true;
    executionStatus = null;
    const startTime = Date.now();
    try {
      // First, save current net salary amount config in DB
      if (salaryConfig) {
        await fetch(`/odata/v4/patrimoine/SalaryConfig(${salaryConfig.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MontantNet: currentSalaryAmount })
        });
      } else {
        await fetch('/odata/v4/patrimoine/SalaryConfig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ID: generateUUID(),
            MontantBrut: currentSalaryAmount * 1.3,
            MontantNet: currentSalaryAmount,
            JourDePaie: 28
          })
        });
      }

      const res = await fetch('/odata/v4/patrimoine/saveConfirmedSalarySplit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionsJson: JSON.stringify(checkedTxs),
          salaryAmount: currentSalaryAmount
        })
      });

      if (res.ok) {
        const resultLog = await res.json();
        if (resultLog.Statut === 'SUCCESS') {
          showToast("Virements cochés enregistrés avec succès !");
          executionStatus = { design: 'Positive', message: resultLog.Message };
          proposedTransactions = [];
          wizardActiveStep = 4;

          // Highlight nodes in the UI
          const details = JSON.parse(resultLog.DetailsJSON || '{}');
          if (details.transactions) {
            nodeAllocatedAmounts = {};
            details.transactions.forEach(tx => {
              if (tx.AccountTarget_ID) {
                nodeAllocatedAmounts[tx.AccountTarget_ID] = (nodeAllocatedAmounts[tx.AccountTarget_ID] || 0) + tx.Montant;
              }
              if (tx.AccountSource_ID) {
                const srcNode = flowNodes.find(n => n.Account_ID === tx.AccountSource_ID);
                if (srcNode && srcNode.Type === 'Source') {
                  nodeAllocatedAmounts[srcNode.ID] = currentSalaryAmount;
                }
              }
            });
          }
          await loadData();
        } else {
          showToast(`Échec : ${resultLog.Message}`);
          executionStatus = { design: 'Negative', message: resultLog.Message };
        }
      } else {
        const errorDetail = await res.json();
        showToast(`Erreur service : ${errorDetail.error?.message || 'Inconnue'}`);
        executionStatus = { design: 'Negative', message: `Erreur service : ${errorDetail.error?.message || 'Inconnue'}` };
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur technique lors de l'enregistrement.");
      executionStatus = { design: 'Negative', message: "Erreur technique lors de l'enregistrement." };
    } finally {
      const duration = Date.now() - startTime;
      const minDuration = 500;
      if (duration < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - duration));
      }
      loading = false;
    }
  }


  // SAVE SELECTED PENDING TRANSACTIONS (FROM DISTRIBUTION VIEW TABLE)
  /**
   * Saves all checked pending transactions.
   * @returns {Promise<void>}
   */
  async function saveSelectedPending() {
    const checkedPending = pendingTransactions.filter(tx => tx.checked);
    if (checkedPending.length === 0) {
      showToast("Veuillez cocher au moins une transaction à enregistrer.");
      return;
    }

    loading = true;
    executionStatus = null;
    const startTime = Date.now();
    try {
      const mappedTxs = checkedPending.map(tx => {
        return {
          ID: tx.ID,
          Date: tx.Date,
          Libelle: tx.Libelle,
          Montant: tx.Montant,
          Type: tx.Type,
          AccountSource_ID: tx.AccountSource_ID,
          AccountSourceLibelle: tx.AccountSource ? tx.AccountSource.Libelle : (tx.AccountSourceLibelle || 'Source'),
          AccountTarget_ID: tx.AccountTarget_ID,
          AccountTargetLibelle: tx.AccountTarget ? tx.AccountTarget.Libelle : (tx.AccountTargetLibelle || 'Cible'),
          TypeRegle: tx.TypeRegle,
          Valeur: tx.Valeur
        };
      });

      const res = await fetch('/odata/v4/patrimoine/saveConfirmedSalarySplit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionsJson: JSON.stringify(mappedTxs),
          salaryAmount: currentSalaryAmount
        })
      });

      if (res.ok) {
        const resultLog = await res.json();
        if (resultLog.Statut === 'SUCCESS') {
          showToast("Virements sélectionnés enregistrés avec succès !");
          executionStatus = { design: 'Positive', message: resultLog.Message };
          await loadData();
        } else {
          showToast(`Échec : ${resultLog.Message}`);
          executionStatus = { design: 'Negative', message: resultLog.Message };
        }
      } else {
        const errorDetail = await res.json();
        showToast(`Erreur service : ${errorDetail.error?.message || 'Inconnue'}`);
        executionStatus = { design: 'Negative', message: `Erreur service : ${errorDetail.error?.message || 'Inconnue'}` };
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur technique lors de l'enregistrement.");
      executionStatus = { design: 'Negative', message: "Erreur technique lors de l'enregistrement." };
    } finally {
      const duration = Date.now() - startTime;
      const minDuration = 500;
      if (duration < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - duration));
      }
      loading = false;
    }
  }


  // REAL-TIME ACTIONS FOR PENDING TRANSACTIONS (VALIDATE, DELETE, EDIT)
  /**
   * Validates and saves a single pending transaction.
   * @param {object} tx - The transaction object to validate.
   * @returns {Promise<void>}
   */
  async function validateSinglePending(tx) {
    loading = true;
    try {
      const txPayload = {
        ID: generateUUID(),
        Date: new Date().toISOString().slice(0, 19) + 'Z',
        Libelle: tx.Libelle,
        Montant: parseFloat(tx.Montant),
        Type: tx.Type || 'Virement_Split',
        AccountSource_ID: tx.AccountSource_ID,
        AccountTarget_ID: tx.AccountTarget_ID
      };
      
      const txRes = await fetch('/odata/v4/patrimoine/Transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txPayload)
      });
      
      if (!txRes.ok) {
        showToast("Erreur lors de l'enregistrement de la transaction.");
        loading = false;
        return;
      }

      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });

      if (delRes.ok) {
        // Create ExecutionLog
        const logPayload = {
          ID: generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Validation virement restant : "${tx.Libelle}" de ${formatCurrency(tx.Montant)} enregistré.`,
          DetailsJSON: JSON.stringify({ validatedTransaction: txPayload }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        showToast(`Virement "${tx.Libelle}" validé avec succès !`);
        await loadData();
      } else {
        showToast("Erreur lors de la suppression du virement en attente.");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de connexion.");
    } finally {
      loading = false;
    }
  }

  /**
   * Deletes a single pending transaction.
   * @param {object} tx - The transaction object to delete.
   * @returns {Promise<void>}
   */
  async function deleteSinglePending(tx) {
    loading = true;
    try {
      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });

      if (delRes.ok) {
        const logPayload = {
          ID: generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Annulation virement restant : "${tx.Libelle}" de ${formatCurrency(tx.Montant)} supprimé.`,
          DetailsJSON: JSON.stringify({ deletedTransaction: tx }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        showToast(`Virement "${tx.Libelle}" supprimé.`);
        await loadData();
      } else {
        showToast("Erreur lors de la suppression du virement.");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de connexion.");
    } finally {
      loading = false;
    }
  }

  /**
   * Opens the dialog to edit a pending transaction.
   * @param {object} tx - The transaction object.
   */
  function openEditPending(tx) {
    pendingForm = { 
      ID: tx.ID, 
      Libelle: tx.Libelle, 
      Montant: tx.Montant, 
      AccountSource_ID: tx.AccountSource_ID || '', 
      AccountTarget_ID: tx.AccountTarget_ID || '' 
    };
    isPendingFormDialogOpen = true;
    if (editPendingDialogRef && typeof editPendingDialogRef.show === 'function') {
      editPendingDialogRef.show();
    }
  }

  /**
   * Saves the pending transaction currently in the edit form.
   * @returns {Promise<void>}
   */
  async function saveEditedPending() {
    if (!pendingForm.Libelle || pendingForm.Montant <= 0) {
      showToast("Veuillez saisir un libellé et un montant valide.");
      return;
    }
    
    loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/PendingTransactions(${pendingForm.ID})`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Libelle: pendingForm.Libelle,
          Montant: parseFloat(pendingForm.Montant),
          AccountSource_ID: pendingForm.AccountSource_ID || null,
          AccountTarget_ID: pendingForm.AccountTarget_ID || null
        })
      });

      if (res.ok) {
        const logPayload = {
          ID: generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Modification virement restant : "${pendingForm.Libelle}" mis à jour à ${formatCurrency(pendingForm.Montant)}.`,
          DetailsJSON: JSON.stringify({ updatedTransaction: pendingForm }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        showToast("Virement en attente mis à jour.");
        isPendingFormDialogOpen = false;
        if (editPendingDialogRef && typeof editPendingDialogRef.close === 'function') {
          editPendingDialogRef.close();
        }
        await loadData();
      } else {
        showToast("Erreur lors de la modification du virement.");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de connexion.");
    } finally {
      loading = false;
    }
  }

  /**
   * Removes a proposed transaction from the simulation list.
   * @param {object} tx - The transaction object.
   * @param {number} index - The list index of the transaction.
   * @returns {Promise<void>}
   */
  async function deleteProposedTx(tx, index) {
    loading = true;
    try {
      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });
      if (delRes.ok) {
        const logPayload = {
          ID: generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Annulation virement proposé : "${tx.Libelle}" de ${formatCurrency(tx.Montant)} supprimé.`,
          DetailsJSON: JSON.stringify({ cancelledProposedTransaction: tx }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        proposedTransactions = proposedTransactions.filter((_, i) => i !== index);
        showToast(`Virement "${tx.Libelle}" retiré de la proposition.`);
        await loadData();
      } else {
        showToast("Erreur lors de la suppression de la proposition.");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur de connexion.");
    } finally {
      loading = false;
    }
  }


  // LOGS DETAIL VIEW
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

  function handleNavChange(event) {
    const selectedItem = event.detail.item;
    activeTab = selectedItem.getAttribute('data-tab');
    if (window.innerWidth < 768) {
      sidebarCollapsed = true;
    }
  }


  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }
</script>

<div class="app-container">
  <!-- Header Top Bar -->
  <header class="app-header">
    <div class="header-left">
      <button class="menu-toggle" onclick={toggleSidebar} title={i18n.t('sidebar.toggle')}>
        <ui5-icon name="menu" style="color: var(--sap-primary-color);"></ui5-icon>
      </button>
      <div class="header-logo">
        <ui5-icon name="money-bills"></ui5-icon>
        {i18n.t('header.title')}
        <span class="header-logo-sub">| {i18n.t('header.subtitle')}</span>
      </div>
    </div>
    <div class="header-right">
      <span class="env-badge">{i18n.t('header.btpDev')}</span>
      
      <!-- Language Selector Dropdown -->
      <ui5-select 
        class="lang-select" 
        onchange={(e) => i18n.setLanguage(e.target.value)} 
        style="width: 70px; margin-right: 15px; height: 32px;"
      >
        <ui5-option value="fr" selected={i18n.currentLang === 'fr'}>FR</ui5-option>
        <ui5-option value="en" selected={i18n.currentLang === 'en'}>EN</ui5-option>
      </ui5-select>

      <ui5-icon name="employee" style="color: var(--sap-text-muted-color); width: 24px; height: 24px; cursor: pointer;"></ui5-icon>
    </div>
  </header>

  <!-- Main Body -->
  <div class="app-main">
    <!-- Sidebar Navigation -->
    <aside class="app-sidebar {sidebarCollapsed ? 'collapsed' : ''}">
      <ui5-side-navigation bind:this={sideNavRef}>
        <ui5-side-navigation-item 
          text={i18n.t('nav.dashboard')} 
          icon="home" 
          selected={activeTab === 'dashboard'} 
          data-tab="dashboard">
        </ui5-side-navigation-item>
        <ui5-side-navigation-item 
          text={i18n.t('nav.accounts')} 
          icon="wallet" 
          selected={activeTab === 'comptes'} 
          data-tab="comptes">
        </ui5-side-navigation-item>
        <ui5-side-navigation-item 
          text={i18n.t('nav.distribution')} 
          icon="process" 
          selected={activeTab === 'distribution'} 
          data-tab="distribution">
        </ui5-side-navigation-item>
        <ui5-side-navigation-item 
          text={i18n.t('nav.flowGraph')} 
          icon="org-chart" 
          selected={activeTab === 'graphe'} 
          data-tab="graphe">
        </ui5-side-navigation-item>
        <ui5-side-navigation-item 
          text={i18n.t('nav.recurring')} 
          icon="credit-card" 
          selected={activeTab === 'abonnements'} 
          data-tab="abonnements">
        </ui5-side-navigation-item>
        <ui5-side-navigation-item 
          text={i18n.t('nav.calendar')} 
          icon="calendar" 
          selected={activeTab === 'calendar'} 
          data-tab="calendar">
        </ui5-side-navigation-item>

        <ui5-side-navigation-item 
          text={i18n.t('nav.logs')} 
          icon="document-text" 
          selected={activeTab === 'logs'} 
          data-tab="logs">
        </ui5-side-navigation-item>
      </ui5-side-navigation>
    </aside>

    <!-- Main Content Area -->
    <main class="app-content">
      
      <!-- 1. DASHBOARD VIEW -->
      {#if activeTab === 'dashboard'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('dash.title')}</h1>
          <ui5-button icon="refresh" design="Transparent" onclick={loadData} title={i18n.t('dash.titleRefresh')}></ui5-button>
        </div>

        <!-- KPI Cards -->
        <div class="dashboard-kpis">
          <div class="kpi-card kpi-patrimoine">
            <span class="kpi-title">{i18n.t('dash.kpiWealth')}</span>
            <span class="kpi-value">{formatCurrency(totalWealth)}</span>
            <span class="kpi-subtitle">{i18n.t('dash.kpiWealthSub', { count: accounts.length })}</span>
          </div>
          <div class="kpi-card kpi-epargne">
            <span class="kpi-title">{i18n.t('dash.kpiSavings')}</span>
            <span class="kpi-value">{formatCurrency(totalSavings)}</span>
            <span class="kpi-subtitle">{i18n.t('dash.kpiSavingsSub')}</span>
          </div>
          <div class="kpi-card kpi-charges">
            <span class="kpi-title">{i18n.t('dash.kpiCharges')}</span>
            <span class="kpi-value">{formatCurrency(totalCharges)}</span>
            <span class="kpi-subtitle">{i18n.t('dash.kpiChargesSub')}</span>
          </div>
        </div>

        <!-- Secondary Grid -->
        <div class="grid-2col">
          <!-- Left: Accounts summary -->
          <div class="sap-card">
            <div class="sap-card-header">
              <span class="sap-card-title">{i18n.t('dash.cardTitle')}</span>
              <ui5-button design="Emphasized" icon="add" onclick={() => activeTab = 'comptes'}>{i18n.t('dash.manageAccounts')}</ui5-button>
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
                  {#each accounts as acc}
                    <tr>
                      <td style="font-weight: 600;">{acc.Libelle}</td>
                      <td>
                        <span class="badge" style="background-color: var(--sap-background-color); color: var(--sap-text-color);">
                          {acc.Type}
                        </span>
                      </td>
                      <td style="text-align: right; font-weight: bold; color: {acc.SoldeActuel < 0 ? 'var(--sap-error-color)' : 'var(--sap-text-color)'}">
                        {formatCurrency(acc.SoldeActuel)}
                      </td>
                    </tr>
                  {/each}
                  {#if accounts.length === 0}
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
                      {formatCurrency(totalWealth)}
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
                {#each transactions.slice(0, 5) as tx}
                  <tr>
                    <td>{formatDate(tx.Date)}</td>
                    <td style="font-weight: 500;">{tx.Libelle}</td>
                    <td class="hide-on-mobile">
                      <span class="badge {tx.Type === 'Entree' ? 'badge-success' : tx.Type === 'Sortie' ? 'badge-error' : 'badge-warning'}">
                        {tx.Type === 'Virement_Split' ? 'Virement Split' : tx.Type}
                      </span>
                    </td>
                    <td style="text-align: right; font-weight: bold; color: {tx.Type === 'Sortie' ? 'var(--sap-error-color)' : 'var(--sap-success-color)'}">
                      {tx.Type === 'Sortie' ? '-' : '+'}{formatCurrency(tx.Montant)}
                    </td>
                  </tr>
                {/each}
                {#if transactions.length === 0}
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
      {/if}

      <!-- 2. ACCOUNTS VIEW -->
      {#if activeTab === 'comptes'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('acc.manageTitle')}</h1>
          <ui5-button icon="add" design="Emphasized" onclick={openAddAccount}>{i18n.currentLang === 'fr' ? 'Nouveau Compte' : 'New Account'}</ui5-button>
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
                  <th style="text-align: right;">{i18n.currentLang === 'fr' ? 'Solde Actuel' : 'Current Balance'}</th>
                  <th class="hide-on-mobile">{i18n.currentLang === 'fr' ? 'Devise' : 'Currency'}</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each accounts as acc}
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
                    <td style="text-align: right; font-weight: bold; color: {acc.SoldeActuel < 0 ? 'var(--sap-error-color)' : 'var(--sap-text-color)'}">
                      {formatCurrency(acc.SoldeActuel)}
                    </td>
                    <td class="hide-on-mobile">{acc.Devise}</td>
                    <td style="text-align: right;">
                      <ui5-button icon="edit" design="Transparent" onclick={() => openEditAccount(acc)}></ui5-button>
                      <ui5-button icon="delete" design="Transparent" onclick={() => deleteAccount(acc.ID)}></ui5-button>
                    </td>
                  </tr>
                {/each}

                {#if accounts.length === 0}
                  <tr>
                    <td colspan="5" style="text-align: center; color: var(--sap-text-muted-color); padding: 40px 0;">
                      Aucun compte configuré. Veuillez cliquer sur "Nouveau Compte" pour commencer.
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- 3. SALARY DISTRIBUTION VIEW -->
      {#if activeTab === 'distribution'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('split.title')}</h1>
        </div>

        <div class="sap-card" style="margin-bottom: 20px;">
          <div class="sap-card-header">
            <span class="sap-card-title">Assistant de Répartition Mensuelle</span>
          </div>
          
          <ui5-busy-indicator active={loading || undefined} style="width: 100%;">
            <div class="sap-card-body" style="padding: 10px;">
              {#if executionStatus}
                <ui5-message-strip 
                  design={executionStatus.design} 
                  onclose={() => executionStatus = null}
                  style="width: 100%; margin-bottom: 16px;">
                  {executionStatus.message}
                </ui5-message-strip>
              {/if}

              <!-- UI5 Wizard component -->
              <ui5-wizard content-layout="SingleStep" style="height: auto;" onstep-change={(e) => {
                const step = e.detail.step;
                const idx = parseInt(step.getAttribute('data-step-index') || '1');
                wizardActiveStep = idx;
              }}>
                
                <!-- STEP 1: Saisie & Configuration -->
                <ui5-wizard-step 
                  data-step-index="1"
                  title-text="Saisie du Salaire" 
                  subtitle-text="Montant net & règles" 
                  selected={wizardActiveStep === 1 || undefined}
                  disabled={undefined}>
                  
                  <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 8px;">
                    <div class="form-group" style="max-width: 400px;">
                      <label for="salary-net">Salaire Net Reçu ce mois-ci (EUR)</label>
                      <ui5-input 
                        id="salary-net" 
                        type="Number" 
                        value={currentSalaryAmount}
                        oninput={(e) => currentSalaryAmount = parseFloat(e.target.value || 0)}>
                      </ui5-input>
                    </div>

                    <div style="background-color: var(--sap-info-background-color); border: 1px solid rgba(10, 110, 209, 0.15); padding: 16px; border-radius: 8px; font-size: 13px; max-width: 650px;">
                      <h4 style="color: var(--sap-primary-color); font-weight: bold; margin-bottom: 8px; font-size: 14px;">Aperçu des règles configurées :</h4>
                      <p style="margin-bottom: 10px; color: var(--sap-text-color);">
                        Votre graphe de transit contient actuellement des règles de répartition pour un montant total fixe de 
                        <strong>{formatCurrency(rulesSummary.totalFixed)}</strong> et 
                        <strong>{rulesSummary.totalPercent}%</strong> des montants restants.
                      </p>
                      
                      <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; border-top: 1px solid var(--sap-border-light-color); padding-top: 12px;">
                        <div style="font-size: 12px;">
                          <span style="color: var(--sap-text-muted-color);">Montant ventilé estimé :</span> 
                          <strong style="color: var(--sap-primary-color);">{formatCurrency(rulesSummary.totalAllocated)}</strong>
                        </div>
                      </div>

                      {#if !rulesSummary.isValid}
                        <div style="color: var(--sap-error-color); margin-top: 12px; font-weight: bold; display: flex; align-items: center; gap: 6px;">
                          <ui5-icon name="error" style="color: var(--sap-error-color);"></ui5-icon>
                          Attention : Le montant cumulé des règles fixes dépasse votre salaire ou les pourcentages cumulés dépassent 100%. Veuillez adapter vos liaisons.
                        </div>
                      {/if}
                    </div>

                    <div class="form-actions" style="justify-content: flex-start; margin-top: 16px;">
                      <ui5-button 
                        design="Emphasized" 
                        disabled={currentSalaryAmount <= 0 || !rulesSummary.isValid || undefined} 
                        onclick={() => wizardActiveStep = 2}>
                        Simuler la Répartition
                      </ui5-button>
                    </div>
                  </div>
                </ui5-wizard-step>

                <!-- STEP 2: Simulation & Graphique -->
                <ui5-wizard-step 
                  data-step-index="2"
                  title-text="Simulation" 
                  subtitle-text="Aperçu des montants répartis" 
                  selected={wizardActiveStep === 2 || undefined}
                  disabled={wizardActiveStep < 2 || undefined}>
                  
                  <div style="display: flex; flex-direction: column; gap: 20px; padding: 16px 8px;">
                    
                    <!-- KPI Simulation Boxes -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; width: 100%;">
                      <div style="border-left: 4px solid #107e3e; background-color: var(--sap-success-background-color); padding: 12px; border-radius: 4px; box-shadow: var(--sap-shadow-card);">
                        <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Épargne Livrets</div>
                        <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: var(--sap-success-color);">{formatCurrency(simulatedDistribution.epargne)}</div>
                        <div style="font-size: 11px; color: var(--sap-text-muted-color); margin-top: 2px;">Taux d'épargne : {simulatedDistribution.savingsRate}%</div>
                      </div>
                      
                      <div style="border-left: 4px solid #e9730c; background-color: var(--sap-warning-background-color); padding: 12px; border-radius: 4px; box-shadow: var(--sap-shadow-card);">
                        <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Actions & Placements</div>
                        <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: var(--sap-warning-color);">{formatCurrency(simulatedDistribution.actions)}</div>
                      </div>

                      <div style="border-left: 4px solid #6f42c1; background-color: #fcf6ff; padding: 12px; border-radius: 4px; box-shadow: var(--sap-shadow-card);">
                        <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Bloqué (PEG/PEE)</div>
                        <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: #6f42c1;">{formatCurrency(simulatedDistribution.verrouille)}</div>
                      </div>

                      <div style="border-left: 4px solid #0a6ed1; background-color: var(--sap-info-background-color); padding: 12px; border-radius: 4px; box-shadow: var(--sap-shadow-card);">
                        <div style="font-size: 11px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase;">Compte Courant (Reste)</div>
                        <div style="font-size: 20px; font-weight: bold; margin-top: 4px; color: var(--sap-primary-color);">{formatCurrency(simulatedDistribution.courant)}</div>
                      </div>
                    </div>

                    <!-- Chart Preview inside Step -->
                    <div style="background-color: #fafbfc; border: 1px solid var(--sap-border-light-color); padding: 16px; border-radius: 8px; margin-top: 10px;">
                      <h4 style="margin-bottom: 12px; font-size: 14px; font-weight: bold; color: var(--sap-text-color);">Graphique de Simulation Globale</h4>
                      {#if currentSalaryAmount > 0}
                        <div class="chart-container" style="justify-content: flex-start; gap: 40px; height: auto;">
                          <svg viewBox="-100 -100 200 200" width="160" height="160" style="transform: rotate(-90deg);">
                            {#each simulatedChartPaths as slice}
                              <path d={slice.d} fill={slice.color} />
                            {/each}
                            <circle cx="0" cy="0" r="54" fill="#ffffff" />
                            <text x="0" y="4" text-anchor="middle" font-size="9" font-weight="700" fill="var(--sap-text-color)" style="transform: rotate(90deg);">
                              {formatCurrency(currentSalaryAmount)}
                            </text>
                          </svg>
                          <div class="chart-legend" style="flex: 1; max-width: 380px;">
                            {#each simulatedChartPaths as slice}
                              <div class="legend-item" style="margin-bottom: 8px;">
                                <div class="legend-color" style="background-color: {slice.color};"></div>
                                <div style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-weight: 500;">{slice.libelle}</div>
                                <div style="font-weight: 700; color: var(--sap-text-color);">{formatCurrency(slice.value)} ({slice.percent}%)</div>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {:else}
                        <div style="text-align: center; color: var(--sap-text-muted-color); padding: 20px 0;">Veuillez d'abord configurer le salaire.</div>
                      {/if}
                    </div>

                    <div class="form-actions" style="justify-content: space-between; margin-top: 16px; width: 100%;">
                      <ui5-button design="Transparent" onclick={() => wizardActiveStep = 1}>Retour</ui5-button>
                      <ui5-button design="Emphasized" onclick={() => wizardActiveStep = 3} disabled={proposedTransactions.length === 0 || undefined}>
                        Suivant : Configurer les Virements
                      </ui5-button>
                    </div>
                  </div>
                </ui5-wizard-step>

                <!-- STEP 3: Validation des Virements -->
                <ui5-wizard-step 
                  data-step-index="3"
                  title-text="Validation" 
                  subtitle-text="Confirmer la création" 
                  selected={wizardActiveStep === 3 || undefined}
                  disabled={wizardActiveStep < 3 || undefined}>
                  
                  <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 8px;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color); padding-bottom: 8px;">
                      <h4 style="font-size: 14px; font-weight: bold; color: var(--sap-text-color); margin: 0;">Sélectionnez les virements à générer :</h4>
                      {#if proposedTransactions.length > 0}
                        <span style="font-size: 12px; font-weight: bold; color: var(--sap-primary-color);">
                          {proposedTransactions.filter(tx => tx.checked).length} / {proposedTransactions.length} sélectionné(s)
                        </span>
                      {/if}
                    </div>

                    {#if proposedTransactions.length > 0}
                      <!-- Select All checkbox -->
                      <div style="padding: 2px 4px; display: flex; align-items: center; justify-content: space-between;">
                        <ui5-checkbox 
                          text="Tout sélectionner" 
                          checked={allSelected ? true : undefined} 
                          onchange={toggleSelectAll}>
                        </ui5-checkbox>
                        <span style="font-size: 11px; color: var(--sap-text-muted-color); font-style: italic;">
                          Décochez un virement pour le mettre "à faire plus tard"
                        </span>
                      </div>
                    {/if}

                    <!-- Proposed transfers checklist -->
                    <div style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                      {#each proposedTransactions as tx, index}
                        <div 
                          style="display: flex; gap: 10px; align-items: flex-start; padding: 10px; border-radius: 6px; border: 1px solid {tx.checked ? 'var(--sap-primary-color)' : 'var(--sap-border-color)'}; background-color: {tx.checked ? 'rgba(10, 110, 209, 0.02)' : '#ffffff'}; transition: all 0.2s;">
                          
                          <ui5-checkbox 
                            style="margin-top: 2px;"
                            checked={tx.checked ? true : undefined}
                            onchange={(e) => tx.checked = e.target.checked}>
                          </ui5-checkbox>
                          
                          <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                              <span style="font-weight: bold; font-size: 13px; color: var(--sap-text-color);">
                                {formatCurrency(tx.Montant)}
                              </span>
                              <div style="display: flex; gap: 4px; align-items: center;">
                                <ui5-button icon="copy" design="Transparent" onclick={(e) => { e.stopPropagation(); copyTransferDetails(tx); }} title="Copier les détails" style="height: 22px; width: 22px; min-width: 22px;"></ui5-button>
                                <ui5-button icon="delete" design="Transparent" onclick={(e) => { e.stopPropagation(); deleteProposedTx(tx, index); }} title="Supprimer définitivement" style="height: 22px; width: 22px; min-width: 22px; color: var(--sap-error-color);"></ui5-button>
                                <span class="badge" style="background-color: var(--sap-info-background-color); color: var(--sap-primary-color); font-size: 10px; padding: 1px 4px;">
                                  {tx.TypeRegle === 'PERCENT' ? `${tx.Valeur}%` : 'Fixe'}
                                </span>
                              </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: bold; color: var(--sap-text-muted-color);">
                              <span style="color: var(--sap-warning-color);">{tx.AccountSourceLibelle || 'Source'}</span>
                              <span>➔</span>
                              <span style="color: var(--sap-success-color);">{tx.AccountTargetLibelle || 'Cible'}</span>
                            </div>

                            <div style="font-size: 10px; color: var(--sap-text-muted-color); font-style: italic;">
                              {tx.Libelle}
                            </div>
                          </div>
                        </div>
                      {/each}

                      {#if proposedTransactions.length === 0}
                        <div style="text-align: center; color: var(--sap-text-muted-color); padding: 40px 0; font-size: 12px;">
                          Aucun virement proposé. Saisissez un salaire supérieur à 0 et vérifiez vos liaisons.
                        </div>
                      {/if}
                    </div>

                    {#if simulatedDistribution.courant < 150}
                      <ui5-message-strip design="Warning" style="width: 100%;">
                        Attention : Le solde estimé restant sur votre compte courant après virements est très faible ({formatCurrency(simulatedDistribution.courant)}). Assurez-vous de couvrir vos charges mensuelles.
                      </ui5-message-strip>
                    {/if}

                    <div class="form-actions" style="justify-content: space-between; margin-top: 16px; width: 100%;">
                      <ui5-button design="Transparent" onclick={() => wizardActiveStep = 2}>Retour</ui5-button>
                      <ui5-button 
                        design="Emphasized" 
                        icon={loading ? "refresh" : "save"} 
                        disabled={proposedTransactions.filter(tx => tx.checked).length === 0 || loading || undefined}
                        onclick={saveConfirmedSplit}>
                        {#if loading}
                          Enregistrement en cours...
                        {:else}
                          Enregistrer et Générer ({proposedTransactions.filter(tx => tx.checked).length} virements)
                        {/if}
                      </ui5-button>
                    </div>
                  </div>
                </ui5-wizard-step>

                <!-- STEP 4: Suivi des Virements Restants -->
                <ui5-wizard-step 
                  data-step-index="4"
                  title-text="Suivi" 
                  subtitle-text="Gérer les virements en attente" 
                  selected={wizardActiveStep === 4 || undefined}
                  disabled={pendingTransactions.length === 0 && wizardActiveStep !== 4 || undefined}>
                  
                  <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color); padding-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                      <div>
                        <h4 style="font-size: 14px; font-weight: bold; color: var(--sap-text-color); margin: 0;">Virements restants à effectuer ({pendingTransactions.length})</h4>
                        <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
                          Ces virements sont enregistrés mais non exécutés. Validez-les au fur et à mesure de vos virements bancaires réels.
                        </span>
                      </div>
                      {#if pendingTransactions.length > 0}
                        <ui5-button onclick={saveSelectedPending} design="Emphasized" icon="save" disabled={pendingTransactions.filter(tx => tx.checked).length === 0 || loading || undefined}>
                          Valider la Sélection ({pendingTransactions.filter(tx => tx.checked).length})
                        </ui5-button>
                      {/if}
                    </div>

                    {#if pendingTransactions.length > 0}
                      <!-- Table of remaining transfers -->
                      <div style="overflow-x: auto; background: #ffffff; border-radius: 6px; border: 1px solid var(--sap-border-color);">
                        <table class="sap-table" style="width: 100%; border-collapse: collapse;">
                          <thead>
                            <tr style="background-color: var(--sap-list-header-background-color); border-bottom: 1px solid var(--sap-border-color);">
                              <th style="width: 50px; text-align: center; padding: 12px 8px;">
                                <ui5-checkbox 
                                  checked={allPendingSelected ? true : undefined} 
                                  onchange={togglePendingSelectAll}>
                                </ui5-checkbox>
                              </th>
                              <th style="padding: 12px 8px; text-align: left;">Libellé / Motif</th>
                              <th style="padding: 12px 8px; text-align: left;">Source ➔ Cible</th>
                              <th class="hide-on-mobile" style="padding: 12px 8px; text-align: left;">Règle / Calcul</th>
                              <th style="padding: 12px 8px; text-align: right; width: 140px;">Montant</th>
                              <th style="padding: 12px 8px; text-align: center; width: 120px;">Actions directes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each pendingTransactions as tx}
                              <tr style="border-bottom: 1px solid var(--sap-border-light-color); transition: background-color 0.2s;">
                                <td style="text-align: center; vertical-align: middle; padding: 10px 8px;">
                                  <ui5-checkbox 
                                    checked={tx.checked ? true : undefined} 
                                    onchange={(e) => tx.checked = e.target.checked}>
                                  </ui5-checkbox>
                                </td>
                                <td style="font-weight: 500; padding: 10px 8px; color: var(--sap-text-color);">
                                  <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <span>{tx.Libelle}</span>
                                    <ui5-button icon="copy" design="Transparent" onclick={(e) => { e.stopPropagation(); copyTransferDetails(tx); }} title="Copier les détails" style="height: 24px; width: 24px; min-width: 24px;"></ui5-button>
                                  </div>
                                </td>
                                <td style="padding: 10px 8px;">
                                  <div style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
                                    <span style="color: var(--sap-warning-color); font-weight: 600;">
                                      {tx.AccountSource ? tx.AccountSource.Libelle : (tx.AccountSourceLibelle || 'Source')}
                                    </span>
                                    <span>➔</span>
                                    <span style="color: var(--sap-success-color); font-weight: 600;">
                                      {tx.AccountTarget ? tx.AccountTarget.Libelle : (tx.AccountTargetLibelle || 'Cible')}
                                    </span>
                                  </div>
                                </td>
                                <td class="hide-on-mobile" style="padding: 10px 8px;">
                                  <span class="badge" style="background-color: var(--sap-info-background-color); color: var(--sap-primary-color); font-size: 11px;">
                                    {tx.TypeRegle === 'PERCENT' ? `${tx.Valeur}%` : 'Fixe'}
                                  </span>
                                </td>
                                <td style="text-align: right; font-weight: bold; color: var(--sap-primary-color); font-size: 14px; padding: 10px 8px;">
                                  {formatCurrency(tx.Montant)}
                                </td>
                                <td style="text-align: center; padding: 10px 8px;">
                                  <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                                    <ui5-button 
                                      icon="sys-enter-2" 
                                      design="Emphasized" 
                                      title="Valider immédiatement" 
                                      style="height: 24px; width: 24px; min-width: 24px; border-radius: 4px;"
                                      onclick={() => validateSinglePending(tx)}>
                                    </ui5-button>
                                    <ui5-button 
                                      icon="edit" 
                                      design="Transparent" 
                                      title="Modifier" 
                                      style="height: 24px; width: 24px; min-width: 24px;"
                                      onclick={() => openEditPending(tx)}>
                                    </ui5-button>
                                    <ui5-button 
                                      icon="delete" 
                                      design="Transparent" 
                                      title="Supprimer définitivement" 
                                      style="height: 24px; width: 24px; min-width: 24px; color: var(--sap-error-color);"
                                      onclick={() => deleteSinglePending(tx)}>
                                    </ui5-button>
                                  </div>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <div style="text-align: center; background-color: var(--sap-success-background-color); border: 1px dashed var(--sap-success-color); padding: 40px 16px; border-radius: 8px;">
                        <ui5-icon name="sys-enter-2" style="font-size: 32px; color: var(--sap-success-color); margin-bottom: 8px;"></ui5-icon>
                        <h4 style="color: var(--sap-success-color); font-weight: bold; font-size: 14px; margin-bottom: 4px;">Félicitations, répartition complète !</h4>
                        <p style="color: var(--sap-text-color); font-size: 12px; margin: 0;">Aucun virement restant à effectuer pour le moment.</p>
                      </div>
                    {/if}

                    <div class="form-actions" style="justify-content: flex-start; margin-top: 16px;">
                      <ui5-button design="Transparent" onclick={() => wizardActiveStep = 3}>Retour aux Choix</ui5-button>
                    </div>
                  </div>
                </ui5-wizard-step>

              </ui5-wizard>
            </div>
          </ui5-busy-indicator>
        </div>


      {/if}

      <!-- 4. GRAPHE DE TRANSIT VIEW -->
      {#if activeTab === 'graphe'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('graph.visualTitle')}</h1>
        </div>

        <div class="sap-card" style="height: calc(100vh - 180px); min-height: 600px; display: flex; flex-direction: column;">
          <div class="sap-card-header" style="position: relative;">
            <div>
              <span class="sap-card-title">Visualisation interactive (style n8n)</span>
              <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
                Glissez les boîtes pour réorganiser. Utilisez les boutons de gestion pour modifier la structure.
              </span>
            </div>
            
            <!-- Actions in top-right corner of card header -->
            <div style="display: flex; gap: 8px;">
              <ui5-button icon="add" design="Emphasized" onclick={openAddNode}>Nouveau Nœud</ui5-button>
              <ui5-button icon="org-chart" design="Emphasized" onclick={openAddConnection}>Nouvelle Liaison</ui5-button>
              <ui5-button icon="list" onclick={openManageNodes}>{i18n.t('graph.btnNodes')}</ui5-button>
              <ui5-button icon="settings" onclick={openManageConnections}>{i18n.currentLang === 'fr' ? 'Gérer les Liaisons' : 'Manage Connections'}</ui5-button>
            </div>
          </div>
          <div class="sap-card-body" style="padding: 0; flex: 1; position: relative; overflow: auto; background-color: #fafbfc;">
            <div class="flow-graph-container" id="flow-graph-container" style="width: 100%; height: 100%; min-width: 960px; min-height: 540px; position: relative; margin-top: 0; border: none; border-radius: 0;" onmousemove={handleMouseMove} onmouseup={handleMouseUp}>
              <svg style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sap-primary-color)" />
                  </marker>
                </defs>
                {#each flowConnections as conn}
                  {@const sourceNode = flowNodes.find(n => n.ID === conn.SourceNode_ID)}
                  {@const targetNode = flowNodes.find(n => n.ID === conn.TargetNode_ID)}
                  {#if sourceNode && targetNode}
                    {@const x1 = sourceNode.PosX + 170}
                    {@const y1 = sourceNode.PosY + 40}
                    {@const x2 = targetNode.PosX}
                    {@const y2 = targetNode.PosY + 40}
                    {@const dx = Math.abs(x2 - x1) / 2}
                    <path 
                      d="M {x1} {y1} C {x1 + dx} {y1}, {x2 - dx} {y2}, {x2} {y2}" 
                      stroke="var(--sap-primary-color)" 
                      stroke-width="2" 
                      fill="none" 
                      marker-end="url(#arrow)" />
                  {/if}
                {/each}
              </svg>

              {#each flowNodes as node}
                <div 
                  class="flow-node" 
                  style="left: {node.PosX}px; top: {node.PosY}px;"
                  onmousedown={(e) => handleMouseDown(e, node)}>
                  
                  <button 
                    class="flow-node-delete-btn" 
                    onclick={(e) => { e.stopPropagation(); deleteNode(node.ID); }}
                    title="Supprimer le nœud">
                    ×
                  </button>

                  <div class="flow-node-title">{node.Label}</div>
                  <div class="flow-node-badge">{node.Type}</div>
                  {#if node.Account}
                    <div class="flow-node-solde">{formatCurrency(node.Account.SoldeActuel)}</div>
                  {/if}
                  {#if nodeAllocatedAmounts[node.ID]}
                    <div style="color: var(--sap-success-color); font-weight: bold; font-size: 12px; margin-top: 4px;">
                      + {formatCurrency(nodeAllocatedAmounts[node.ID])}
                    </div>
                  {:else}
                    {@const previewAmount = graphPreviewAllocations[node.ID]}
                    {#if previewAmount > 0}
                      <div style="color: var(--sap-information-color); font-weight: bold; font-size: 11px; margin-top: 4px; opacity: 0.8;" title="Flux simulé en temps réel (saisie actuelle)">
                        + {formatCurrency(previewAmount)}
                      </div>
                    {/if}
                  {/if}

                </div>
              {/each}

              {#each flowConnections as conn}
                {@const sourceNode = flowNodes.find(n => n.ID === conn.SourceNode_ID)}
                {@const targetNode = flowNodes.find(n => n.ID === conn.TargetNode_ID)}
                {#if sourceNode && targetNode}
                  {@const x1 = sourceNode.PosX + 170}
                  {@const y1 = sourceNode.PosY + 40}
                  {@const x2 = targetNode.PosX}
                  {@const y2 = targetNode.PosY + 40}
                  {@const labelX = (x1 + x2) / 2}
                  {@const labelY = (y1 + y2) / 2}
                  <div class="flow-edge-label" style="left: {labelX}px; top: {labelY}px;">
                    <span>{conn.TypeRegle === 'PERCENT' ? `${conn.Valeur}%` : `${conn.Valeur} €`}</span>
                    <button 
                      class="flow-edge-delete-btn" 
                      onclick={(e) => { e.stopPropagation(); deleteConnection(conn.ID); }}
                      title="Supprimer la liaison">
                      ×
                    </button>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- 4b. CALENDAR VIEW -->
      {#if activeTab === 'calendar'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('cal.previsionalTitle')}</h1>
          <ui5-button icon="refresh" design="Transparent" onclick={loadData} title="Actualiser les données"></ui5-button>
        </div>

        <div class="calendar-layout" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Month and Account selectors -->
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid var(--sap-border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div class="form-group" style="margin: 0; min-width: 250px;">
                <label for="cal-acc-select" style="font-size: 11px; font-weight: bold; margin-bottom: 6px; display: block; color: var(--sap-text-muted-color);">COMPTE COURANT À SIMULER</label>
                <ui5-select id="cal-acc-select" value={selectedCalendarAccount} onchange={(e) => selectedCalendarAccount = e.target.value} style="width: 100%;">
                  {#each accounts.filter(a => a.TypePlacement === 'Courant') as acc}
                    <ui5-option selected={selectedCalendarAccount === acc.ID ? true : undefined} value={acc.ID}>
                      {acc.Libelle} ({formatCurrency(acc.SoldeActuel)})
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
            </div>

            <!-- Financial Alerts / Quick KPIs -->
            <div style="display: flex; gap: 16px;">
              <div style="background-color: var(--sap-background-color); border: 1px solid var(--sap-border-color); padding: 10px 20px; border-radius: 6px; text-align: center; min-width: 130px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 10px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Solde Minimum</div>
                <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: {minSimulatedBalance < 0 ? 'var(--sap-error-color)' : minSimulatedBalance < 150 ? 'var(--sap-warning-color)' : 'var(--sap-success-color)'};">
                  {formatCurrency(minSimulatedBalance)}
                </div>
              </div>
              <div style="background-color: var(--sap-background-color); border: 1px solid var(--sap-border-color); padding: 10px 20px; border-radius: 6px; text-align: center; min-width: 130px; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 10px; color: var(--sap-text-muted-color); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Sécurité Trésorerie</div>
                <div>
                  {#if minSimulatedBalance < 0}
                    <span class="badge badge-error" style="font-size: 11px; padding: 4px 8px;">DÉCOUVERT RISQUÉ</span>
                  {:else if minSimulatedBalance < 150}
                    <span class="badge badge-warning" style="font-size: 11px; padding: 4px 8px;">FLUX TENDU</span>
                  {:else}
                    <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px;">SÉCURISÉ</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Calendar grid layout -->
          <div class="sap-card">
            <div class="sap-card-header">
              <span class="sap-card-title">Calendrier de Prévision de Solde</span>
              <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
                Visualisation journalière du solde estimé après déduction des charges récurrentes et réception du salaire net.
              </span>
            </div>
            <div class="sap-card-body" style="padding: 20px;">
              <!-- Grid header with days of week -->
              <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; text-align: center; font-weight: bold; font-size: 11px; color: var(--sap-text-muted-color); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                <div>Lun</div>
                <div>Mar</div>
                <div>Mer</div>
                <div>Jeu</div>
                <div>Ven</div>
                <div>Sam</div>
                <div>Dim</div>
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
                      style="background-color: {isToday ? '#f3f7fb' : '#ffffff'}; border: 1px solid {isToday ? 'var(--sap-primary-color)' : dayData?.balance < 0 ? 'rgba(187, 0, 0, 0.4)' : dayData?.balance < 150 ? 'rgba(233, 115, 12, 0.3)' : 'var(--sap-border-color)'}; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s; box-shadow: {isToday ? '0 2px 8px rgba(10,110,209,0.15)' : 'none'};"
                      class="cal-day-cell">
                      
                      <!-- Day Header -->
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: bold; font-size: 14px; color: {isToday ? 'var(--sap-primary-color)' : 'var(--sap-text-color)'};">
                          {cell}
                          {#if isToday}
                            <span style="font-size: 9px; background-color: var(--sap-primary-color); color: white; padding: 1px 4px; border-radius: 3px; margin-left: 4px; font-weight: normal; vertical-align: middle;">Auj.</span>
                          {/if}
                        </span>

                        <!-- Indicators for operations on this day -->
                        <div style="display: flex; gap: 4px;">
                          {#if dayData?.salaryReceived > 0}
                            <div style="width: 8px; height: 8px; background-color: var(--sap-success-color); border-radius: 50%;" title="Salaire : +{formatCurrency(dayData.salaryReceived)}"></div>
                          {/if}
                          {#if dayData?.debitsSum > 0}
                            <div style="width: 8px; height: 8px; background-color: var(--sap-error-color); border-radius: 50%;" title="{dayData.debits.length} prélèvement(s) : -{formatCurrency(dayData.debitsSum)}"></div>
                          {/if}
                        </div>
                      </div>

                      <!-- Day details (Operations list) -->
                      <div class="hide-on-mobile" style="flex: 1; margin: 4px 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: 50px;">
                        {#if dayData?.salaryReceived > 0}
                          <div style="font-size: 9px; color: var(--sap-success-color); font-weight: bold; background-color: rgba(16, 126, 62, 0.08); padding: 2px; border-radius: 3px;">
                            💰 Salaire (+{Math.round(dayData.salaryReceived)} €)
                          </div>
                        {/if}
                        {#if dayData?.debits && dayData.debits.length > 0}
                          {#each dayData.debits as deb}
                            <div style="font-size: 9px; color: var(--sap-error-color); font-weight: 500; background-color: rgba(187, 0, 0, 0.05); padding: 2px; border-radius: 3px; display: flex; justify-content: space-between;" title="{deb.Libelle} : -{formatCurrency(deb.Montant)}">
                              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;">{deb.Libelle}</span>
                              <span>-{Math.round(deb.Montant)} €</span>
                            </div>
                          {/each}
                        {/if}
                      </div>

                      <!-- Projected day balance -->
                      {#if dayData}
                        <div style="text-align: right; font-weight: bold; font-size: 12px; color: {dayData.balance < 0 ? 'var(--sap-error-color)' : dayData.balance < 150 ? 'var(--sap-warning-color)' : 'var(--sap-text-color)'}; border-top: 1px solid var(--sap-border-light-color); padding-top: 4px; margin-top: auto;">
                          {formatCurrency(dayData.balance)}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- 4. RECURRING DEBITS VIEW -->
      {#if activeTab === 'abonnements'}
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
                {#each recurringDebits.filter(deb => deb.Type === 'Manuel') as deb}
                  {@const paid = isPaidThisMonth(deb.DernierPaiementDate)}
                  <tr>
                    <td style="font-weight: 600;">{deb.Libelle}</td>
                    <td class="hide-on-mobile">Le {deb.JourDuMois} du mois</td>
                    <td class="hide-on-mobile">{deb.Account ? deb.Account.Libelle : 'Inconnu'}</td>
                    <td style="font-weight: bold; color: var(--sap-error-color);">{formatCurrency(deb.Montant)}</td>
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
                {#if recurringDebits.filter(deb => deb.Type === 'Manuel').length === 0}
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
                {#each recurringDebits.filter(deb => deb.Type !== 'Manuel') as deb}
                  <tr>
                    <td style="font-weight: 600;">{deb.Libelle}</td>
                    <td class="hide-on-mobile">Le {deb.JourDuMois} du mois</td>
                    <td class="hide-on-mobile">{deb.Account ? deb.Account.Libelle : 'Inconnu'}</td>
                    <td style="font-weight: bold; color: var(--sap-error-color);">{formatCurrency(deb.Montant)}</td>
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
                {#if recurringDebits.filter(deb => deb.Type !== 'Manuel').length === 0}
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
      {/if}


      <!-- 5. EXECUTION LOGS VIEW -->
      {#if activeTab === 'logs'}
        <div class="page-title-container">
          <h1 class="page-title">{i18n.t('logs.title')}</h1>
          <ui5-button icon="refresh" design="Transparent" onclick={loadData}></ui5-button>
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
                    <span>Répartition du {formatDate(chart.timestamp)}</span>
                    <span>Total : {formatCurrency(chart.salary)}</span>
                  </div>
                  <div style="width: 100%; height: 24px; background-color: var(--sap-border-light-color); border-radius: 4px; display: flex; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    {#each chart.categories as cat}
                      {#if cat.value > 0}
                        <div 
                          style="width: {cat.percent}%; height: 100%; background-color: {cat.color}; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; transition: width 0.3s;"
                          title="{cat.name} : {formatCurrency(cat.value)} ({cat.percent}%)">
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
                {#each executionLogs as log}
                  <tr>
                    <td class="hide-on-mobile">{formatDate(log.Timestamp)}</td>
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
                {#if executionLogs.length === 0}
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
      {/if}


      
    </main>
  </div>
</div>

<!-- ========================================================================= -->
<!-- DIALOGS & OVERLAYS (UI5 Web Components Native Dialogs) -->
<!-- ========================================================================= -->

<!-- 1. ACCOUNTS DIALOG -->
<ui5-dialog open={isAccountDialogOpen || undefined} bind:this={accountDialogRef} header-text={isEditingAccount ? "Modifier le Compte" : "Ajouter un Compte"}>

  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="acc-libelle">Libellé du compte</label>
      <ui5-input 
        id="acc-libelle" 
        value={accountForm.Libelle}
        oninput={(e) => accountForm.Libelle = e.target.value}>
      </ui5-input>
    </div>
    
    <div class="form-group">
      <label for="acc-type">Type de Compte</label>
      <ui5-select id="acc-type" value={accountForm.Type} onchange={(e) => accountForm.Type = e.target.value}>
        <ui5-option selected={accountForm.Type === 'Courant' ? true : undefined} value="Courant">Compte Courant</ui5-option>
        <ui5-option selected={accountForm.Type === 'Livret A' ? true : undefined} value="Livret A">Livret A</ui5-option>
        <ui5-option selected={accountForm.Type === 'Livret' ? true : undefined} value="Livret">Livret d'Épargne (LDDS...)</ui5-option>
        <ui5-option selected={accountForm.Type === 'PEG Castor Vinci' ? true : undefined} value="PEG Castor Vinci">PEG Castor Vinci</ui5-option>
        <ui5-option selected={accountForm.Type === 'Amundi' ? true : undefined} value="Amundi">Amundi Placement</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="acc-placement">Catégorie de Placement</label>
      <ui5-select id="acc-placement" value={accountForm.TypePlacement} onchange={(e) => accountForm.TypePlacement = e.target.value}>
        <ui5-option selected={accountForm.TypePlacement === 'Courant' ? true : undefined} value="Courant">Compte Courant</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Epargne' ? true : undefined} value="Epargne">Livret d'Épargne / Taux fixe</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Actions' ? true : undefined} value="Actions">Portefeuille Actions / Variable</ui5-option>
        <ui5-option selected={accountForm.TypePlacement === 'Verrouille' ? true : undefined} value="Verrouille">Placement Bloqué (PEG / PEE)</ui5-option>
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
        oninput={(e) => accountForm.IBAN = e.target.value}>
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
    <ui5-button onclick={saveAccount} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>




<!-- 2. ALLOCATION RULES DIALOG -->
<ui5-dialog open={isRuleDialogOpen || undefined} bind:this={ruleDialogRef} header-text={isEditingRule ? "Modifier la Règle" : "{i18n.currentLang === 'fr' ? 'Ajouter une Règle' : 'Add a Rule'}"}>

  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="rule-account">Compte Cible</label>
      <ui5-select id="rule-account" value={ruleForm.Account_ID} onchange={(e) => ruleForm.Account_ID = e.target.value}>
        {#each accounts as acc}
          <ui5-option selected={ruleForm.Account_ID === acc.ID ? true : undefined} value={acc.ID}>
            {acc.Libelle} ({acc.Type})
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="rule-type">Type de Répartition</label>
      <ui5-select id="rule-type" value={ruleForm.PourcentageOuMontantFixe} onchange={(e) => ruleForm.PourcentageOuMontantFixe = e.target.value}>
        <ui5-option selected={ruleForm.PourcentageOuMontantFixe === 'PERCENT' ? true : undefined} value="PERCENT">Pourcentage (%)</ui5-option>
        <ui5-option selected={ruleForm.PourcentageOuMontantFixe === 'FIXED' ? true : undefined} value="FIXED">Montant Fixe (€)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="rule-value">Valeur ({ruleForm.PourcentageOuMontantFixe === 'PERCENT' ? '%' : '€'})</label>
      <ui5-input 
        id="rule-value" 
        type="Number" 
        value={ruleForm.Valeur}
        oninput={(e) => ruleForm.Valeur = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      isRuleDialogOpen = false;
      if (ruleDialogRef && typeof ruleDialogRef.close === 'function') ruleDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveRule} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>




<!-- 3. RECURRING DEBIT DIALOG -->
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
        {#each accounts as acc}
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




<!-- 4. LOGS DETAIL DIALOG -->
<ui5-dialog bind:this={detailLogDialog} header-text="Détails du Log d'Exécution">
  {#if selectedLogDetails}
    <div style="padding: 16px; width: 420px; display: flex; flex-direction: column; gap: 12px;">
      <div><strong>Statut :</strong> 
        <span class="badge {selectedLogDetails.Statut === 'SUCCESS' ? 'badge-success' : 'badge-error'}">
          {selectedLogDetails.Statut}
        </span>
      </div>
      <div><strong>Date :</strong> {formatDate(selectedLogDetails.Timestamp)}</div>
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
    <ui5-button onclick={() => detailLogDialog.open = false} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>

<!-- 5. ADD NODE DIALOG -->
<ui5-dialog bind:this={nodeDialogRef} header-text="Ajouter un Nœud de Flux">
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="node-label">Nom du nœud</label>
      <ui5-input 
        id="node-label" 
        value={nodeForm.Label}
        oninput={(e) => nodeForm.Label = e.target.value}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="node-type">Type de Nœud</label>
      <ui5-select id="node-type" value={nodeForm.Type} onchange={(e) => nodeForm.Type = e.target.value}>
        <ui5-option selected={nodeForm.Type === 'Transit' ? true : undefined} value="Transit">Compte / Transit</ui5-option>
        <ui5-option selected={nodeForm.Type === 'Source' ? true : undefined} value="Source">Source (Entrée)</ui5-option>
        <ui5-option selected={nodeForm.Type === 'Target' ? true : undefined} value="Target">Cible (Épargne/Bloqué)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="node-account">Compte physique associé (optionnel)</label>
      <ui5-select id="node-account" value={nodeForm.Account_ID} onchange={(e) => nodeForm.Account_ID = e.target.value}>
        <ui5-option selected={!nodeForm.Account_ID ? true : undefined} value="">-- Aucun --</ui5-option>
        {#each accounts as acc}
          <ui5-option selected={nodeForm.Account_ID === acc.ID ? true : undefined} value={acc.ID}>
            {acc.Libelle}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      nodeDialogRef.open = false;
      if (typeof nodeDialogRef.close === 'function') nodeDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveNode} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>

<!-- 6. ADD CONNECTION DIALOG -->
<ui5-dialog bind:this={connectionDialogRef} header-text="Ajouter une Liaison de Flux">
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="conn-source">Nœud Source</label>
      <ui5-select id="conn-source" value={connectionForm.SourceNode_ID} onchange={(e) => connectionForm.SourceNode_ID = e.target.value}>
        <ui5-option selected={!connectionForm.SourceNode_ID ? true : undefined} value="">-- Sélectionner --</ui5-option>
        {#each flowNodes as n}
          <ui5-option selected={connectionForm.SourceNode_ID === n.ID ? true : undefined} value={n.ID}>
            {n.Label}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-target">Nœud Cible</label>
      <ui5-select id="conn-target" value={connectionForm.TargetNode_ID} onchange={(e) => connectionForm.TargetNode_ID = e.target.value}>
        <ui5-option selected={!connectionForm.TargetNode_ID ? true : undefined} value="">-- Sélectionner --</ui5-option>
        {#each flowNodes as n}
          <ui5-option selected={connectionForm.TargetNode_ID === n.ID ? true : undefined} value={n.ID}>
            {n.Label}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-type">{i18n.currentLang === 'fr' ? 'Type de règle' : 'Rule Type'}</label>
      <ui5-select id="conn-type" value={connectionForm.TypeRegle} onchange={(e) => connectionForm.TypeRegle = e.target.value}>
        <ui5-option selected={connectionForm.TypeRegle === 'PERCENT' ? true : undefined} value="PERCENT">Pourcentage (%)</ui5-option>
        <ui5-option selected={connectionForm.TypeRegle === 'FIXED' ? true : undefined} value="FIXED">Montant Fixe (€)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-value">Valeur ({connectionForm.TypeRegle === 'PERCENT' ? '%' : '€'})</label>
      <ui5-input 
        id="conn-value" 
        type="Number" 
        value={connectionForm.Valeur}
        oninput={(e) => connectionForm.Valeur = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      connectionDialogRef.open = false;
      if (typeof connectionDialogRef.close === 'function') connectionDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveConnection} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>

<!-- 7. MANAGE NODES DIALOG -->
<ui5-dialog bind:this={nodesListDialogRef} header-text="{i18n.currentLang === 'fr' ? 'Gérer les Nœuds' : 'Manage Nodes'} du Graphe">
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; width: 420px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 13px; color: var(--sap-text-muted-color);">Nœuds configurés :</span>
      <ui5-button icon="add" onclick={openAddNode} design="Emphasized">Ajouter un Nœud</ui5-button>
    </div>
    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--sap-border-light-color); border-radius: 4px;">
      <table class="sap-table" style="font-size: 12px; width: 100%;">
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Type</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each flowNodes as node}
            <tr>
              <td style="font-weight: bold;">{node.Label}</td>
              <td>
                <span class="badge" style="background-color: var(--sap-background-color);">
                  {node.Type === 'Source' ? 'Source' : node.Type === 'Target' ? 'Cible' : 'Transit'}
                </span>
              </td>
              <td style="text-align: right;">
                <ui5-button icon="delete" design="Transparent" onclick={() => deleteNode(node.ID)}></ui5-button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      nodesListDialogRef.open = false;
      if (typeof nodesListDialogRef.close === 'function') nodesListDialogRef.close();
    }} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>

<!-- 8. MANAGE CONNECTIONS DIALOG -->
<ui5-dialog bind:this={connectionsListDialogRef} header-text="Gérer les Liaisons de Flux">
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; width: 420px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 13px; color: var(--sap-text-muted-color);">Liaisons actives :</span>
      <ui5-button icon="add" onclick={openAddConnection} design="Emphasized">Créer une Liaison</ui5-button>
    </div>
    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--sap-border-light-color); border-radius: 4px;">
      <table class="sap-table" style="font-size: 12px; width: 100%;">
        <thead>
          <tr>
            <th>Source ➔ Cible</th>
            <th>Valeur</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each flowConnections as conn}
            {@const src = flowNodes.find(n => n.ID === conn.SourceNode_ID)}
            {@const tgt = flowNodes.find(n => n.ID === conn.TargetNode_ID)}
            <tr>
              <td>
                <div style="font-weight: 600;">{src ? src.Label : 'Inconnu'}</div>
                <div style="font-size: 10px; color: var(--sap-text-muted-color);">➔ {tgt ? tgt.Label : 'Inconnu'}</div>
              </td>
              <td style="font-weight: bold; color: var(--sap-primary-color);">
                {conn.TypeRegle === 'PERCENT' ? `${conn.Valeur}%` : `${conn.Valeur} €`}
              </td>
              <td style="text-align: right;">
                <ui5-button icon="delete" design="Transparent" onclick={() => deleteConnection(conn.ID)}></ui5-button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      connectionsListDialogRef.open = false;
      if (typeof connectionsListDialogRef.close === 'function') connectionsListDialogRef.close();
    }} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>





<!-- 10. MANUAL PAYMENT VALIDATION DIALOG -->
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
      <ui5-button onclick={confirmManualPayment} design="Emphasized" disabled={manualPaymentAmount <= 0 || loading || undefined}>
        Valider et Enregistrer
      </ui5-button>
    </div>
  {/if}
</ui5-dialog>

<ui5-dialog open={isPendingFormDialogOpen || undefined} bind:this={editPendingDialogRef} header-text="Modifier le Virement en Attente">
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="edit-pending-libelle">Libellé</label>
      <ui5-input 
        id="edit-pending-libelle" 
        value={pendingForm.Libelle}
        oninput={(e) => pendingForm.Libelle = e.target.value}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="edit-pending-montant">Montant (€)</label>
      <ui5-input 
        id="edit-pending-montant" 
        type="Number" 
        value={pendingForm.Montant}
        oninput={(e) => pendingForm.Montant = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="edit-pending-source">Compte Source</label>
      <ui5-select id="edit-pending-source" style="width: 100%;" onchange={(e) => pendingForm.AccountSource_ID = e.target.value}>
        <ui5-option value="">-- Sélectionner --</ui5-option>
        {#each accounts as acc}
          <ui5-option value={acc.ID} selected={pendingForm.AccountSource_ID === acc.ID ? true : undefined}>{acc.Libelle}</ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="edit-pending-target">Compte Cible</label>
      <ui5-select id="edit-pending-target" style="width: 100%;" onchange={(e) => pendingForm.AccountTarget_ID = e.target.value}>
        <ui5-option value="">-- Sélectionner --</ui5-option>
        {#each accounts as acc}
          <ui5-option value={acc.ID} selected={pendingForm.AccountTarget_ID === acc.ID ? true : undefined}>{acc.Libelle}</ui5-option>
        {/each}
      </ui5-select>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      isPendingFormDialogOpen = false;
      if (editPendingDialogRef && typeof editPendingDialogRef.close === 'function') editPendingDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveEditedPending} design="Emphasized" disabled={!pendingForm.Libelle || pendingForm.Montant <= 0 || loading || undefined}>
      Enregistrer
    </ui5-button>
  </div>
</ui5-dialog>

<!-- TOAST ALERT -->
<ui5-toast bind:this={toastRef} duration="3000">
  {toastMessage}
</ui5-toast>


