# Patrimoine 🇪🇺

> **Sovereign, SAP-Native Personal Wealth & Financial Heritage Manager**

---

[![Release: v1.0.1](https://img.shields.io/badge/release-v1.0.1-blue.svg?style=flat-flat&logo=github)](https://github.com/Maki-Grz/patrimoine/releases)
[![Project Status: Production / Stable](https://img.shields.io/badge/status-stable-success.svg?style=flat-flat)](https://github.com/Maki-Grz/patrimoine)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Built with SAP CAP](https://img.shields.io/badge/SAP-CAP%20Node.js-blue?logo=sap)](https://cap.cloud.sap)
[![Svelte](https://img.shields.io/badge/Frontend-Svelte_5-ff3e00?logo=svelte)](https://svelte.dev)

> [!NOTE]
> **OFFICIAL PRODUCTION RELEASE (v1.0.1)**
> Patrimoine is an enterprise-grade platform for personal wealth management, financial DAG flow allocations, living budget optimization, previsional cash calendars, European sovereign asset tracking, and full enterprise SAP BTP Cloud deployment. Consult the [CHANGELOG.md](CHANGELOG.md) for detailed release history.

---

## Overview

**Patrimoine** is an open-source, self-hostable, and sovereign personal wealth management platform. Built natively on the **SAP Cloud Application Programming Model (CAP)** and powered by **Svelte 5** and **SAP UI5 Web Components**, it provides an elegant, security-first dashboard to map, automate, and simulate personal asset allocations.

Designed for European citizens and adaptable to specialized savings schemes, the application allows users to orchestrate incoming revenue splits into various bank accounts, savings books (*Livret A*, *LDDS*), employee shareholding plans (*PEG/PER*), and investments (*PEA*, *Assurance Vie*).

---

## Tech Stack

- **Backend**: SAP CAP (Node.js) with `@sap/cds` for OData v4 service exposure.
- **Frontend**: Svelte 5 (Vite) + UI5 Web Components & Fiori Design System for standard-compliant enterprise UX.
- **Database**: SQLite (Local development/testing), fully compatible with SAP HANA for production deployments.
- **Routing & Authentication**: SAP BTP Approuter (`@sap/approuter`) for secure routing and XSUAA authentication.

---

## European Context & Digital Sovereignty

In the age of hyper-centralized cloud giants and intrusive fintech aggregators, **Patrimoine** takes a firm stand for **European Digital Sovereignty** and privacy:

1. **GDPR by Design (RGPD)**: Zero tracking pixels, zero analytics scripts, zero third-party cookie consents. Your financial assets are highly sensitive; the software runs purely on your own infrastructure.
2. **Local-First / Sovereign Cloud**: The application runs completely offline on local SQLite. When deployed to the cloud, it is optimized for European sovereign cloud stacks (e.g., European SAP BTP regions, sovereign Kubernetes clusters) rather than US-centric SaaS platforms.
3. **No Vendor Lock-In**: Built using standard OData v4, Svelte, and standardized CDS schemas, ensuring that data models and application logic remain open and portable.

---

## Account Architecture & Allocation Engine

### 1. Supported Account Typology
The database uses standard terminology for regulated and open financial accounts (`db/schema.cds`):
- `Courant` (Primary Checking account)
- `Livret A` (State-regulated savings account with tax exemption)
- `LDDS` (Sustainable development savings account)
- `PEG Epargne Salariale` / `Amundi` (Employee savings plans with company matching / *abondement*)
- `PEA` (Stock savings plan / Equity envelope)
- `Assurance Vie` (Life insurance and unit-linked funds)

### 2. Salary Allocation Algorithm (DAG Flow Engine)
The backend service (`srv/patrimoine-service.js`) provides an intelligent split engine with robust feedback:
- **Validation**: Strict verification of positive transaction amounts and non-looping graph connections.
- **Overdraft Protection**: Automatic check ensuring fixed allocation rules do not exceed net incoming salary.
- **Ceiling Alerts**: Real-time warnings when projected contributions approach or exceed regulatory account limits (e.g. Livret A €22,950 limit).
- **Audit Logs**: Traceability of automated and manual salary splits in `ExecutionLogs`.

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

## Deployment to SAP BTP (Business Technology Platform)

**Patrimoine** is natively designed to be deployed as a Multi-Target Application (MTA) onto **SAP Business Technology Platform (BTP)** within the Cloud Foundry environment.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Patrimoine on SAP BTP                    │
│                                                             │
│  [ User / Browser ]                                         │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────────────┐       ┌──────────────────────┐    │
│   │     Approuter       │──────▶│ HTML5 App Repository │    │
│   │ patrimoine-approuter│       │ (Frontend Svelte 5)  │    │
│   └──────────┬──────────┘       └──────────────────────┘    │
│              │                                              │
│      ┌───────┴───────┐                                      │
│      ▼               ▼                                      │
│┌──────────┐   ┌──────────────┐                              │
││  XSUAA   │   │  CAP Service │ (OData v4 / NodeJS)          │
││ (Auth)   │   │patrimoine-srv│                              │
│└──────────┘   └──────┬───────┘                              │
│                      │                                      │
│                      ▼                                      │
│               ┌──────────────┐                              │
│               │  HANA Cloud  │ (HDI Shared Container)       │
│               │patrimoine-db │                              │
│               └──────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### 1. Prerequisites & CLI Tooling

Ensure you have installed the following required CLI tools:

1. **Cloud Foundry CLI (`cf`)** (v8 or higher):
   ```bash
   cf version
   ```
2. **Cloud Foundry MTA Plugin (`multiapps`)**:
   ```bash
   cf install-plugin multiapps
   ```
3. **Cloud MTA Build Tool (`mbt`)**:
   ```bash
   npm install -g mbt
   ```
4. **SAP CDS Development Kit (`@sap/cds-dk`)**:
   ```bash
   npm install -g @sap/cds-dk
   ```
5. **Active SAP BTP Subaccount**:
   - **Cloud Foundry** environment enabled with an organization and space (e.g., `production` or `dev`).
   - Service entitlements configured in subaccount:
     - **SAP HANA Cloud**: service `hana`, plan `hdi-shared`.
     - **Authorization & Trust Management**: service `xsuaa`, plan `application`.
     - **SAP HTML5 Application Repository**: service `html5-apps-repo`, plans `app-host` and `app-runtime`.

---

### 2. Step 1: Build Application & MTA Archive (`.mtar`)

From the root project folder, compile the Svelte 5 frontend and backend models, then generate the MTA deployment archive:

```bash
# 1. Compile Svelte 5 frontend
npm run build:frontend

# 2. Compile CDS models for Node.js / SAP HANA
npm run build:backend

# 3. Generate MTA deployment archive (.mtar)
mbt build
```

> [!TIP]
> The generated archive will be located at `mta_archives/patrimoine_1.0.1.mtar`.

---

### 3. Step 2: Connect to SAP BTP Cloud Foundry Environment

Authenticate to your SAP BTP region API endpoint and target your space:

```bash
# Log in to Cloud Foundry API endpoint (e.g., Frankfurt cf-eu10)
cf login -a https://api.cf.eu10-004.hana.ondemand.com

# Target your organization and space
cf target -o <your-organization> -s <your-space>
```

---

### 4. Step 3: Deploy MTA Archive

Deploy the full application package to Cloud Foundry:

```bash
cf deploy mta_archives/patrimoine_1.0.1.mtar
```

This Cloud Foundry MTA deployment orchestrates:
1. **Creation/Update of Managed Services** (`patrimoine-db`, `patrimoine-uaa`, `patrimoine-html5-host`, `patrimoine-html5-runtime`).
2. **Database Schema Deployment** (`patrimoine-db-deployer`): Instantiates CDS entities, views, and HDI container on SAP HANA Cloud.
3. **Frontend Publication** (`patrimoine-html5-deployer`): Uploads the compiled Svelte 5 bundle into the HTML5 Application Repository.
4. **Backend Service Launch** (`patrimoine-srv`): Starts the Node.js application exposing secure OData v4 endpoints.
5. **Approuter Gateway Launch** (`patrimoine-approuter`): Unified secure entrypoint with XSUAA OAuth2 protection.

---

### 5. Step 4: Direct Deployment to SAP HANA (Development Mode)

If you are developing and wish to deploy CDS models directly to a bound SAP HANA Cloud instance without building the full MTA archive:

```bash
cds deploy --to hana
```

---

### 6. Step 5: Role Assignment & Application Access

1. Log into your **SAP BTP Cockpit**.
2. Navigate to **Security** > **Users** (or **Role Collections**).
3. Assign the `PatrimoineUser` (or `PatrimoineAdmin`) role collection to your user account.
4. Retrieve the public URL of the deployed Approuter:
   ```bash
   cf apps
   ```
5. Open the `patrimoine-approuter` URL in your browser.
6. Health and availability probes are accessible via `/health`.

---

## Release Notes & History

Consult the [CHANGELOG.md](CHANGELOG.md) file for complete details on all releases, bug fixes, and feature additions.

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
