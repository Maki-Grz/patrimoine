<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Local Form Dialog States
  let editPendingDialogRef = $state(null);
  let isPendingFormDialogOpen = $state(false);
  let pendingForm = $state({ ID: '', Libelle: '', Montant: 0, AccountSource_ID: '', AccountTarget_ID: '' });

  // Auto-calculation split background effect with debounce
  let salaryDebounceTimeout;
  $effect(() => {
    const amount = appState.currentSalaryAmount;
    if (amount > 0 && appState.activeTab === 'distribution') {
      clearTimeout(salaryDebounceTimeout);
      salaryDebounceTimeout = setTimeout(async () => {
        appState.loading = true;
        try {
          const res = await fetch('/odata/v4/patrimoine/calculateSalarySplit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salaryAmount: amount })
          });
          if (res.ok) {
            const result = await res.json();
            const txs = JSON.parse(result.value || '[]');
            appState.proposedTransactions = txs.map(tx => ({ ...tx, checked: true }));
          }
        } catch (e) {
          console.error("Erreur calculateSalarySplit:", e);
        } finally {
          appState.loading = false;
        }
      }, 250);
    } else {
      appState.proposedTransactions = [];
    }
  });

  // Derived state for Select All checkbox
  let allSelected = $derived(appState.proposedTransactions.length > 0 && appState.proposedTransactions.every(tx => tx.checked));
  
  function toggleSelectAll(event) {
    const isChecked = event.target.checked;
    appState.proposedTransactions.forEach(tx => tx.checked = isChecked);
  }

  // Derived state for Select All checkbox (remaining transactions table)
  let allPendingSelected = $derived(appState.pendingTransactions.length > 0 && appState.pendingTransactions.every(tx => tx.checked));
  
  function togglePendingSelectAll(event) {
    const isChecked = event.target.checked;
    appState.pendingTransactions.forEach(tx => tx.checked = isChecked);
  }

  let simulatedDistribution = $derived.by(() => {
    let categories = { Epargne: 0, Actions: 0, Verrouille: 0, Courant: 0 };
    
    const totalAllocated = appState.proposedTransactions
      .filter(tx => tx.checked)
      .reduce((sum, tx) => {
        if (tx.Type === 'Entree') return sum;
        const targetAcc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
        const type = targetAcc ? targetAcc.TypePlacement : 'Courant';
        const amount = parseFloat(tx.Montant || 0);
        if (categories[type] !== undefined) {
          categories[type] += amount;
        } else {
          categories.Courant += amount;
        }
        return sum + amount;
      }, 0);

    const leftover = Math.max(0, appState.currentSalaryAmount - totalAllocated);
    categories.Courant += leftover;

    return {
      epargne: categories.Epargne,
      actions: categories.Actions,
      verrouille: categories.Verrouille,
      courant: categories.Courant,
      totalAllocated,
      leftover,
      savingsRate: appState.currentSalaryAmount > 0 ? Math.round((categories.Epargne / appState.currentSalaryAmount) * 100) : 0
    };
  });

  let simulatedChartPaths = $derived.by(() => {
    const total = appState.currentSalaryAmount || 1;
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

  // Dynamic Rule Validation based on Graph connections
  let rulesSummary = $derived.by(() => {
    let totalFixed = 0;
    let totalPercent = 0;
    appState.flowConnections.forEach(c => {
      const srcNode = appState.flowNodes.find(n => n.ID === c.SourceNode_ID);
      if (srcNode && srcNode.Type === 'Source') {
        if (c.TypeRegle === 'FIXED') totalFixed += parseFloat(c.Valeur || 0);
        else totalPercent += parseFloat(c.Valeur || 0);
      }
    });

    const remainingForPercent = Math.max(0, appState.currentSalaryAmount - totalFixed);
    const allocatedPercent = remainingForPercent * (totalPercent / 100);
    const totalAllocated = totalFixed + allocatedPercent;
    
    return {
      totalFixed,
      totalPercent,
      totalAllocated,
      isValid: totalFixed <= appState.currentSalaryAmount && totalPercent <= 100
    };
  });

  /**
   * Copies transfer details to the clipboard.
   */
  function copyTransferDetails(tx) {
    const targetAcc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
    const sourceAcc = appState.accounts.find(a => a.ID === tx.AccountSource_ID);
    const targetIBAN = targetAcc && targetAcc.IBAN ? targetAcc.IBAN : '';
    
    let textToCopy = `=== ${i18n.currentLang === 'fr' ? 'Détails' : 'Details'} du virement ===\n`;
    textToCopy += `De : ${tx.AccountSourceLibelle || (sourceAcc ? sourceAcc.Libelle : (i18n.currentLang === 'fr' ? 'Compte Source' : 'Source Account'))}\n`;
    textToCopy += `Vers : ${tx.AccountTargetLibelle || (targetAcc ? targetAcc.Libelle : (i18n.currentLang === 'fr' ? 'Compte Cible' : 'Target Account'))}\n`;
    if (targetIBAN) {
      textToCopy += `IBAN Cible : ${targetIBAN}\n`;
    }
    textToCopy += `Montant : ${appState.formatCurrency(tx.Montant)}\n`;
    textToCopy += `Motif : ${tx.Libelle}`;
    
    navigator.clipboard.writeText(textToCopy);
    appState.showToast("Détails du virement copiés !");
  }

  let validateImmediately = $state(true); // Default: Option A (Immediate validation)

  /**
   * Submits the confirmed proposed split transactions to the backend.
   */
  async function saveConfirmedSplit() {
    const checkedTxs = appState.proposedTransactions.filter(tx => tx.checked);
    if (checkedTxs.length === 0) {
      appState.showToast("Veuillez cocher au moins une transaction.");
      return;
    }

    appState.loading = true;
    appState.executionStatus = null;
    const startTime = Date.now();
    try {
      // 1. Save salary net config first
      if (appState.salaryConfig) {
        await fetch(`/odata/v4/patrimoine/SalaryConfig(${appState.salaryConfig.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MontantNet: appState.currentSalaryAmount })
        });
      } else {
        await fetch('/odata/v4/patrimoine/SalaryConfig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ID: appState.generateUUID(),
            MontantBrut: appState.currentSalaryAmount * 1.3,
            MontantNet: appState.currentSalaryAmount,
            JourDePaie: 28
          })
        });
      }

      if (validateImmediately) {
        // Option A: Save immediately to real Transactions
        const res = await fetch('/odata/v4/patrimoine/saveConfirmedSalarySplit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionsJson: JSON.stringify(checkedTxs),
            salaryAmount: appState.currentSalaryAmount
          })
        });

        if (res.ok) {
          const resultLog = await res.json();
          if (resultLog.Statut === 'SUCCESS') {
            appState.showToast("Virements enregistrés et soldes actualisés !");
            appState.executionStatus = { design: 'Positive', message: resultLog.Message };
            appState.proposedTransactions = [];
            
            // Set node allocated amounts for graphs
            const details = JSON.parse(resultLog.DetailsJSON || '{}');
            if (details.transactions) {
              appState.nodeAllocatedAmounts = {};
              details.transactions.forEach(tx => {
                if (tx.AccountTarget_ID) {
                  appState.nodeAllocatedAmounts[tx.AccountTarget_ID] = (appState.nodeAllocatedAmounts[tx.AccountTarget_ID] || 0) + tx.Montant;
                }
                if (tx.AccountSource_ID) {
                  const srcNode = appState.flowNodes.find(n => n.Account_ID === tx.AccountSource_ID);
                  if (srcNode && srcNode.Type === 'Source') {
                    appState.nodeAllocatedAmounts[srcNode.ID] = appState.currentSalaryAmount;
                  }
                }
              });
            }
            await appState.loadData();
          } else {
            appState.showToast(`Échec : ${resultLog.Message}`);
            appState.executionStatus = { design: 'Negative', message: resultLog.Message };
          }
        } else {
          const errorDetail = await res.json();
          appState.showToast(`Erreur service : ${errorDetail.error?.message || 'Inconnue'}`);
          appState.executionStatus = { design: 'Negative', message: `Erreur service : ${errorDetail.error?.message || 'Inconnue'}` };
        }
      } else {
        // Option B: Save as pending (update modified amounts, delete unchecked ones)
        for (const tx of checkedTxs) {
          await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Montant: tx.Montant })
          });
        }
        const uncheckedTxs = appState.proposedTransactions.filter(t => !t.checked);
        for (const tx of uncheckedTxs) {
          await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
            method: 'DELETE'
          });
        }
        appState.showToast("Virements enregistrés dans votre file d'attente.");
        appState.proposedTransactions = [];
        await appState.loadData();
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur technique lors de l'enregistrement.");
      appState.executionStatus = { design: 'Negative', message: "Erreur technique lors de l'enregistrement." };
    } finally {
      const duration = Date.now() - startTime;
      const minDuration = 500;
      if (duration < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - duration));
      }
      appState.loading = false;
    }
  }

  /**
   * Saves all checked pending transactions.
   */
  async function saveSelectedPending() {
    const checkedPending = appState.pendingTransactions.filter(tx => tx.checked);
    if (checkedPending.length === 0) {
      appState.showToast("Veuillez cocher au moins une transaction à enregistrer.");
      return;
    }

    appState.loading = true;
    appState.executionStatus = null;
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
          salaryAmount: appState.currentSalaryAmount
        })
      });

      if (res.ok) {
        const resultLog = await res.json();
        if (resultLog.Statut === 'SUCCESS') {
          appState.showToast("Virements sélectionnés enregistrés avec succès !");
          appState.executionStatus = { design: 'Positive', message: resultLog.Message };
          await appState.loadData();
        } else {
          appState.showToast(`Échec : ${resultLog.Message}`);
          appState.executionStatus = { design: 'Negative', message: resultLog.Message };
        }
      } else {
        const errorDetail = await res.json();
        appState.showToast(`Erreur service : ${errorDetail.error?.message || 'Inconnue'}`);
        appState.executionStatus = { design: 'Negative', message: `Erreur service : ${errorDetail.error?.message || 'Inconnue'}` };
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur technique lors de l'enregistrement.");
      appState.executionStatus = { design: 'Negative', message: "Erreur technique lors de l'enregistrement." };
    } finally {
      const duration = Date.now() - startTime;
      const minDuration = 500;
      if (duration < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - duration));
      }
      appState.loading = false;
    }
  }

  /**
   * Validates and saves a single pending transaction.
   */
  async function validateSinglePending(tx) {
    appState.loading = true;
    try {
      const txPayload = {
        ID: appState.generateUUID(),
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
        appState.showToast("Erreur lors de l'enregistrement de la transaction.");
        return;
      }

      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });

      if (delRes.ok) {
        const logPayload = {
          ID: appState.generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Validation virement restant : "${tx.Libelle}" de ${appState.formatCurrency(tx.Montant)} enregistré.`,
          DetailsJSON: JSON.stringify({ validatedTransaction: txPayload }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        appState.showToast(`Virement "${tx.Libelle}" validé avec succès !`);
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la suppression du virement en attente.");
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  /**
   * Deletes a single pending transaction.
   */
  async function deleteSinglePending(tx) {
    appState.loading = true;
    try {
      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });

      if (delRes.ok) {
        const logPayload = {
          ID: appState.generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Annulation virement restant : "${tx.Libelle}" de ${appState.formatCurrency(tx.Montant)} supprimé.`,
          DetailsJSON: JSON.stringify({ deletedTransaction: tx }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        appState.showToast(`Virement "${tx.Libelle}" supprimé.`);
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la suppression du virement.");
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  /**
   * Opens the dialog to edit a pending transaction.
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
   */
  async function saveEditedPending() {
    if (!pendingForm.Libelle || pendingForm.Montant <= 0) {
      appState.showToast("Veuillez saisir un libellé et un montant valide.");
      return;
    }
    
    appState.loading = true;
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
          ID: appState.generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Modification virement restant : "${pendingForm.Libelle}" mis à jour à ${appState.formatCurrency(pendingForm.Montant)}.`,
          DetailsJSON: JSON.stringify({ updatedTransaction: pendingForm }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        appState.showToast("Virement en attente mis à jour.");
        isPendingFormDialogOpen = false;
        if (editPendingDialogRef && typeof editPendingDialogRef.close === 'function') {
          editPendingDialogRef.close();
        }
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la modification du virement.");
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  /**
   * Removes a proposed transaction from the simulation list.
   */
  async function deleteProposedTx(tx, index) {
    appState.loading = true;
    try {
      const delRes = await fetch(`/odata/v4/patrimoine/PendingTransactions(${tx.ID})`, {
        method: 'DELETE'
      });
      if (delRes.ok) {
        const logPayload = {
          ID: appState.generateUUID(),
          Timestamp: new Date().toISOString().slice(0, 19) + 'Z',
          Statut: 'SUCCESS',
          Message: `Annulation virement proposé : "${tx.Libelle}" de ${appState.formatCurrency(tx.Montant)} supprimé.`,
          DetailsJSON: JSON.stringify({ cancelledProposedTransaction: tx }, null, 2)
        };
        
        await fetch('/odata/v4/patrimoine/ExecutionLogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });

        appState.proposedTransactions = appState.proposedTransactions.filter((_, i) => i !== index);
        appState.showToast(`Virement "${tx.Libelle}" retiré de la proposition.`);
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la suppression de la proposition.");
      }
    } catch (e) {
      console.error(e);
      appState.showToast("Erreur de connexion.");
    } finally {
      appState.loading = false;
    }
  }

  // Proposed Transactions Filter State
  let proposedFilter = $state('ALL'); // 'ALL' | 'SAVINGS' | 'CURRENT'
  
  let filteredProposedTransactions = $derived.by(() => {
    if (proposedFilter === 'ALL') return appState.proposedTransactions;
    return appState.proposedTransactions.filter(tx => {
      const targetAcc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
      const isSavings = targetAcc && targetAcc.TypePlacement !== 'Courant';
      return proposedFilter === 'SAVINGS' ? isSavings : !isSavings;
    });
  });

  // Safe margin / Fixed charges validation
  let totalCharges = $derived(appState.recurringDebits.filter(deb => deb.Actif).reduce((sum, deb) => sum + parseFloat(deb.Montant || 0), 0));
  let remainingAfterCharges = $derived(appState.currentSalaryAmount - totalCharges);

  // Helper to preview target account balance after split
  function getProjectedBalance(accountId, amount) {
    const acc = appState.accounts.find(a => a.ID === accountId);
    if (!acc) return 0;
    return parseFloat(acc.SoldeActuel || 0) + parseFloat(amount || 0);
  }

  // Quick Action to save default Net Salary config in database
  async function saveDefaultSalary() {
    appState.loading = true;
    try {
      if (appState.salaryConfig) {
        await fetch(`/odata/v4/patrimoine/SalaryConfig(${appState.salaryConfig.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MontantNet: appState.currentSalaryAmount })
        });
      } else {
        await fetch('/odata/v4/patrimoine/SalaryConfig', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ID: appState.generateUUID(),
            MontantBrut: appState.currentSalaryAmount * 1.3,
            MontantNet: appState.currentSalaryAmount,
            JourDePaie: 28
          })
        });
      }
      appState.showToast("Montant de salaire par défaut sauvegardé.");
      await appState.loadData();
    } catch (e) {
      appState.showToast("Erreur lors de l'enregistrement.");
    } finally {
      appState.loading = false;
    }
  }

  // Derived Tiers for the vertical Cash Cascade Layout
  let tier1_Total = $derived(totalCharges);
  
  let tier2_Txs = $derived(appState.proposedTransactions.filter(tx => {
    const acc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
    return acc && acc.TypePlacement === 'Epargne' && tx.Type !== 'Entree';
  }));
  let tier2_Total = $derived(tier2_Txs.reduce((sum, tx) => sum + (tx.checked ? parseFloat(tx.Montant || 0) : 0), 0));

  let tier3_Txs = $derived(appState.proposedTransactions.filter(tx => {
    const acc = appState.accounts.find(a => a.ID === tx.AccountTarget_ID);
    return acc && (acc.TypePlacement === 'Actions' || acc.TypePlacement === 'Verrouille') && tx.Type !== 'Entree';
  }));
  let tier3_Total = $derived(tier3_Txs.reduce((sum, tx) => sum + (tx.checked ? parseFloat(tx.Montant || 0) : 0), 0));

  let tier4_Total = $derived(Math.max(0, appState.currentSalaryAmount - tier2_Total - tier3_Total));
</script>

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('split.title')}</h1>
</div>

<div class="sap-card" style="margin-bottom: 20px;">
  <div class="sap-card-header" style="display: flex; justify-content: space-between; align-items: center;">
    <span class="sap-card-title">Assistant de Répartition & Cascade</span>
    <ui5-button icon="history" design="Transparent" onclick={() => appState.activeTab = 'logs'}>Consulter les Logs</ui5-button>
  </div>
  
  <ui5-busy-indicator active={appState.loading || undefined} style="width: 100%;">
    <div class="sap-card-body" style="padding: 16px;">
      {#if appState.executionStatus}
        <ui5-message-strip 
          design={appState.executionStatus.design} 
          onclose={() => appState.executionStatus = null}
          style="width: 100%; margin-bottom: 16px;">
          {appState.executionStatus.message}
        </ui5-message-strip>
      {/if}

      <!-- Native UI5 Wizard component -->
      <ui5-wizard content-layout="SingleStep" style="height: auto;" onstep-change={(e) => {
        const step = e.detail.step;
        const idx = parseInt(step.getAttribute('data-step-index') || '1');
        appState.wizardActiveStep = idx;
      }}>
        
        <!-- STEP 1: Saisie & Diagnostic -->
        <ui5-wizard-step 
          data-step-index="1"
          title-text="Saisie du Salaire" 
          subtitle-text="Montant net & Diagnostic" 
          selected={appState.wizardActiveStep === 1 || undefined}
          disabled={undefined}>
          
          <div style="display: flex; flex-direction: column; gap: 20px; padding: 16px 8px; max-width: 650px;">
            <div class="form-group" style="margin: 0;">
              <label for="salary-net" style="font-weight: bold; font-size: 13px;">Salaire Net Reçu ce mois-ci (EUR)</label>
              <div style="display: flex; gap: 8px; margin-top: 4px; align-items: center;">
                <ui5-input 
                  id="salary-net" 
                  type="Number" 
                  value={appState.currentSalaryAmount}
                  style="flex: 1;"
                  oninput={(e) => appState.currentSalaryAmount = parseFloat(e.target.value || 0)}>
                </ui5-input>
                <ui5-button 
                  design="Transparent" 
                  icon="save" 
                  disabled={appState.currentSalaryAmount <= 0 || appState.loading || undefined}
                  onclick={saveDefaultSalary}
                  title="Enregistrer ce montant comme salaire par défaut">
                  Sauvegarder par défaut
                </ui5-button>
              </div>
            </div>

            <!-- Health status widgets -->
            <div style="border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 16px; background: var(--sap-background-color); display: flex; flex-direction: column; gap: 10px;">
              <h4 style="margin: 0; font-weight: bold; font-size: 13px; color: var(--sap-primary-color);">Diagnostic de votre Budget Fixe :</h4>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
                <span style="color: var(--sap-text-muted-color);">Charges mensuelles actives (loyer, abonnements, etc.) :</span>
                <strong style="color: var(--sap-error-color);">{appState.formatCurrency(totalCharges)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12.5px; border-top: 1px dashed var(--sap-border-color); padding-top: 8px;">
                <span style="color: var(--sap-text-muted-color); font-weight: bold;">Reste à vivre après charges fixes :</span>
                <strong style="color: {remainingAfterCharges < 0 ? 'var(--sap-error-color)' : 'var(--sap-success-color)'}; font-size: 13.5px;">
                  {appState.formatCurrency(remainingAfterCharges)}
                </strong>
              </div>
            </div>

            {#if remainingAfterCharges < 0}
              <ui5-message-strip design="Negative" style="width: 100%;">
                Attention : Vos charges fixes mensuelles ({appState.formatCurrency(totalCharges)}) dépassent le salaire saisi ! Vous risquez un découvert.
              </ui5-message-strip>
            {:else if remainingAfterCharges < 200 && appState.currentSalaryAmount > 0}
              <ui5-message-strip design="Warning" style="width: 100%;">
                Flux tendu : Après paiement de vos charges fixes, il ne vous restera que {appState.formatCurrency(remainingAfterCharges)} sur votre compte courant.
              </ui5-message-strip>
            {/if}

            <div class="form-actions" style="justify-content: flex-start; margin-top: 8px;">
              <ui5-button 
                design="Emphasized" 
                disabled={appState.currentSalaryAmount <= 0 || undefined} 
                onclick={() => appState.wizardActiveStep = 2}>
                Simuler la Cascade de Flux
              </ui5-button>
            </div>
          </div>
        </ui5-wizard-step>

        <!-- STEP 2: Simulation de la Cascade -->
        <ui5-wizard-step 
          data-step-index="2"
          title-text="Simulation de la Cascade" 
          subtitle-text="Ajustement de la répartition" 
          selected={appState.wizardActiveStep === 2 || undefined}
          disabled={appState.wizardActiveStep < 2 || undefined}>
          
          <div style="display: flex; flex-direction: column; gap: 20px; padding: 16px 8px;">
            <div style="background: rgba(10, 110, 209, 0.03); border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 12px; font-size: 12px; color: var(--sap-text-color);">
              💡 <strong>Rôle de la Cascade</strong> : L'argent est d'abord prélevé pour payer les charges (Niveau 1), puis il coule vers l'épargne (Niveau 2) et l'investissement (Niveau 3) selon vos liaisons de graphe. Ce qui reste constitue votre argent résiduel libre (Niveau 4). 
              <strong>Ajustez ou cochez/décochez les montants ci-dessous</strong>.
            </div>

            <!-- Master Slider Controller -->
            <div style="display: flex; flex-direction: column; gap: 6px; background: #ffffff; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 16px; max-width: 800px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold; font-size: 13px;">Ajuster la jauge de salaire net :</span>
                <strong style="font-size: 18px; color: var(--sap-primary-color);">{appState.formatCurrency(appState.currentSalaryAmount)}</strong>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10000" 
                step="50" 
                value={appState.currentSalaryAmount}
                oninput={(e) => appState.currentSalaryAmount = parseFloat(e.target.value)}
                style="width: 100%; height: 8px; cursor: pointer; border-radius: 4px; background: var(--sap-border-light-color); accent-color: var(--sap-primary-color);" />
            </div>

            <!-- Vertical Waterfall Visualization -->
            <div style="display: flex; flex-direction: column; gap: 16px; position: relative; max-width: 800px; margin-top: 8px;">
              
              <!-- Connection pipeline line -->
              <div style="position: absolute; left: 21px; top: 20px; bottom: 20px; width: 4px; background: linear-gradient(to bottom, var(--sap-error-color) 0%, var(--sap-success-color) 35%, var(--sap-warning-color) 70%, var(--sap-primary-color) 100%); border-radius: 2px; z-index: 1;"></div>
              
              <!-- Niveau 1 -->
              <div style="display: flex; gap: 16px; align-items: flex-start; z-index: 2;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--sap-error-color); border: 4px solid #ffffff; box-shadow: 0 0 0 2px var(--sap-error-color); margin-left: 13px; margin-top: 14px;"></div>
                <div style="flex: 1; background: #ffffff; border-radius: 6px; border: 1px solid var(--sap-border-color); overflow: hidden;">
                  <div style="background: rgba(220, 53, 69, 0.05); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color);">
                    <span style="font-weight: bold; color: var(--sap-error-color); font-size: 12px; text-transform: uppercase;">Niveau 1 : Factures & Charges Fixes</span>
                    <strong style="color: var(--sap-error-color); font-size: 13px;">{appState.formatCurrency(tier1_Total)}</strong>
                  </div>
                  <div style="padding: 10px; font-size: 11.5px; color: var(--sap-text-muted-color);">
                    Couvert automatiquement pour éviter les impayés.
                  </div>
                </div>
              </div>

              <!-- Niveau 2 -->
              <div style="display: flex; gap: 16px; align-items: flex-start; z-index: 2;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--sap-success-color); border: 4px solid #ffffff; box-shadow: 0 0 0 2px var(--sap-success-color); margin-left: 13px; margin-top: 14px;"></div>
                <div style="flex: 1; background: #ffffff; border-radius: 6px; border: 1px solid var(--sap-border-color); overflow: hidden;">
                  <div style="background: rgba(40, 167, 69, 0.05); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color);">
                    <span style="font-weight: bold; color: var(--sap-success-color); font-size: 12px; text-transform: uppercase;">Niveau 2 : Épargne de Précaution (Liquide)</span>
                    <strong style="color: var(--sap-success-color); font-size: 13px;">{appState.formatCurrency(tier2_Total)}</strong>
                  </div>
                  <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                    {#if tier2_Txs.length > 0}
                      {#each tier2_Txs as tx}
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; padding: 4px 8px; border: 1px solid rgba(40, 167, 69, 0.15); background: rgba(40, 167, 69, 0.01); border-radius: 4px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <ui5-checkbox checked={tx.checked ? true : undefined} onchange={(e) => tx.checked = e.target.checked}></ui5-checkbox>
                            <span style="font-weight: 500;">➔ {tx.AccountTargetLibelle}</span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <ui5-input type="Number" value={tx.Montant} style="width: 70px; height: 24px;" oninput={(e) => tx.Montant = parseFloat(e.target.value || 0)}></ui5-input>
                            <span>€</span>
                          </div>
                        </div>
                      {/each}
                    {:else}
                      <span style="font-size: 11px; color: var(--sap-text-muted-color); font-style: italic;">Aucun virement d'épargne.</span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Niveau 3 -->
              <div style="display: flex; gap: 16px; align-items: flex-start; z-index: 2;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--sap-warning-color); border: 4px solid #ffffff; box-shadow: 0 0 0 2px var(--sap-warning-color); margin-left: 13px; margin-top: 14px;"></div>
                <div style="flex: 1; background: #ffffff; border-radius: 6px; border: 1px solid var(--sap-border-color); overflow: hidden;">
                  <div style="background: rgba(233, 115, 12, 0.05); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color);">
                    <span style="font-weight: bold; color: var(--sap-warning-color); font-size: 12px; text-transform: uppercase;">Niveau 3 : Investissements (Enveloppes long terme)</span>
                    <strong style="color: var(--sap-warning-color); font-size: 13px;">{appState.formatCurrency(tier3_Total)}</strong>
                  </div>
                  <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                    {#if tier3_Txs.length > 0}
                      {#each tier3_Txs as tx}
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; padding: 4px 8px; border: 1px solid rgba(233, 115, 12, 0.15); background: rgba(233, 115, 12, 0.01); border-radius: 4px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <ui5-checkbox checked={tx.checked ? true : undefined} onchange={(e) => tx.checked = e.target.checked}></ui5-checkbox>
                            <span style="font-weight: 500;">➔ {tx.AccountTargetLibelle}</span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <ui5-input type="Number" value={tx.Montant} style="width: 70px; height: 24px;" oninput={(e) => tx.Montant = parseFloat(e.target.value || 0)}></ui5-input>
                            <span>€</span>
                          </div>
                        </div>
                      {/each}
                    {:else}
                      <span style="font-size: 11px; color: var(--sap-text-muted-color); font-style: italic;">Aucun investissement.</span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Niveau 4 -->
              <div style="display: flex; gap: 16px; align-items: flex-start; z-index: 2;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--sap-primary-color); border: 4px solid #ffffff; box-shadow: 0 0 0 2px var(--sap-primary-color); margin-left: 13px; margin-top: 14px;"></div>
                <div style="flex: 1; background: #ffffff; border-radius: 6px; border: 1px solid var(--sap-border-color); overflow: hidden;">
                  <div style="background: rgba(10, 110, 209, 0.05); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--sap-border-light-color);">
                    <span style="font-weight: bold; color: var(--sap-primary-color); font-size: 12px; text-transform: uppercase;">Niveau 4 : Solde Reliquat (Compte Courant / Loisirs)</span>
                    <strong style="color: var(--sap-primary-color); font-size: 13px;">{appState.formatCurrency(tier4_Total)}</strong>
                  </div>
                  <div style="padding: 10px; font-size: 11.5px; color: var(--sap-text-muted-color);">
                    Montant disponible restant pour vos dépenses mensuelles courantes.
                  </div>
                </div>
              </div>

            </div>

            <div class="form-actions" style="justify-content: flex-start; gap: 8px; margin-top: 16px;">
              <ui5-button design="Transparent" onclick={() => appState.wizardActiveStep = 1}>Retour</ui5-button>
              <ui5-button design="Emphasized" onclick={() => appState.wizardActiveStep = 3}>Continuer vers l'Enregistrement</ui5-button>
            </div>
          </div>
        </ui5-wizard-step>

        <!-- STEP 3: Choix de Validation & File d'attente -->
        <ui5-wizard-step 
          data-step-index="3"
          title-text="Validation & Suivi" 
          subtitle-text="Enregistrement des virements" 
          selected={appState.wizardActiveStep === 3 || undefined}
          disabled={appState.wizardActiveStep < 3 || undefined}>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; padding: 16px 8px;">
            
            <!-- LEFT: Final Validation Choices -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div style="border: 1px solid var(--sap-border-color); border-radius: 8px; padding: 16px; background: linear-gradient(135deg, #ffffff 0%, rgba(10, 110, 209, 0.04) 100%); display: flex; flex-direction: column; gap: 14px; box-shadow: var(--sap-shadow-card);">
                <h4 style="font-weight: bold; font-size: 14px; color: var(--sap-primary-color); margin: 0; text-transform: uppercase;">
                  Étape 1 : Valider la Répartition
                </h4>
                
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; background: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid var(--sap-border-light-color);">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Montant total alloué :</span>
                    <strong>{appState.formatCurrency(tier2_Total + tier3_Total)}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Taux d'épargne mensuel :</span>
                    <strong style="color: var(--sap-success-color);">{simulatedDistribution.savingsRate}%</strong>
                  </div>
                </div>

                <!-- Dual choices check list option -->
                <div style="display: flex; flex-direction: column; gap: 10px; border-top: 1px dashed var(--sap-border-color); padding-top: 12px;">
                  <span style="font-weight: bold; font-size: 12px;">Comment souhaitez-vous enregistrer ces virements ?</span>
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                      <input type="radio" id="val-imm" name="val-mode" bind:group={validateImmediately} value={true} style="margin-top: 4px;" />
                      <label for="val-imm" style="font-size: 11.5px; font-weight: bold; cursor: pointer; color: var(--sap-text-color);">
                        🚀 Option A : Valider immédiatement
                        <span style="display: block; font-weight: normal; font-size: 10.5px; color: var(--sap-text-muted-color); margin-top: 2px;">
                          Les virements sont considérés comme faits. Les soldes de vos comptes sont mis à jour immédiatement en base.
                        </span>
                      </label>
                    </div>

                    <div style="display: flex; gap: 8px; align-items: flex-start; margin-top: 4px;">
                      <input type="radio" id="val-diff" name="val-mode" bind:group={validateImmediately} value={false} style="margin-top: 4px;" />
                      <label for="val-diff" style="font-size: 11.5px; font-weight: bold; cursor: pointer; color: var(--sap-text-color);">
                        ⏳ Option B : Envoyer vers le carnet de tâches (File d'attente)
                        <span style="display: block; font-weight: normal; font-size: 10.5px; color: var(--sap-text-muted-color); margin-top: 2px;">
                          Les virements sont planifiés. Ils seront stockés dans votre file d'attente ci-contre afin que vous puissiez les valider manuellement un par un.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <ui5-button 
                  design="Emphasized" 
                  style="width: 100%; height: 38px; font-weight: bold;"
                  disabled={appState.proposedTransactions.filter(t => t.checked).length === 0 || !rulesSummary.isValid || appState.loading || undefined}
                  onclick={saveConfirmedSplit}>
                  Confirmer et Enregistrer
                </ui5-button>
              </div>

              <div class="form-actions" style="justify-content: flex-start;">
                <ui5-button design="Transparent" onclick={() => appState.wizardActiveStep = 2}>Retour à la Cascade</ui5-button>
              </div>
            </div>

            <!-- RIGHT: Bank Transfer Notebook (File d'attente) -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div style="border: 1px solid var(--sap-border-color); border-radius: 8px; padding: 16px; background: #ffffff; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--sap-shadow-card);">
                <div style="border-bottom: 1px solid var(--sap-border-light-color); padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <h4 style="font-weight: bold; font-size: 13px; color: var(--sap-primary-color); margin: 0; text-transform: uppercase;">
                    Carnet des virements à faire ({appState.pendingTransactions.length})
                  </h4>
                  {#if appState.pendingTransactions.length > 0}
                    <ui5-button 
                      design="Positive" 
                      icon="sys-enter-2" 
                      style="height: 24px; font-size: 10px;" 
                      disabled={appState.pendingTransactions.filter(t => t.checked).length === 0 || appState.loading || undefined}
                      onclick={saveSelectedPending}>
                      Valider Lot
                    </ui5-button>
                  {/if}
                </div>

                <p style="font-size: 11px; color: var(--sap-text-muted-color); line-height: 1.4; margin: 0;">
                  Ces virements sont planifiés mais non exécutés. <strong>Faites-les sur votre vraie banque</strong>, puis cochez ✔️ ci-dessous pour confirmer et actualiser vos soldes ici.
                </p>

                {#if appState.pendingTransactions.length > 0}
                  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed var(--sap-border-light-color); padding-bottom: 6px; margin-bottom: 4px;">
                    <ui5-checkbox 
                      text="Tout cocher" 
                      checked={allPendingSelected ? true : undefined} 
                      onchange={togglePendingSelectAll}>
                    </ui5-checkbox>
                  </div>
                  
                  <div style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                    {#each appState.pendingTransactions as tx}
                      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; padding: 8px; border: 1px solid var(--sap-border-color); border-radius: 4px; background: var(--sap-background-color);">
                        <div style="display: flex; gap: 6px; align-items: flex-start;">
                          <ui5-checkbox 
                            checked={tx.checked ? true : undefined}
                            onchange={(e) => tx.checked = e.target.checked}>
                          </ui5-checkbox>
                          <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold; font-size: 11px; color: var(--sap-text-color);">{tx.Libelle}</span>
                            <strong style="font-size: 12px; color: var(--sap-primary-color); margin-top: 1px;">{appState.formatCurrency(tx.Montant)}</strong>
                          </div>
                        </div>
                        
                        <div style="display: flex; gap: 2px;">
                          <ui5-button icon="sys-enter-2" design="Positive" style="width: 20px; height: 20px; min-width: 20px;" onclick={() => validateSinglePending(tx)} title="Confirmer le virement"></ui5-button>
                          <ui5-button icon="edit" design="Transparent" style="width: 20px; height: 20px; min-width: 20px;" onclick={() => openEditPending(tx)} title="Modifier"></ui5-button>
                          <ui5-button icon="delete" design="Transparent" style="width: 20px; height: 20px; min-width: 20px; color: var(--sap-error-color);" onclick={() => deleteSinglePending(tx)} title="Supprimer"></ui5-button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div style="text-align: center; color: var(--sap-text-muted-color); padding: 30px 0; font-size: 11px; border: 1px dashed var(--sap-border-color); border-radius: 4px; font-style: italic;">
                    Aucun virement en attente.
                  </div>
                {/if}
              </div>
            </div>

          </div>
        </ui5-wizard-step>

      </ui5-wizard>
    </div>
  </ui5-busy-indicator>
</div>

<!-- EDIT PENDING DIALOG -->
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
        {#each appState.accounts as acc}
          <ui5-option value={acc.ID} selected={pendingForm.AccountSource_ID === acc.ID ? true : undefined}>{acc.Libelle}</ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="edit-pending-target">Compte Cible</label>
      <ui5-select id="edit-pending-target" style="width: 100%;" onchange={(e) => pendingForm.AccountTarget_ID = e.target.value}>
        <ui5-option value="">-- Sélectionner --</ui5-option>
        {#each appState.accounts as acc}
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
    <ui5-button onclick={saveEditedPending} design="Emphasized" disabled={!pendingForm.Libelle || pendingForm.Montant <= 0 || appState.loading || undefined}>
      Enregistrer
    </ui5-button>
  </div>
</ui5-dialog>
