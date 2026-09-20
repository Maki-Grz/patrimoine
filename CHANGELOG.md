# Journal des Modifications / Patch Notes (Changelog)

Toutes les modifications notables apportées au projet **Patrimoine** sont consignées dans ce document.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et ce projet respecte les règles du [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.0.0] - 2026-09-20 - Première Release Officielle (General Availability) 🚀

Cette version **1.0.0** marque la fin de la phase Beta et l'entrée officielle de **Patrimoine** en production. Conçue pour offrir une souveraineté numérique totale aux citoyens européens et adaptée aux spécificités de la fiscalité et de l'épargne françaises, la plateforme combine la puissance du modèle d'entreprise **SAP Cloud Application Programming (CAP)**, une interface ultra-réactive en **Svelte 5** basée sur les composants **SAP UI5 Web Components / Fiori**, et une conformité stricte **RGPD dès la conception**.

### 🌟 Points Majeurs & Nouvelles Fonctionnalités

#### 🏦 1. Gestion Intégrale du Patrimoine & Comptes Français
- Prise en charge native de la typologie des comptes d'épargne et d'investissement français :
  - **Comptes Courants** : Gestion de la trésorerie de base et des flux entrants.
  - **Livret A & LDDS** : Suivi des plafonds réglementaires (22 950 € et 12 000 €) et des intérêts exonérés.
  - **PEG Castor (Vinci) & Amundi** : Gestion de l'actionnariat salarié, valorisations périodiques, abondement employeur et plus-values latentes.
  - **PEA (Plan d'Épargne en Actions)** : Suivi des versements, valorisations des portefeuilles titres et enveloppe fiscale.
  - **Assurance Vie & PER** : Support des fonds euros et unités de compte.
- Calcul en temps réel du **Patrimoine Brut**, du **Patrimoine Net**, de l'**Épargne de Précaution** et de la **Trésorerie Disponible**.

#### 📈 2. Historique des Soldes & Valorisations (`MotifAjustement`)
- Suivi granulaire dans `BalanceHistory` lors de chaque modification de solde d'un compte.
- Champ virtuel `@Core.Computed: false virtual MotifAjustement : String(255)` permettant de documenter chaque variation (ex. : *"Actualisation valorisation trimestrielle PEG"*, *"Versement primes"*).
- Calcul automatique des écarts en euros et en pourcentage (`delta`, `+X.XX € / +X.XX%`).
- Traçabilité et auditabilité complètes via la table `ExecutionLogs` et la boîte de dialogue d'historique de solde.

#### 🔀 3. Moteur Visuel de Répartition par Graphe DAG (Directed Acyclic Graph)
- Modélisation des flux financiers entre comptes sous forme de graphe orienté interactif.
- Connexions visuelles dynamiques avec gestion des règles en pourcentage (`PERCENT`) et en montants fixes (`FIXED`).
- Suppression en cascade automatique des connexions associées lors du retrait d'un nœud du graphe (`FlowNodes` & `FlowConnections`).
- Algorithme de ventilation du salaire sécurisé contre les dépassements de solde.

#### 💰 4. Budget de Vie Courante & Reste à Vivre
- Calcul dynamique du « Reste à Vivre » disponible pour le mois en cours.
- Déduction configurable du budget des courses et dépenses courantes lors de la répartition de paie (`deductLivingBudget`).
- Matelas de sécurité plancher garanti sur le compte courant avant distribution vers l'épargne.
- Suivi en direct du solde vivant depuis le tableau de bord principal.

#### 📅 5. Calendrier Prévisionnel de Trésorerie
- Projection intelligente de trésorerie sur un horizon de 30 jours à compter du jour actuel.
- Détection et affichage des débits récurrents (loyer, abonnements, assurances, factures d'énergie).
- Repérage du jour de paie paramétré pour anticiper le creux de fin de mois et éviter tout découvert bancaire.

#### 🇪🇺 6. Souveraineté & Conformité RGPD par Conception
- **Zéro pistage** : Aucune dépendance externe, aucune télémétrie, aucun tracker publicitaire ni cookie tiers.
- **Portabilité des Données (Art. 20 RGPD)** : Export JSON complet en un clic de l'intégralité du patrimoine, transactions, règles, abonnements et historiques.
- **Droit à l'Effacement / Droit à l'Oubli (Art. 17 RGPD)** : Fonction `clearAllData` permettant la purge atomique et sécurisée de la base de données.
- Chiffrement natif au repos (AES-256 via SAP HANA TDE) et en transit (TLS 1.3).

#### ☁️ 7. Déploiement Prêt pour SAP BTP (Business Technology Platform)
- Fichier de descripteur MTA (`mta.yaml`) complet et standardisé pour Cloud Foundry.
- Approuter autonome (`@sap/approuter`) avec configuration de sécurité OAuth2 XSUAA (`xs-security.json` / `xsappname`).
- Déployeur HDI pour SAP HANA Cloud (`patrimoine-db-deployer`).
- Hébergement optimisé des assets statiques dans le SAP HTML5 Application Repository.
- Endpoint de santé `/health` pour les vérifications de disponibilité (readiness & liveness probes).

#### 🌐 8. Interface Utilisateur Svelte 5 & i18n Bilingue
- Architecture frontend moderne construite avec Svelte 5 et les Runes réactives (`$state`, `$derived`, `$effect`).
- Composants visuels **SAP UI5 Web Components v2** respectant les directives SAP Fiori 3 / Horizon.
- Dictionnaires de traduction complets avec sélecteur de langue temps réel (Français 🇫🇷 / Anglais 🇬🇧).

#### 🧪 9. Isolation des Tests & Robustesse
- Suite de tests unitaires et d'intégration native Node.js (`test/patrimoine-service.test.js`).
- Base de données dédiée aux tests (`test.sqlite`) assurant l'étanchéité totale avec la base de données de développement (`db.sqlite`).
- Validation automatique des règles de répartition, de l'intégrité référentielle et des opérations RGPD.

---

## [0.1.0-beta.2] - 2026-09-04

### Ajouté
- Gestion des revenus complémentaires et boîte de dialogue `IncomeDialog`.
- Suivi de l'évolution des actifs et intégration de `BalanceHistoryDialog`.
- Isolation stricte des bases de données de test et de développement.
- Support du champ d'annotation `MotifAjustement` dans le service OData `PatrimoineService`.

---

## [0.1.0-beta.1] - 2026-09-03

### Ajouté
- Graphe de flux DAG visuel pour l'orchestration des virements automatiques.
- Module de suivi du budget vie courante et des dépenses quotidiennes (`Expenses.svelte`, `ExpenseDialog.svelte`).
- Calendrier de trésorerie prévisionnelle sur 30 jours (`CashCalendar.svelte`).
- Conformité RGPD : export de portabilité Art. 20 et effacement des données Art. 17.
- Internationalisation bilingue Français / Anglais (`i18n.svelte.js`).

---

## [0.1.0-alpha.3] - 2026-08-25

### Modifié
- Refonte modulaire de `App.svelte` en sous-composants autonomes (`Dashboard`, `Accounts`, `Distribution`, `RecurringDebits`, `ExecutionLogs`).
- Introduction d'un store d'état réactif centralisé (`state.svelte.js`).

---

## [0.1.0-alpha.2] - 2026-08-14

### Ajouté
- Modèle de données multi-comptes dans `schema.cds`.
- Service de répartition de salaire et règles d'allocation fixes/pourcentage.
- Gestion des prélèvements et abonnements mensuels récurrents.
- Configuration initiale de l'authentification SAP BTP XSUAA.

---

## [0.1.0-alpha.1] - 2026-08-13

### Ajouté
- Initialisation du dépôt et architecture de base SAP CAP Node.js (`@sap/cds`).
- Intégration du frontend Svelte 5 avec Vite et SAP UI5 Web Components.
- Modèle initial de gestion financière personnelle souveraine.

