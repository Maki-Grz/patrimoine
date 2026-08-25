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
  currentSalaryAmount = $state(3200);
  proposedTransactions = $state([]);
  pendingTransactions = $state([]);
  wizardActiveStep = $state(1);

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
   * Loads all financial data, configurations, rules, and logs from the CAP OData backend.
   * @returns {Promise<void>}
   */
  async loadData() {
    this.loading = true;
    try {
      const [accRes, salRes, txRes, debRes, logRes, nodeRes, connRes, rateRes, stockRes, pendingRes] = await Promise.all([
        fetch('/odata/v4/patrimoine/Accounts'),
        fetch('/odata/v4/patrimoine/SalaryConfig'),
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
        this.accounts = data.value || [];
      }
      if (salRes.ok) {
        const data = await salRes.json();
        this.salaryConfig = data.value && data.value[0] ? data.value[0] : null;
        if (this.salaryConfig) {
          this.currentSalaryAmount = parseFloat(this.salaryConfig.MontantNet);
        }
      }
      if (txRes.ok) {
        const data = await txRes.json();
        this.transactions = data.value || [];
      }
      if (debRes.ok) {
        const data = await debRes.json();
        this.recurringDebits = data.value || [];
      }
      if (logRes.ok) {
        const data = await logRes.json();
        this.executionLogs = data.value || [];
      }
      if (nodeRes.ok) {
        const data = await nodeRes.json();
        this.flowNodes = data.value || [];
      }
      if (connRes.ok) {
        const data = await connRes.json();
        this.flowConnections = data.value || [];
      }
      if (rateRes.ok) {
        const data = await rateRes.json();
        this.interestRateHistory = data.value || [];
      }
      if (stockRes.ok) {
        const data = await stockRes.json();
        this.stockFluctuations = data.value || [];
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        const rawPending = data.value || [];
        this.pendingTransactions = rawPending.map(item => ({ ...item, checked: true }));
        if (this.pendingTransactions.length > 0 && this.wizardActiveStep === 1) {
          this.wizardActiveStep = 4;
        }
      }
    } catch (err) {
      console.error("Erreur de chargement des données : ", err);
      this.showToast("Erreur de connexion avec le serveur CAP.");
    } finally {
      this.loading = false;
    }
  }
}

export const appState = new AppState();
