# Patrimoine 🇪🇺

> **Sovereign, SAP-Native Personal Wealth & Financial Heritage Manager**

---

[![Release: v1.0.0](https://img.shields.io/badge/release-v1.0.0-blue.svg?style=flat-flat&logo=github)](https://github.com/Maki-Grz/patrimoine/releases)
[![Project Status: Production / Stable](https://img.shields.io/badge/status-stable-success.svg?style=flat-flat)](https://github.com/Maki-Grz/patrimoine)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Built with SAP CAP](https://img.shields.io/badge/SAP-CAP%20Node.js-blue?logo=sap)](https://cap.cloud.sap)
[![Svelte](https://img.shields.io/badge/Frontend-Svelte_5-ff3e00?logo=svelte)](https://svelte.dev)

> [!NOTE]
> **OFFICIAL PRODUCTION RELEASE (v1.0.0 - General Availability)**
> Patrimoine has officially graduated from beta into **v1.0.0 (General Availability)**. The platform is production-ready for personal wealth management, financial DAG flow allocations, living budget optimization, previsional cash calendar, French sovereign asset tracking, and full enterprise SAP BTP Cloud deployment. Consult the [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

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

## Déploiement sur SAP BTP (Business Technology Platform)

**Patrimoine** est conçu nativement pour être déployé en tant que Multi-Target Application (MTA) sur **SAP Business Technology Platform (BTP)** dans l'environnement Cloud Foundry.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Patrimoine on SAP BTP                    │
│                                                             │
│  [ Utilisateur / Navigateur ]                               │
│                │                                            │
│                ▼                                            │
│     ┌─────────────────────┐       ┌──────────────────────┐  │
│     │     Approuter       │──────▶│ HTML5 App Repository │  │
│     │ patrimoine-approuter│       │ (Frontend Svelte 5)  │  │
│     └──────────┬──────────┘       └──────────────────────┘  │
│                │                                            │
│        ┌───────┴───────┐                                    │
│        ▼               ▼                                    │
│  ┌──────────┐   ┌──────────────┐                            │
│  │  XSUAA   │   │  CAP Service │ (OData v4 / NodeJS)        │
│  │ (Auth)   │   │patrimoine-srv│                            │
│  └──────────┘   └──────┬───────┘                            │
│                        │                                    │
│                        ▼                                    │
│                 ┌──────────────┐                            │
│                 │  HANA Cloud  │ (HDI Shared Container)     │
│                 │patrimoine-db │                            │
│                 └──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 1. Prérequis & Outillage

Assurez-vous de disposer des prérequis et outils CLI suivants :

1. **Cloud Foundry CLI (`cf`)** (v8 ou supérieure) :
   ```bash
   cf version
   ```
2. **Plugin Cloud Foundry MTA (`multiapps`)** :
   ```bash
   cf install-plugin multiapps
   ```
3. **Cloud MTA Build Tool (`mbt`)** :
   ```bash
   npm install -g mbt
   ```
4. **SAP CDS Development Kit (`@sap/cds-dk`)** :
   ```bash
   npm install -g @sap/cds-dk
   ```
5. **Sous-compte SAP BTP actif** :
   - Environnement **Cloud Foundry** activé avec une organisation et un espace (*space*, ex: `production` ou `dev`).
   - Quotas et droits (*entitlements*) alloués au sous-compte :
     - **SAP HANA Cloud** : service `hana`, plan `hdi-shared`.
     - **Authorization & Trust Management** : service `xsuaa`, plan `application`.
     - **SAP HTML5 Application Repository** : service `html5-apps-repo`, plans `app-host` et `app-runtime`.

---

### 2. Étape 1 : Construction de l'application & de l'archive MTA (`.mtar`)

Depuis la racine du projet, compilez le frontend Svelte 5 ainsi que les artefacts backend, puis générez l'archive de déploiement MTA :

```bash
# 1. Compilation du frontend Svelte 5
npm run build:frontend

# 2. Compilation des modèles CDS pour Node.js / SAP HANA
npm run build:backend

# 3. Génération du package MTA (.mtar)
mbt build
```

> [!TIP]
> L'archive prête pour le déploiement est générée sous `mta_archives/patrimoine_1.0.0.mtar`.

---

### 3. Étape 2 : Connexion à l'environnement SAP BTP Cloud Foundry

Authentifiez-vous auprès de votre région SAP BTP et ciblez votre espace :

```bash
# Se connecter à l'endpoint API Cloud Foundry de votre région (ex: Francfort cf-eu10)
cf login -a https://api.cf.eu10-004.hana.ondemand.com

# Définir l'organisation et l'espace cible
cf target -o <votre-organisation> -s <votre-espace>
```

---

### 4. Étape 3 : Déploiement de l'archive MTA

Lancez le déploiement de l'application complète :

```bash
cf deploy mta_archives/patrimoine_1.0.0.mtar
```

Cette opération orchestrée par le service MTA Cloud Foundry exécute automatiquement :
1. **Création / Mise à jour des services managés** (`patrimoine-db`, `patrimoine-uaa`, `patrimoine-html5-host`, `patrimoine-html5-runtime`).
2. **Déploiement du schéma de base de données** (`patrimoine-db-deployer`) : instancie les tables, vues CDS et conteneur HDI sur SAP HANA Cloud.
3. **Publication du Frontend** (`patrimoine-html5-deployer`) : téléverse le bundle Svelte 5 compilé dans le HTML5 Application Repository.
4. **Démarrage du service backend** (`patrimoine-srv`) : démarre l'application Node.js fournissant les API OData v4 sécurisées.
5. **Démarrage de l'Approuter** (`patrimoine-approuter`) : route unifiée publique avec authentification XSUAA.

---

### 5. Étape 4 : Déploiement manuel direct sur SAP HANA (Optionnel)

Si vous développez et souhaitez déployer directement vos entités CDS sur une instance SAP HANA Cloud liée sans reconstruire l'archive MTA :

```bash
cds deploy --to hana
```

---

### 6. Étape 5 : Attribution des Rôles & Accès à l'Application

1. Accédez au **Cockpit SAP BTP** de votre sous-compte.
2. Naviguez dans **Security** > **Users** (ou **Role Collections**).
3. Attribuez la collection de rôles de l'application Patrimoine à votre utilisateur.
4. Récupérez l'URL publique de l'Approuter avec la commande :
   ```bash
   cf apps
   ```
5. Ouvrez l'URL de `patrimoine-approuter` dans votre navigateur.
6. Le point de terminaison de contrôle d'état et disponibilité est disponible sur `/health`.

---

## Patch Notes & Historique

Consultez le fichier [CHANGELOG.md](CHANGELOG.md) pour retrouver le journal complet des modifications, ajouts et notes de version depuis l'initialisation du projet.

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
