# Changelog

All notable changes to the **Patrimoine** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-09-20 - Maintenance & Quality Release 🛡️

### Changed
- **Full English Localization**: Translated all documentation (`readme.md`, `CHANGELOG.md`), configuration descriptors (`mta.yaml`), and source code comments across backend and frontend to 100% English.
- **Enterprise JSDoc Coverage**: Added comprehensive JSDoc annotations across all JavaScript modules, event handlers, lifecycle hooks, and utility scripts (`srv/patrimoine-service.js`, `srv/clean-db.js`, `srv/seed-demo.js`, `app/src/main.js`, `app/src/lib/state.svelte.js`, `app/vite.config.js`, `app/svelte.config.js`, `test/patrimoine-service.test.js`).
- **Vendor Neutrality & Reference Purging**: Removed all specific corporate and employer plan references in favor of generic employee savings standards (`Amundi EE - PEG Entreprise`, `PEG Epargne Salariale`, `EMPLOYEUR - SALAIRE`).
- **Data & Seed Updates**: Updated default CSV initialization datasets (`db/data/patrimonio-Accounts.csv`, `db/data/patrimonio-FlowNodes.csv`, `db/data/patrimonio-RecurringDebits.csv`, `db/data/patrimonio-Transactions.csv`) to match vendor-neutral models while strictly preserving asset values and test fixtures.
- **Version Alignment**: Synchronized package version `1.0.1` across root `package.json`, `app/package.json`, `approuter/package.json`, and `mta.yaml`.

---

## [1.0.0] - 2026-09-20 - First Official Release (General Availability) 🚀

Version **1.0.0** marks the conclusion of the Beta phase and the official entry of **Patrimoine** into production. Designed to provide full digital sovereignty to European citizens and tailored for French and European personal savings ecosystems, the platform combines the enterprise power of **SAP Cloud Application Programming Model (CAP)**, a reactive **Svelte 5** interface built with **SAP UI5 Web Components / Fiori Horizon**, and strict **GDPR by Design** compliance.

### 🌟 Key Highlights & Features

#### 🏦 1. Comprehensive Wealth & Account Management
- Native support for European and French savings and investment account types:
  - **Checking Accounts**: Base cashflow management and incoming income splits.
  - **Livret A & LDDS**: Tracking of statutory regulatory ceilings (€22,950 and €12,000) and tax-exempt interest accrual.
  - **Employee Savings Plan (PEG/Amundi)**: Employee shareholding management, periodic valuations, company matching, and latent capital gains.
  - **PEA (Stock Savings Plan)**: Monitoring contributions, portfolio valuations, and fiscal allowances.
  - **Life Insurance (Assurance Vie) & PER**: Support for euro funds and unit-linked assets.
- Real-time calculation of **Gross Wealth**, **Net Wealth**, **Emergency Savings Buffer**, and **Available Cashflow**.

#### 📈 2. Balance History & Valuations (`MotifAjustement`)
- Granular tracking in `BalanceHistory` on every account balance adjustment.
- Virtual annotation field `@Core.Computed: false virtual MotifAjustement : String(255)` to document adjustments (e.g., *"Quarterly PEG valuation update"*, *"Bonus allocation"*).
- Automatic calculation of variance in Euros and percentage (`delta`, `+X.XX € / +X.XX%`).
- Complete traceability and auditability via `ExecutionLogs` and the Balance History dialog.

#### 🔀 3. Visual DAG (Directed Acyclic Graph) Flow Engine
- Financial flow modeling between accounts using an interactive directed acyclic graph.
- Dynamic visual connections supporting percentage rules (`PERCENT`) and fixed amount rules (`FIXED`).
- Automatic cascade deletion of associated connections when removing graph nodes (`FlowNodes` & `FlowConnections`).
- Safe salary split calculation engine preventing overdrafts and balance overshoots.

