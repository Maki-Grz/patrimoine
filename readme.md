# Patrimoine 🇪🇺

> **Sovereign, SAP-Native Personal Wealth & Financial Heritage Manager**

---

[![Project Status: Beta](https://img.shields.io/badge/status-beta-blue.svg?style=flat-flat&logo=github)](https://github.com/Maki-Grz/patrimoine)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Built with SAP CAP](https://img.shields.io/badge/SAP-CAP%20Node.js-blue?logo=sap)](https://cap.cloud.sap)
[![Svelte](https://img.shields.io/badge/Frontend-Svelte_5-ff3e00?logo=svelte)](https://svelte.dev)

> [!IMPORTANT]
> **BETA RELEASE STATUS (v0.1.0-beta.1)**
> This repository is now in **Beta** release phase. Core features (multi-account management, DAG flow graphs, living budget tracking, previsional cash calendar, bilingual i18n FR/EN, and GDPR-by-design compliance) are fully implemented and covered by automated test suites. Community testing and feedback are warmly welcomed.

---

## Overview

**Patrimoine** is an open-source, self-hostable, and sovereign personal wealth management platform. Built natively on the **SAP Cloud Application Programming Model (CAP)** and powered by **Svelte 5** and **SAP UI5 Web Components**, it provides an elegant, security-first dashboard to map, automate, and simulate your personal asset allocations.

Designed specifically for European citizens under French financial schemas, the application allows users to orchestrate incoming revenue splits into various bank accounts, savings books (*Livret A*, *LDDS*), company stock plans (*PEG/PER*), and investments (*PEA*, *Assurance Vie*).

---

## Tech Stack

- **Backend**: SAP CAP (Node.js) with `@sap/cds` for OData v4 service exposure.
- **Frontend**: Svelte 5 (Vite) + UI5 Web Components & Fiori Design System for standard-compliant enterprise UX.
- **Database**: SQLite (Local development/testing), fully compatible with SAP HANA for production deployments.
- **Routing & Authentication**: SAP BTP Approuter (`@sap/approuter`) for secure routing.

---

## European Context & Digital Sovereignty

In the age of hyper-centralized cloud giants and intrusive fintech aggregators, **Patrimoine** takes a stand for **European Digital Sovereignty** and privacy:

1. **GDPR by Design (RGPD)**: Zero tracking pixels, zero analytics scripts, zero third-party cookie consents. Your financial assets are highly sensitive; the software runs purely on your infrastructure.
2. **Local-First / Sovereign Cloud**: The application runs perfectly offline on local SQLite. When deployed to the cloud, it is optimized for European sovereign cloud stacks (e.g., European SAP BTP regions, sovereign Kubernetes clusters) rather than US-centric SaaS platforms.
3. **No Vendor Lock-In**: Built using standard OData v4, Svelte, and standardized CDS schemas, ensuring that your data models and application remain open and portable.

---

## French Interface & Financial Extracts (Ciblé Francophone)

While the developer-facing documentation and codebase architecture are in English to foster global open-source contributions, the application is tailored for the French financial ecosystem. 

Below are typical data structures and UI texts preserved in French within the system:

### 1. Types de Comptes Supportés (Account Types)
The database uses native terminology for French accounts (`db/schema.cds`):
- `Courant` (Current account)
- `Livret A` (State-regulated savings account)
- `LDDS` (Livret de Développement Durable et Solidaire)
- `PEG Castor Vinci` / `Amundi` (Employee savings plans with company matching / *abondement*)
- `PEA` (Plan d'Epargne en Actions)

### 2. Algorithme de Répartition (Salary Split Messages)
The backend service implementation (`srv/patrimoine-service.js`) logs and validates operations using French feedback strings for the user interface:
- **Validation**: `"Le montant du salaire saisi est invalide."`
- **Missing configuration error**: `"Aucune règle de répartition configurée et aucun graphe de flux trouvé."`
- **Split overshoot protection**: `"Le total des règles fixes (XXXX EUR) dépasse le montant du salaire (YYYY EUR)."`
- **Execution log confirmation**: `"Répartition automatique du salaire de XXXX EUR effectuée avec succès sur YY comptes."`
- **Manual confirmation validation**: `"Répartition manuelle du salaire : X virement(s) enregistré(s) avec succès. Y virement(s) restant(s) en attente."`

---

## Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- SAP CDS command line client (installed globally):
  ```bash
  npm i -g @sap/cds-dk
  ```

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Maki-Grz/patrimoine.git
   cd patrimoine
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the backend server** (using CDS watch mode):
   ```bash
   npm run watch
   ```
   *This starts the OData backend server at `http://localhost:4004`.*

4. **Start the Svelte frontend**:
   Open a separate terminal and run:
   ```bash
   cd app
   npm install
   npm run dev
   ```
   *This launches Vite for the Svelte 5 application (typically at `http://localhost:5173`).*

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
