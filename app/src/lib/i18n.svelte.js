/**
 * @fileoverview Internationalization (i18n) manager for the Patrimoine application.
 * Manages translation dictionaries and reactive language switching using Svelte 5 runes.
 * 
 * @module i18n
 */

/**
 * Translation dictionary containing French (fr) and English (en) localized strings.
 * @type {Record<string, Record<string, string>>}
 */
const dictionary = {
  fr: {
    // Navigation
    "nav.dashboard": "Tableau de Bord",
    "nav.accounts": "Mes Comptes",
    "nav.distribution": "Répartition Salaire",
    "nav.flowGraph": "Graphe de Flux",
    "nav.recurring": "Abonnements & Charges",
    "nav.expenses": "Dépenses Quotidiennes",
    "nav.calendar": "Calendrier Trésorerie",
    "nav.logs": "Historique & Logs",

    // General & Actions
    "gen.confirm": "Confirmer",
    "gen.cancel": "Annuler",
    "gen.edit": "Modifier",
    "gen.delete": "Supprimer",
    "gen.save": "Enregistrer",
    "gen.add": "Ajouter",
    "gen.loading": "Chargement...",
    "gen.error": "Erreur",
    "gen.success": "Succès",
    "gen.actions": "Actions",
    "gen.status": "Statut",
    "gen.type": "Type",
    "gen.date": "Date",
    "gen.amount": "Montant",
    "gen.label": "Libellé",
    "gen.currency": "Devise",
    "gen.search": "Rechercher...",
    "gen.close": "Fermer",

    // Header & Sidebar
    "header.title": "Mon Patrimoine",
    "header.subtitle": "Finances Personnelles",
    "header.btpDev": "BTP DEV CLOUD",
    "header.btpCloud": "SAP BTP CLOUD",
    "sidebar.toggle": "Basculer le menu",

    // User Profile & SAP BTP
    "profile.title": "Profil Utilisateur & Intégration SAP BTP",
    "profile.btpCloud": "BTP Cloud",
    "profile.btpDev": "BTP Dev",
    "profile.tenant": "Tenant",
    "profile.auth": "Auth",
    "profile.space": "Espace",
    "profile.rolesTitle": "Rôles & Autorisations SAP BTP (Scopes XSUAA) :",
    "profile.paramsTitle": "Paramètres & Reste à Vivre du Profil :",
    "profile.netSalary": "Salaire Net Habituel (€)",
    "profile.payDay": "Jour de Paie (1-31)",
    "profile.livingBudget": "Budget Vie (Courses/Restos)",
    "profile.safetyCushion": "Matelas Sécurité Plancher",
    "profile.saveBtn": "Sauvegarder les Préférences",
    "profile.closeBtn": "Fermer",
    "profile.rgpdTitle": "Sécurité & Conformité RGPD :",
    "profile.rgpdTde": "Chiffrement AES-256 (SAP HANA TDE)",
    "profile.rgpdTls": "Chiffrement en transit (TLS 1.3)",
    "profile.rgpdExport": "Exporter mes données (Portabilité Art. 20)",
    "profile.rgpdErase": "Droit à l'effacement (Art. 17)",
    "profile.rgpdEraseConfirm": "Attention : Voulez-vous vraiment effacer toutes vos données personnelles (droit à l'oubli Art. 17 RGPD) ?",

    // Dashboard View
    "dash.title": "Tableau de bord",
    "dash.kpiWealth": "Patrimoine Brut Total",
    "dash.kpiSavings": "Total Épargne & Placements",
    "dash.kpiCharges": "Charges Fixes Mensuelles",
    "dash.kpiWealthSub": "Calculé sur {count} comptes",
    "dash.kpiSavingsSub": "Exclut le(s) compte(s) courant(s)",
    "dash.kpiChargesSub": "Basé sur les abonnements actifs",
    "dash.livingTitle": "Reste à Vivre & Dépenses Quotidiennes",
    "dash.livingSub": "Suivi en direct des courses, restaurants et sorties du mois",
    "dash.spent": "Dépensé :",
    "dash.available": "Disponible :",
    "dash.detailsBtn": "Détails",
    "dash.cardTitle": "Résumé de mes avoirs",
    "dash.manageAccounts": "Gérer les comptes",
    "dash.colAccount": "Compte",
    "dash.colType": "Type de placement",
    "dash.colBalance": "Solde",
    "dash.noAccounts": "Aucun compte configuré. Allez dans \"Mes Comptes\" pour ajouter des comptes.",
    "dash.titleRefresh": "Actualiser les données",
    "dash.projectionTitle": "Projection d'épargne sur 5 ans",
    "dash.projectionWarning": "Note : Cette projection est une simulation basée sur les taux actuels et versements programmés.",
    "dash.accountsOverTime": "Évolution du Patrimoine (Simulation)",

    // Accounts Page
    "acc.manageTitle": "Gestion des Comptes",
    "acc.btnCreate": "Créer un Compte",
    "acc.btnReconcile": "Rapprochement",
    "acc.btnDemo": "Démo",
    "acc.btnClear": "Vider la base",
    "acc.btnClearConfirm": "Attention : Voulez-vous vraiment vider toutes les données de l'application (mode vierge) ?",
    "acc.btnEdit": "Modifier",
    "acc.btnDelete": "Supprimer",
    "acc.colLibelle": "Libellé",
    "acc.colType": "Type",
    "acc.colSolde": "Solde Actuel",
    "acc.colTaux": "Taux d'intérêt",
    "acc.colPlacement": "Catégorie de Placement",
    "acc.colMaturite": "Date Maturité",
    "acc.lblPlafond": "Plafond Réglementaire (€)",
    "acc.lblBank": "Établissement Bancaire",
    "acc.rulesTitle": "Règles de Répartition Actives",
    "acc.rulesSubtitle": "Définissez comment votre salaire est réparti entre vos comptes.",
    "acc.addRule": "Ajouter une Règle",
    "acc.colAccount": "Compte Cible",
    "acc.colRuleType": "Type de règle",
    "acc.colValue": "Valeur",

    // Salary Split (Distribution)
    "split.title": "Répartition et Automation du Salaire",
    "split.subtitle": "Calculez et simulez comment votre salaire mensuel est distribué dans vos différents comptes.",
    "split.rulesTab": "1. Répartition Classique",
    "split.graphTab": "2. Répartition Graphique (Visual)",
    "split.simulateBtn": "Calculer la répartition",
    "split.proposedTxs": "Transactions de répartition proposées",
    "split.execute": "Valider et enregistrer les virements",
    "split.detailsTitle": "Visualisation & Confirmation",
    "split.livingBudgetSwitch": "Déduire le budget de vie et charges avant répartition",
    "split.livingBudgetLabel": "Budget Vie Quotidienne (courses, restos, sorties) :",
    "split.netSavingsCapacity": "Capacité d'épargne nette (surplus distribuable) :",

    // Flow Graph
    "graph.visualTitle": "Graphe de Transit des Flux",
    "graph.subtitle": "Glissez les boîtes pour réorganiser. Utilisez les boutons de gestion pour modifier la structure.",
    "graph.addNode": "Nouveau Nœud",
    "graph.addConn": "Nouvelle Liaison",
    "graph.btnNodes": "Gérer les Nœuds",
    "graph.btnConns": "Gérer les Liaisons",

    // Everyday Expenses
    "expenses.title": "Dépenses Quotidiennes & Reste à Vivre",
    "expenses.subtitle": "Gérez les courses, restaurants et dépenses courantes du mois pour préserver vos soldes.",
    "expenses.newBtn": "Nouvelle Dépense",
    "expenses.budget": "Budget Mensuel de Vie",
    "expenses.spent": "Dépensé ce mois-ci",
    "expenses.remaining": "Reste à Vivre Disponible",
    "expenses.daily": "Rythme Journalier Conseillé",
    "expenses.perDay": "/ jour",
    "expenses.daysLeft": "Sur les {count} jours restants avant la paie",
    "expenses.history": "Historique des Dépenses Récentes",
    "expenses.searchPlaceholder": "Rechercher une dépense...",
    "expenses.allCategories": "Toutes catégories",
    "expenses.colDate": "Date",
    "expenses.colLabel": "Libellé & Catégorie",
    "expenses.colAccount": "Compte Débité",
    "expenses.colAmount": "Montant",
    "expenses.colAction": "Action",
    "expenses.empty": "Aucune dépense trouvée pour ce filtre. Cliquez sur \"Nouvelle Dépense\" pour en enregistrer une.",
    "expenses.dialogTitle": "Enregistrer une Dépense Quotidienne",
    "expenses.quickModels": "Modèles rapides :",
    "expenses.btnSubmit": "Enregistrer le débit",
    "expenses.deleteConfirm": "Supprimer la dépense \"{name}\" ({amount}) ? Le compte sera recrédité.",

    // Recurring Debits
    "rec.title": "Abonnements & Charges Récurrentes",
    "rec.periodTitle": "Charges Périodiques & Abonnements",
    "rec.subtitle": "Suivez vos charges fixes (loyer, abonnements, factures) et planifiez vos virements.",
    "rec.newDebit": "Nouveau Débit",
    "rec.btnEdit": "Modifier",
    "rec.btnDelete": "Supprimer",
    "rec.colDay": "Jour du mois",
    "rec.colActive": "Actif",
    "rec.colType": "Mode",

    // Cash Calendar
    "cal.title": "Calendrier de Trésorerie Prévisionnel",
    "cal.previsionalTitle": "Calendrier de Trésorerie Prévisionnel",
    "cal.subtitle": "Visualisez les jours de paie et les débits planifiés au cours du mois pour éviter les découverts.",
    "cal.legendSalary": "Salaire",
    "cal.legendDebit": "Débit",
    "cal.projectionLabel": "Projection sur :",
    "cal.accountLabel": "COMPTE COURANT À SIMULER",
    "cal.periodLabel": "PÉRIODE DE SIMULATION",
    "cal.currentMonth": "Mois en cours",
    "cal.nextMonth": "Mois prochain",
    "cal.minBalance": "Solde Minimum",
    "cal.cashSecurity": "Sécurité Trésorerie",
    "cal.riskOverdraft": "DÉCOUVERT RISQUÉ",
    "cal.tightCash": "FLUX TENDU",
    "cal.secured": "SÉCURISÉ",
    "cal.cardTitle": "Calendrier de Prévision de Solde",
    "cal.cardSubtitle": "Visualisation journalière du solde estimé après déduction des charges récurrentes et versement du salaire net.",
    "cal.today": "Auj.",
    "cal.salaryBadge": "Salaire",
    "cal.livingBadge": "Vie/Courses",

    // Logs Page
    "logs.title": "Journaux d'Exécution",
    "logs.subtitle": "Consultez l'historique des répartitions de salaire et les logs d'erreurs techniques.",
    "logs.colMsg": "Message",
    "logs.colDetails": "Détails",
    "logs.detailsTitle": "Détails du Log d'Exécution"
  },

  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.accounts": "Accounts",
    "nav.distribution": "Salary Split",
    "nav.flowGraph": "Flow Graph",
    "nav.recurring": "Subscriptions & Charges",
    "nav.expenses": "Daily Expenses",
    "nav.calendar": "Cash Calendar",
    "nav.logs": "History & Logs",

    // General & Actions
    "gen.confirm": "Confirm",
    "gen.cancel": "Cancel",
    "gen.edit": "Edit",
    "gen.delete": "Delete",
    "gen.save": "Save",
    "gen.add": "Add",
    "gen.loading": "Loading...",
    "gen.error": "Error",
    "gen.success": "Success",
    "gen.actions": "Actions",
    "gen.status": "Status",
    "gen.type": "Type",
    "gen.date": "Date",
    "gen.amount": "Amount",
    "gen.label": "Label",
    "gen.currency": "Currency",
    "gen.search": "Search...",
    "gen.close": "Close",

    // Header & Sidebar
    "header.title": "My Wealth",
    "header.subtitle": "Personal Finance",
    "header.btpDev": "BTP DEV CLOUD",
    "header.btpCloud": "SAP BTP CLOUD",
    "sidebar.toggle": "Toggle navigation",

    // User Profile & SAP BTP
    "profile.title": "User Profile & SAP BTP Integration",
    "profile.btpCloud": "BTP Cloud",
    "profile.btpDev": "BTP Dev",
    "profile.tenant": "Tenant",
    "profile.auth": "Auth",
    "profile.space": "Space",
    "profile.rolesTitle": "SAP BTP Roles & Authorizations (XSUAA Scopes):",
    "profile.paramsTitle": "Profile Settings & Living Allowance:",
    "profile.netSalary": "Standard Net Salary (€)",
    "profile.payDay": "Pay Day (1-31)",
    "profile.livingBudget": "Living Budget (Groceries/Dining)",
    "profile.safetyCushion": "Safety Cushion Floor",
    "profile.saveBtn": "Save Preferences",
    "profile.closeBtn": "Close",
    "profile.rgpdTitle": "Security & GDPR Compliance:",
    "profile.rgpdTde": "AES-256 Encryption (SAP HANA TDE)",
    "profile.rgpdTls": "In-Transit Encryption (TLS 1.3)",
    "profile.rgpdExport": "Export My Data (Portability Art. 20)",
    "profile.rgpdErase": "Right to Erasure (Art. 17)",
    "profile.rgpdEraseConfirm": "Warning: Are you sure you want to erase all personal data (Right to be Forgotten GDPR Art. 17)?",

    // Dashboard View
    "dash.title": "Dashboard",
    "dash.kpiWealth": "Total Gross Wealth",
    "dash.kpiSavings": "Total Savings & Investments",
    "dash.kpiCharges": "Monthly Fixed Charges",
    "dash.kpiWealthSub": "Calculated across {count} accounts",
    "dash.kpiSavingsSub": "Excludes checking account(s)",
    "dash.kpiChargesSub": "Based on active recurring debits",
    "dash.livingTitle": "Remaining Allowance & Everyday Expenses",
    "dash.livingSub": "Live tracking of groceries, dining, and daily spending",
    "dash.spent": "Spent:",
    "dash.available": "Available:",
    "dash.detailsBtn": "Details",
    "dash.cardTitle": "Asset Summary",
    "dash.manageAccounts": "Manage Accounts",
    "dash.colAccount": "Account",
    "dash.colType": "Investment Type",
    "dash.colBalance": "Balance",
    "dash.noAccounts": "No accounts configured. Go to \"Accounts\" to add accounts.",
    "dash.titleRefresh": "Refresh data",
    "dash.projectionTitle": "5-Year Wealth Projection",
    "dash.projectionWarning": "Note: This projection is a simulation based on current rates and scheduled transfers.",
    "dash.accountsOverTime": "Wealth Evolution (Simulation)",

    // Accounts Page
    "acc.manageTitle": "Account Management",
    "acc.btnCreate": "Create Account",
    "acc.btnReconcile": "Reconcile",
    "acc.btnDemo": "Demo",
    "acc.btnClear": "Wipe Database",
    "acc.btnClearConfirm": "Warning: Are you sure you want to wipe all application data (zero data mode)?",
    "acc.btnEdit": "Edit",
    "acc.btnDelete": "Delete",
    "acc.colLibelle": "Label",
    "acc.colType": "Type",
    "acc.colSolde": "Current Balance",
    "acc.colTaux": "Interest Rate",
    "acc.colPlacement": "Investment Category",
    "acc.colMaturite": "Maturity Date",
    "acc.lblPlafond": "Statutory Ceiling (€)",
    "acc.lblBank": "Financial Institution",
    "acc.rulesTitle": "Active Distribution Rules",
    "acc.rulesSubtitle": "Define how your net income is distributed across your accounts.",
    "acc.addRule": "Add Rule",
    "acc.colAccount": "Target Account",
    "acc.colRuleType": "Rule Type",
    "acc.colValue": "Value",

    // Salary Split (Distribution)
    "split.title": "Salary Distribution & Automation",
    "split.subtitle": "Calculate and simulate how your net monthly salary is distributed across your accounts.",
    "split.rulesTab": "1. Classic Distribution Rules",
    "split.graphTab": "2. Flow Chart Distribution (Visual)",
    "split.simulateBtn": "Calculate Distribution",
    "split.proposedTxs": "Proposed Split Transactions",
    "split.execute": "Validate & Save Transfers",
    "split.detailsTitle": "Visualization & Confirmation",
    "split.livingBudgetSwitch": "Deduct living budget and fixed charges before distribution",
    "split.livingBudgetLabel": "Everyday Living Budget (groceries, dining):",
    "split.netSavingsCapacity": "Net Distributable Savings Capacity:",

    // Flow Graph
    "graph.visualTitle": "Cash Flow Transition Graph",
    "graph.subtitle": "Drag nodes to reorganize. Use management buttons to adjust connections.",
    "graph.addNode": "New Node",
    "graph.addConn": "New Connection",
    "graph.btnNodes": "Manage Nodes",
    "graph.btnConns": "Manage Connections",

    // Everyday Expenses
    "expenses.title": "Everyday Expenses & Living Budget",
    "expenses.subtitle": "Manage groceries, dining, and daily spending to protect your balances.",
    "expenses.newBtn": "New Expense",
    "expenses.budget": "Monthly Living Budget",
    "expenses.spent": "Spent this month",
    "expenses.remaining": "Remaining Allowance",
    "expenses.daily": "Suggested Daily Allowance",
    "expenses.perDay": "/ day",
    "expenses.daysLeft": "Over {count} days left until payday",
    "expenses.history": "Recent Expenses History",
    "expenses.searchPlaceholder": "Search an expense...",
    "expenses.allCategories": "All categories",
    "expenses.colDate": "Date",
    "expenses.colLabel": "Label & Category",
    "expenses.colAccount": "Debited Account",
    "expenses.colAmount": "Amount",
    "expenses.colAction": "Action",
    "expenses.empty": "No expenses found for this filter. Click \"New Expense\" to record one.",
    "expenses.dialogTitle": "Record an Everyday Expense",
    "expenses.quickModels": "Quick templates:",
    "expenses.btnSubmit": "Record Debit",
    "expenses.deleteConfirm": "Delete expense \"{name}\" ({amount})? The account will be credited back.",

    // Recurring Debits
    "rec.title": "Recurring Debits & Subscriptions",
    "rec.periodTitle": "Recurring Charges & Subscriptions",
    "rec.subtitle": "Track your fixed charges (rent, subscriptions, utilities) and schedule transfers.",
    "rec.newDebit": "New Debit",
    "rec.btnEdit": "Edit",
    "rec.btnDelete": "Delete",
    "rec.colDay": "Day of Month",
    "rec.colActive": "Active",
    "rec.colType": "Mode",

    // Cash Calendar
    "cal.title": "Previsional Cash Flow Calendar",
    "cal.previsionalTitle": "Previsional Cash Flow Calendar",
    "cal.subtitle": "Visualize paydays and planned recurring debits throughout the month to prevent overdrafts.",
    "cal.legendSalary": "Salary",
    "cal.legendDebit": "Debit",
    "cal.projectionLabel": "Projected for:",
    "cal.accountLabel": "CHECKING ACCOUNT TO SIMULATE",
    "cal.periodLabel": "SIMULATION PERIOD",
    "cal.currentMonth": "Current Month",
    "cal.nextMonth": "Next Month",
    "cal.minBalance": "Minimum Balance",
    "cal.cashSecurity": "Cash Security",
    "cal.riskOverdraft": "OVERDRAFT RISK",
    "cal.tightCash": "TIGHT CASH",
    "cal.secured": "SECURED",
    "cal.cardTitle": "Daily Balance Forecast Calendar",
    "cal.cardSubtitle": "Daily estimated balance projection after deducting recurring debits and crediting net salary.",
    "cal.today": "Today",
    "cal.salaryBadge": "Salary",
    "cal.livingBadge": "Everyday/Food",

    // Logs Page
    "logs.title": "Execution Logs",
    "logs.subtitle": "Consult the history of salary distributions and technical error logs.",
    "logs.colMsg": "Message",
    "logs.colDetails": "Details",
    "logs.detailsTitle": "Execution Log Details"
  }
};