#### 💰 4. Living Budget & Disposable Income
- Dynamic real-time calculation of remaining living allowance for the current month.
- Configurable deduction of grocery and everyday expenses during salary allocation (`deductLivingBudget`).
- Guaranteed minimum cash cushion threshold maintained on the primary checking account before savings distribution.
- Live tracking of budget consumption directly on the primary dashboard.

#### 📅 5. Previsional 30-Day Cashflow Calendar
- Intelligent cashflow projection over a 30-day rolling horizon from current date.
- Detection and visualization of scheduled recurring debits (rent, subscriptions, insurance, utilities).
- Dynamic payday marking to anticipate month-end balance dips and prevent overdraft charges.

#### 🇪🇺 6. Digital Sovereignty & GDPR Compliance by Design
- **Zero Tracking**: No external dependencies, no telemetry, no advertising trackers, no third-party cookies.
- **Data Portability (GDPR Art. 20)**: One-click complete JSON export of all assets, transactions, rules, subscriptions, and history.
- **Right to Erasure (GDPR Art. 17)**: `clearAllData` function providing atomic and secure wiping of all database tables.
- Native encryption at rest (AES-256 via SAP HANA TDE) and in transit (TLS 1.3).

#### ☁️ 7. SAP BTP (Business Technology Platform) Ready Deployment
- Standardized Multi-Target Application descriptor (`mta.yaml`) for Cloud Foundry deployment.
- Autonomous approuter (`@sap/approuter`) with OAuth2 XSUAA security configuration (`xs-security.json` / `xsappname`).
- HDI deployer for SAP HANA Cloud (`patrimoine-db-deployer`).
- Optimized static asset hosting via the SAP HTML5 Application Repository.
- Health check endpoint `/health` for readiness and liveness container probes.

#### 🌐 8. Svelte 5 Frontend & Bilingual i18n
- Modern frontend architecture built with Svelte 5 reactive Runes (`$state`, `$derived`, `$effect`).
- **SAP UI5 Web Components v2** adhering to SAP Fiori 3 / Horizon guidelines.
- Complete translation dictionaries with real-time language switching (French 🇫🇷 / English 🇬🇧).

#### 🧪 9. Test Isolation & Robustness
- Native Node.js unit and integration test suite (`test/patrimoine-service.test.js`).
- Dedicated test database (`test.sqlite`) ensuring strict isolation from the development database (`db.sqlite`).
- Automated verification of split calculations, referential integrity, and GDPR portability/erasure operations.

---

## [0.1.0-beta.2] - 2026-09-04

### Added
- Additional income tracking and `IncomeDialog` modal.
- Asset valuation evolution monitoring and `BalanceHistoryDialog` integration.
- Strict database isolation between testing and development environments.
- Support for `MotifAjustement` annotation field in OData service `PatrimoineService`.

---

## [0.1.0-beta.1] - 2026-09-03

### Added
- Visual DAG flow graph for automated transfer orchestration.
- Everyday living budget module and daily expenses tracking (`Expenses.svelte`, `ExpenseDialog.svelte`).
- Previsional 30-day cashflow calendar (`CashCalendar.svelte`).
- GDPR compliance: Art. 20 data portability export and Art. 17 data erasure action.
- Bilingual French / English internationalization (`i18n.svelte.js`).

---

## [0.1.0-alpha.3] - 2026-08-25

### Changed
- Modular refactoring of `App.svelte` into standalone components (`Dashboard`, `Accounts`, `Distribution`, `RecurringDebits`, `ExecutionLogs`).
- Introduction of centralized reactive application state store (`state.svelte.js`).

---

## [0.1.0-alpha.2] - 2026-08-14

### Added
- Multi-account data model in `schema.cds`.
- Salary allocation engine supporting fixed amounts and percentage rules.
- Recurring monthly charges and subscription management.
- Initial SAP BTP XSUAA authentication configuration.

---

## [0.1.0-alpha.1] - 2026-08-13

### Added
- Repository initialization and SAP CAP Node.js foundation (`@sap/cds`).
- Svelte 5 frontend integration with Vite and SAP UI5 Web Components.
- Initial sovereign personal wealth management data models.
