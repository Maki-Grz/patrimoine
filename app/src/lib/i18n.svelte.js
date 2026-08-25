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
        // Additional Dashboard keys
    "dash.title": "Tableau de bord",
    "dash.kpiWealth": "Patrimoine Brut Total",
    "dash.kpiSavings": "Total Épargne & Placements",
    "dash.kpiCharges": "Charges Fixes Mensuelles",
    "dash.kpiWealthSub": "Calculé sur {count} comptes",
    "dash.kpiSavingsSub": "Exclut le(s) compte(s) courant(s)",
    "dash.kpiChargesSub": "Basé sur les abonnements actifs",
    "dash.cardTitle": "Résumé de mes avoirs",
    "dash.manageAccounts": "Gérer les comptes",
    "dash.colAccount": "Compte",
    "dash.colType": "Type de placement",
    "dash.colBalance": "Solde",
    "dash.noAccounts": "Aucun compte configuré. Allez dans \"Mes Comptes\" pour ajouter des comptes.",
    "dash.titleRefresh": "Actualiser les données",
    "dash.projectionTitle": "Projection d'épargne sur 5 ans",

    // Logs Page
    "logs.title": "Journaux d'Exécution",
    "logs.subtitle": "Consultez l'historique des répartitions de salaire et les logs d'erreurs techniques.",
    "logs.colMsg": "Message",
    "logs.colDetails": "Détails",
    "logs.detailsTitle": "Détails du Log d'Exécution",

    // Additional Account keys
    "acc.manageTitle": "Gestion des Comptes",
    "acc.btnCreate": "Créer un Compte",
    "acc.btnEdit": "Modifier",
    "acc.btnDelete": "Supprimer",
    "acc.colLibelle": "Libellé",
    "acc.colType": "Type",
    "acc.colSolde": "Solde Actuel",
    "acc.colTaux": "Taux d'intérêt",
    "acc.colPlacement": "Catégorie de Placement",
    "acc.colMaturite": "Date Maturité",
    "acc.actions": "Actions",
    "acc.rulesTitle": "Règles de Répartition Actives",
    "acc.rulesSubtitle": "Définissez comment votre salaire est réparti entre vos comptes.",
    "acc.addRule": "Ajouter une Règle",
    "acc.colAccount": "Compte Cible",
    "acc.colRuleType": "Type de règle",
    "acc.colValue": "Valeur",

    // Additional split keys
    "split.rulesTab": "1. Répartition Classique",
    "split.graphTab": "2. Répartition Graphique (Visual)",
    "split.simulateBtn": "Calculer la répartition",
    "split.proposedTxs": "Transactions de répartition proposées",
    "split.execute": "Valider et enregistrer les virements",
    "split.detailsTitle": "Visualisation & Confirmation",

    // Additional graph keys
    "graph.visualTitle": "Graphe de Transit des Flux",
    "graph.createNode": "Créer un Nœud",
    "graph.createConn": "Nouvelle Liaison",
    "graph.btnNodes": "Gérer les Nœuds",
    "graph.btnConns": "Gérer les Liaisons",

    // Additional debits keys
    "rec.periodTitle": "Charges Périodiques & Abonnements",
    "rec.newDebit": "Nouveau Débit",
    "rec.btnEdit": "Modifier",
    "rec.btnDelete": "Supprimer",

    // Additional calendar keys
    "cal.previsionalTitle": "Calendrier de Trésorerie Prévisionnel",
    "cal.selectAccount": "Sélectionner un compte :",
    "cal.projectionLabel": "Projection sur :",
    // Navigation
    "nav.dashboard": "Tableau de bord",
    "nav.accounts": "Mes Comptes & Patrimoine",
    "nav.distribution": "Distribution du Salaire",
    "nav.flowGraph": "Graphe des Flux",
    "nav.recurring": "Abonnements & Débits",
    "nav.calendar": "Calendrier de Trésorerie",
    "nav.logs": "Logs & Historique",

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
    "sidebar.toggle": "Basculer le menu",

    // Dashboard View
    "dash.totalWealth": "Patrimoine Total",
    "dash.monthlySalary": "Salaire Mensuel Net",
    "dash.savingsRate": "Taux d'Épargne Estimé",
    "dash.savingsRateLabel": "Taux cible d'épargne sur revenu",
    "dash.activeAccounts": "Comptes Actifs",
    "dash.accountsOverTime": "Évolution du Patrimoine (Simulation 5 ans)",
    "dash.projectionWarning": "Note : Cette projection est une simulation basée sur les taux actuels, règles d'abondement et débits récurrents enregistrés.",
    "dash.logsOverview": "Dernières opérations de répartition",
    "dash.noLogs": "Aucun log d'exécution disponible.",
    "dash.viewAll": "Voir tous les détails",
    "dash.recentTxs": "Dernières Transactions",
    "dash.noTxs": "Aucune transaction enregistrée.",

    // Accounts Page
    "acc.title": "Mes Comptes Bancaires & Placements",
    "acc.subtitle": "Gérez vos comptes courants, livrets d'épargne et plans d'épargne salariale ou d'actions.",
    "acc.addAccount": "Ajouter un Compte",
    "acc.editAccount": "Modifier le Compte",
    "acc.deleteConfirm": "Voulez-vous vraiment supprimer le compte {name} ? Cela supprimera également ses règles de répartition et débits récurrents associés.",
    "acc.lblLibelle": "Libellé",
    "acc.lblType": "Type de Compte",
    "acc.lblSolde": "Solde Actuel",
    "acc.lblDevise": "Devise",
    "acc.lblPlacement": "Catégorie de Placement",
    "acc.lblMaturite": "Date de Maturité (PEG)",
    "acc.lblTaux": "Taux d'Intérêt (%)",
    "acc.lblIban": "IBAN",
    "acc.colLibelle": "Libellé",
    "acc.colType": "Type",
    "acc.colSolde": "Solde",
    "acc.colTaux": "Taux",
    "acc.colPlacement": "Placement",
    "acc.colMaturite": "Maturité",
    "acc.accCurrent": "Courant",
    "acc.accLivret": "Livret A",
    "acc.accLdds": "LDDS",
    "acc.accPeg": "PEG Castor Vinci",
    "acc.accPea": "PEA",
    "acc.catSavings": "Epargne",
    "acc.catStocks": "Actions",
    "acc.catLocked": "Verrouille",

    // Salary Split (Distribution)
    "split.title": "Répartition et Automation du Salaire",
    "split.subtitle": "Calculez et simulez comment votre salaire mensuel est distribué dans vos différents comptes.",
    "split.salaryInput": "Montant du salaire net à répartir (€)",
    "split.simulate": "Calculer la répartition",
    "split.proposedTxs": "Transactions de répartition proposées",
    "split.execute": "Valider et enregistrer les virements",
    "split.statusSuccess": "Répartition effectuée avec succès !",
    "split.statusError": "Une erreur est survenue lors de la répartition.",
    "split.wizardStep1": "1. Configuration du Salaire",
    "split.wizardStep2": "2. Simulation Graphique & Validation",
    "split.wizardStep3": "3. Exécution",
    "split.proposedEmpty": "Aucune transaction proposée. Entrez un salaire et assurez-vous que vos règles de répartition ou votre graphe sont configurés.",
    "split.pendingTitle": "Virements en Attente de Confirmation",
    "split.pendingConfirmAll": "Valider la sélection",
    "split.pendingDeleteAll": "Supprimer la sélection",

    // Flow Graph
    "graph.title": "Modélisation Graphique des Flux Financiers",
    "graph.subtitle": "Dessinez les nœuds et connexions pour acheminer vos flux (style n8n/Node-RED). Glissez-déposez les nœuds pour organiser votre tableau.",
    "graph.addNode": "Créer un Nœud",
    "graph.addConn": "Nouvelle Connexion",
    "graph.manageNodes": "Gérer les Nœuds",
    "graph.manageConns": "Gérer les Connexions",
    "graph.help": "Glissez les nœuds avec la souris. Le système recalcule la répartition le long des flèches en fonction des règles.",

    // Recurring Debits & Subscriptions
    "rec.title": "Débits Récurrents & Abonnements",
    "rec.subtitle": "Suivez vos charges fixes (loyer, abonnements, factures) et planifiez vos virements.",
    "rec.addDebit": "Nouveau Débit",
    "rec.editDebit": "Modifier le Débit",
    "rec.colDay": "Jour du mois",
    "rec.colActive": "Actif",
    "rec.colType": "Mode",
    "rec.modeAuto": "Automatique",
    "rec.modeManual": "Manuel",

    // Cash Calendar
    "cal.title": "Calendrier de Trésorerie Prévisionnel",
    "cal.subtitle": "Visualisez les jours de paie et les débits planifiés au cours du mois pour éviter les découverts.",
    "cal.legendSalary": "Salaire",
    "cal.legendDebit": "Débit",
    "cal.projectionLabel": "Projection sur"
  },
  en: {
    // Additional Dashboard keys
    "dash.title": "Dashboard",
    "dash.kpiWealth": "Total Gross Wealth",
    "dash.kpiSavings": "Total Savings & Investments",
    "dash.kpiCharges": "Monthly Fixed Charges",
    "dash.kpiWealthSub": "Calculated on {count} accounts",
    "dash.kpiSavingsSub": "Excludes checking account(s)",
    "dash.kpiChargesSub": "Based on active subscriptions",
    "dash.cardTitle": "Asset Summary",
    "dash.manageAccounts": "Manage Accounts",
    "dash.colAccount": "Account",
    "dash.colType": "Investment Type",
    "dash.colBalance": "Balance",
    "dash.noAccounts": "No accounts configured. Go to \"Accounts\" to add accounts.",
    "dash.titleRefresh": "Refresh data",
    "dash.projectionTitle": "5-Year Wealth Projection",

    // Logs Page
    "logs.title": "Execution Logs",
    "logs.subtitle": "Consult the history of salary distributions and technical error logs.",
    "logs.colMsg": "Message",
    "logs.colDetails": "Details",
    "logs.detailsTitle": "Execution Log Details",

    // Additional Account keys
    "acc.manageTitle": "Manage Accounts",
    "acc.btnCreate": "Create Account",
    "acc.btnEdit": "Edit",
    "acc.btnDelete": "Delete",
    "acc.colLibelle": "Label",
    "acc.colType": "Type",
    "acc.colSolde": "Current Balance",
    "acc.colTaux": "Interest Rate",
    "acc.colPlacement": "Investment Category",
    "acc.colMaturite": "Maturity Date",
    "acc.actions": "Actions",
    "acc.rulesTitle": "Active Distribution Rules",
    "acc.rulesSubtitle": "Define how your net income is distributed across your accounts.",
    "acc.addRule": "Add Rule",
    "acc.colAccount": "Target Account",
    "acc.colRuleType": "Rule Type",
    "acc.colValue": "Value",

    // Additional split keys
    "split.rulesTab": "1. Classic Distribution Rules",
    "split.graphTab": "2. Flow Chart Distribution (Visual)",
    "split.simulateBtn": "Calculate Distribution",
    "split.proposedTxs": "Proposed Split Transactions",
    "split.execute": "Validate & Save Transfers",
    "split.detailsTitle": "Visualization & Confirmation",

    // Additional graph keys
    "graph.visualTitle": "Cash Flow Graph",
    "graph.createNode": "Create Node",
    "graph.createConn": "Create Connection",
    "graph.btnNodes": "Manage Nodes",
    "graph.btnConns": "Manage Connections",

    // Additional debits keys
    "rec.periodTitle": "Recurring Charges & Subscriptions",
    "rec.newDebit": "New Debit",
    "rec.btnEdit": "Edit",
    "rec.btnDelete": "Delete",

    // Additional calendar keys
    "cal.previsionalTitle": "Previsional Cash Flow Calendar",
    "cal.selectAccount": "Select account:",
    "cal.projectionLabel": "Projected for:",

    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.accounts": "Accounts & Wealth",
    "nav.distribution": "Salary Splitter",
    "nav.flowGraph": "Cash Flow Graph",
    "nav.recurring": "Debits & Subscriptions",
    "nav.calendar": "Cash Flow Calendar",
    "nav.logs": "Logs & History",

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
    "header.title": "Mon Patrimoine",
    "header.subtitle": "Personal Finance",
    "header.btpDev": "BTP DEV CLOUD",
    "sidebar.toggle": "Toggle navigation sidebar",

    // Dashboard View
    "dash.totalWealth": "Total Wealth",
    "dash.monthlySalary": "Net Monthly Salary",
    "dash.savingsRate": "Est. Savings Rate",
    "dash.savingsRateLabel": "Target savings rate on income",
    "dash.activeAccounts": "Active Accounts",
    "dash.accountsOverTime": "Wealth Evolution (5-Year Simulation)",
    "dash.projectionWarning": "Note: This projection is a simulation based on current interest rates, employer matching, and registered recurring debits.",
    "dash.logsOverview": "Recent Split Operations",
    "dash.noLogs": "No execution logs available.",
    "dash.viewAll": "View all details",
    "dash.recentTxs": "Recent Transactions",
    "dash.noTxs": "No transactions registered.",

    // Accounts Page
    "acc.title": "My Bank Accounts & Investments",
    "acc.subtitle": "Manage your checking accounts, savings books, employee savings, and stock/brokerage portfolios.",
    "acc.addAccount": "Add Account",
    "acc.editAccount": "Edit Account",
    "acc.deleteConfirm": "Are you sure you want to delete the account {name}? This will also delete its allocation rules and recurring debits.",
    "acc.lblLibelle": "Label",
    "acc.lblType": "Account Type",
    "acc.lblSolde": "Current Balance",
    "acc.lblDevise": "Currency",
    "acc.lblPlacement": "Investment Category",
    "acc.lblMaturite": "Maturity Date (PEG)",
    "acc.lblTaux": "Interest Rate (%)",
    "acc.lblIban": "IBAN",
    "acc.colLibelle": "Label",
    "acc.colType": "Type",
    "acc.colSolde": "Balance",
    "acc.colTaux": "Rate",
    "acc.colPlacement": "Placement",
    "acc.colMaturite": "Maturity",
    "acc.accCurrent": "Checking",
    "acc.accLivret": "Livret A",
    "acc.accLdds": "LDDS",
    "acc.accPeg": "PEG Castor Vinci",
    "acc.accPea": "PEA",
    "acc.catSavings": "Savings",
    "acc.catStocks": "Stocks/PEA",
    "acc.catLocked": "Locked (PEG)",

    // Salary Split (Distribution)
    "split.title": "Salary Distribution & Automation",
    "split.subtitle": "Calculate and simulate how your net monthly salary is distributed across your accounts.",
    "split.salaryInput": "Net salary amount to distribute (€)",
    "split.simulate": "Calculate Split",
    "split.proposedTxs": "Proposed Split Transactions",
    "split.execute": "Validate & Save Transfers",
    "split.statusSuccess": "Split executed successfully!",
    "split.statusError": "An error occurred during salary distribution.",
    "split.wizardStep1": "1. Salary Configuration",
    "split.wizardStep2": "2. Flow Simulation & Validation",
    "split.wizardStep3": "3. Execution",
    "split.proposedEmpty": "No proposed transactions. Enter a salary and ensure your allocation rules or flow chart are set up.",
    "split.pendingTitle": "Transfers Pending Confirmation",
    "split.pendingConfirmAll": "Confirm Selection",
    "split.pendingDeleteAll": "Delete Selection",

    // Flow Graph
    "graph.title": "Graphical Cash Flow Modeling",
    "graph.subtitle": "Draw nodes and connections to route your income streams (n8n/Node-RED style). Drag and drop nodes to organize your board.",
    "graph.addNode": "Create Node",
    "graph.addConn": "New Connection",
    "graph.manageNodes": "Manage Nodes",
    "graph.manageConns": "Manage Connections",
    "graph.help": "Drag nodes using the mouse. The system automatically recalculates allocations along connection arrows according to rules.",

    // Recurring Debits & Subscriptions
    "rec.title": "Recurring Debits & Subscriptions",
    "rec.subtitle": "Track your fixed costs (rent, subscriptions, utilities) and schedule manual or automatic transfers.",
    "rec.addDebit": "New Debit",
    "rec.editDebit": "Edit Debit",
    "rec.colDay": "Day of Month",
    "rec.colActive": "Active",
    "rec.colType": "Mode",
    "rec.modeAuto": "Automatic",
    "rec.modeManual": "Manual",

    // Cash Calendar
    "cal.title": "Previsional Cash Flow Calendar",
    "cal.subtitle": "Visualize paydays and planned recurring debits throughout the month to prevent overdrafts.",
    "cal.legendSalary": "Salary",
    "cal.legendDebit": "Debit",
    "cal.projectionLabel": "Projected for"
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