/**
 * Reactive manager for internationalization (i18n) using Svelte 5 state.
 */
class I18nManager {
  /**
   * The current active language code ('fr' or 'en').
   * @type {'fr'|'en'}
   */
  currentLang = $state('fr');

  /**
   * Constructs the i18n manager and attempts to load the saved language setting.
   */
  constructor() {
    try {
      const saved = localStorage.getItem('patrimoine-lang');
      if (saved === 'fr' || saved === 'en') {
        this.currentLang = saved;
      }
    } catch (e) {
      console.warn('LocalStorage is not accessible. Defaulting to French.', e);
    }
  }

  /**
   * Updates the active language and persists the choice to localStorage.
   * @param {'fr'|'en'} lang - The new language code to apply.
   * @returns {void}
   */
  setLanguage(lang) {
    if (lang === 'fr' || lang === 'en') {
      this.currentLang = lang;
      try {
        localStorage.setItem('patrimoine-lang', lang);
      } catch (e) {
        console.warn('Could not save language selection in localStorage.', e);
      }
    }
  }

  /**
   * Retrieves the translated string for a given key.
   * Optionally replaces placeholders formatted as `{key}`.
   * 
   * @param {string} key - The dictionary path/key.
   * @param {Record<string, string|number>} [replacements] - Key-value replacements for placeholders.
   * @returns {string} The formatted translation or the key itself if not found.
   */
  t(key, replacements = {}) {
    const dict = dictionary[this.currentLang] || dictionary.fr;
    let text = dict[key] || key;
    
    if (replacements && typeof replacements === 'object') {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    
    return text;
  }
}

export const i18n = new I18nManager();
