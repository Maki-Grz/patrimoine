import { i18n } from './i18n.svelte.js';

class AppState {
  activeTab = $state('dashboard');
  sidebarCollapsed = $state(false);
  
  accounts = $state([]);
  salaryConfig = $state(null);
  transactions = $state([]);
  recurringDebits = $state([]);
  executionLogs = $state([]);
  loading = $state(false);
  executionStatus = $state(null);
  flowNodes = $state([]);
  flowConnections = $state([]);
  interestRateHistory = $state([]);
  stockFluctuations = $state([]);
  projectionYears = $state(5);
  
  toastMessage = $state('');
  toastRef = $state(null);
  nodeAllocatedAmounts = $state({});

  // Salary Split & Wizard states
  currentSalaryAmount = $state(1458.25);
  proposedTransactions = $state([]);
  pendingTransactions = $state([]);
  wizardActiveStep = $state(1);

  // Budget & Everyday Expenses states
  budgetSummary = $state(null);
  isExpenseDialogOpen = $state(false);

  // User Profile & BTP Integration states
  userProfile = $state(null);
  isProfileDialogOpen = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        this.sidebarCollapsed = true;
      }
    }
  }

  /**
   * Displays a toast notification with the specified message.
   * @param {string} message - The message to show.
   */
  showToast(message) {
    this.toastMessage = message;
    console.log("Toast:", message);
    if (this.toastRef && typeof this.toastRef.show === 'function') {
      try {
        this.toastRef.show();
      } catch (e) {
        console.warn("Could not display toast alert:", e);
      }
    }
  }

  /**
   * Formats a numeric value into a Euro currency string.
   * @param {number|string} value - The numeric value.
   * @returns {string} The formatted currency string.
   */
  formatCurrency(value) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  /**
   * Formats an ISO date string into a French readable date (DD/MM/YYYY HH:MM).
   * @param {string} dateStr - The ISO date string.
   * @returns {string} The formatted date string.
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateStr));
  }

  /**
   * Generates a standard RFC4122 v4 UUID.
   * @returns {string} A random UUID.
   */
  generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Loads all core business datasets with resilience (Promise.allSettled).
   * @returns {Promise<void>}
   */
  async loadData() {
    this.loading = true;
    try {
      const endpoints = [
        { key: 'accounts', url: '/odata/v4/patrimoine/Accounts?$orderby=Ordre asc,Libelle asc', handler: (data) => { this.accounts = data.value || []; } },
        { key: 'salaryConfig', url: '/odata/v4/patrimoine/SalaryConfig', handler: (data) => {
            this.salaryConfig = data.value && data.value[0] ? data.value[0] : null;
            if (this.salaryConfig) {
              this.currentSalaryAmount = parseFloat(this.salaryConfig.MontantNet);
            }
          }
        },
        { key: 'transactions', url: '/odata/v4/patrimoine/Transactions?$orderby=Date desc', handler: (data) => { this.transactions = data.value || []; } },
        { key: 'recurringDebits', url: '/odata/v4/patrimoine/RecurringDebits?$expand=Account', handler: (data) => { this.recurringDebits = data.value || []; } },
        { key: 'executionLogs', url: '/odata/v4/patrimoine/ExecutionLogs?$orderby=Timestamp desc', handler: (data) => { this.executionLogs = data.value || []; } },
        { key: 'flowNodes', url: '/odata/v4/patrimoine/FlowNodes?$expand=Account', handler: (data) => { this.flowNodes = data.value || []; } },
        { key: 'flowConnections', url: '/odata/v4/patrimoine/FlowConnections', handler: (data) => { this.flowConnections = data.value || []; } },
        { key: 'interestRateHistory', url: '/odata/v4/patrimoine/InterestRateHistory', handler: (data) => { this.interestRateHistory = data.value || []; } },
        { key: 'stockFluctuations', url: '/odata/v4/patrimoine/StockFluctuations', handler: (data) => { this.stockFluctuations = data.value || []; } },
        { key: 'pendingTransactions', url: '/odata/v4/patrimoine/PendingTransactions?$expand=AccountSource,AccountTarget', handler: (data) => {
            const rawPending = data.value || [];
            this.pendingTransactions = rawPending.map(item => ({ ...item, checked: true }));
            if (this.pendingTransactions.length > 0 && this.wizardActiveStep === 1) {
              this.wizardActiveStep = 4;
            }
          }
        }
      ];

      const results = await Promise.allSettled(
        endpoints.map(async (ep) => {
          const res = await fetch(ep.url);
          if (!res.ok) throw new Error(`HTTP ${res.status} on ${ep.url}`);
          const data = await res.json();
          ep.handler(data);
        })
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0 && failures.length === endpoints.length) {
        this.showToast("Erreur de connexion avec le serveur CAP.");
      }

      await this.loadBudgetSummary();
      await this.loadUserProfile();
    } catch (err) {
      console.error("Erreur de chargement des données : ", err);
      this.showToast("Erreur de connexion avec le serveur CAP.");
    } finally {
      this.loading = false;
    }
  }

  /**
   * Loads monthly budget summary from CAP function getMonthlyBudgetSummary.
   */
  async loadBudgetSummary() {
    try {
      const res = await fetch('/odata/v4/patrimoine/getMonthlyBudgetSummary()');
      if (res.ok) {
        const raw = await res.json();
        this.budgetSummary = JSON.parse(raw.value || '{}');
      }
    } catch (e) {
      console.warn("Could not load budget summary:", e);
    }
  }

  /**
   * Loads user profile and SAP BTP authentication metadata.
   */
  async loadUserProfile() {
    try {
      const res = await fetch('/odata/v4/patrimoine/getUserProfile()');
      if (res.ok) {
        const raw = await res.json();
        this.userProfile = JSON.parse(raw.value || '{}');
        if (this.userProfile?.preferences?.montantNet) {
          this.currentSalaryAmount = this.userProfile.preferences.montantNet;
        }
      }
    } catch (e) {
      console.warn("Could not load user profile:", e);
    }
  }

  /**
   * Updates user profile financial preferences in backend.
   */
  async updateUserProfile(preferences) {
    this.loading = true;
    try {
      const res = await fetch('/odata/v4/patrimoine/updateUserProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferencesJson: JSON.stringify(preferences) })
      });
      if (res.ok) {
        this.showToast("Préférences du profil sauvegardées avec succès.");
        await this.loadUserProfile();
        await this.loadBudgetSummary();
        await this.loadData();
        return true;
      } else {
        this.showToast("Erreur lors de la sauvegarde du profil.");
        return false;
      }
    } catch (e) {
      this.showToast("Erreur réseau lors de la mise à jour du profil.");
      return false;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Quick expense creator for daily debits (courses, restaurants, etc.).
   */
  async createExpense({ montant, libelle, categorie, accountId, date }) {
    this.loading = true;
    try {
      const payload = {
        ID: this.generateUUID(),
        Date: date || new Date().toISOString().slice(0, 19) + 'Z',
        Libelle: libelle,
        Montant: parseFloat(montant),
        Type: 'Sortie',
        Categorie: categorie || 'Alimentation',
        Statut: 'Execute',
        AccountSource_ID: accountId,
        AccountTarget_ID: null
      };

      const res = await fetch('/odata/v4/patrimoine/Transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.showToast(`Dépense "${libelle}" (${this.formatCurrency(montant)}) enregistrée.`);
        await this.loadData();
        return true;
      } else {
        const err = await res.json();
        this.showToast("Erreur: " + (err.error?.message || "Impossible d'enregistrer la dépense."));
        return false;
      }
    } catch (e) {
      this.showToast("Erreur réseau lors de la création de la dépense.");
      return false;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Resets database state to default French wealth demo accounts.
   */
  async resetDemoData() {
    this.loading = true;
    try {
      const res = await fetch('/odata/v4/patrimoine/resetToDemoData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        this.showToast("Données de démonstration réinitialisées avec succès.");
        await this.loadData();
      } else {
        this.showToast("Erreur lors de la réinitialisation.");
      }
    } catch (e) {
      this.showToast("Erreur réseau.");
    } finally {
      this.loading = false;
    }
  }

  /**
   * Wipes all database tables to start with an empty database (zero data).
   */
  async clearAllData() {
    this.loading = true;
    try {
      const res = await fetch('/odata/v4/patrimoine/clearAllData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        this.showToast("Base de données vidée (mode vierge sans données).");
        await this.loadData();
      } else {
        this.showToast("Erreur lors de la purge de la base de données.");
      }
    } catch (e) {
      this.showToast("Erreur réseau.");
    } finally {
      this.loading = false;
    }
  }

  /**
   * Reconciles and recomputes all account balances from transaction ledger.
   */
  async recomputeBalances() {
    this.loading = true;
    try {
      const res = await fetch('/odata/v4/patrimoine/recomputeAccountBalances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const msg = await res.json();
        this.showToast(msg.value || "Rapprochement bancaire effectué avec succès.");
        await this.loadData();
      } else {
        this.showToast("Erreur lors du rapprochement bancaire.");
      }
    } catch (e) {
      this.showToast("Erreur réseau.");
    } finally {
      this.loading = false;
    }
  }

  /**
   * RGPD Article 20: Exports all user data as a downloadable JSON file.
   */
  async exportUserData() {
    this.loading = true;
    try {
      const res = await fetch('/odata/v4/patrimoine/exportUserData()');
      if (res.ok) {
        const raw = await res.json();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(raw.value || '{}');
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `patrimoine-rgpd-export-${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        this.showToast("Export de vos données RGPD généré avec succès.");
      } else {
        this.showToast("Erreur lors de l'exportation des données.");
      }
    } catch (e) {
      this.showToast("Erreur réseau lors de l'export.");
    } finally {
      this.loading = false;
    }
  }
}

export const appState = new AppState();
