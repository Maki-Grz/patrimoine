# Contributing to Patrimoine 🇪🇺

Thank you for your interest in contributing to **Patrimoine**! We welcome and appreciate contributions of all kinds: bug reports, documentation updates, feature requests, and code contributions.

As a sovereign European financial tool, we aim for the highest standards of code quality, security, and developer clarity. Please take a moment to review this guide to get started.

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please be respectful, constructive, and collaborative in all communications.

---

## Local Development Setup

To set up a local development environment, follow these steps:

### Prerequisites
- **Node.js**: Version 18.x or higher (LTS recommended)
- **SAP CDS DK**: The command-line development tools for SAP CAP. Install it globally:
  ```bash
  npm i -g @sap/cds-dk
  ```

### Steps

1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/votre-compte/patrimoine.git
   cd patrimoine
   ```

2. **Install project-wide dependencies**:
   This installs the dependencies for the SAP CAP backend, and prepares workspaces if any:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd app
   npm install
   cd ..
   ```

4. **Run the local development stack**:
   - In a terminal, run the backend service:
     ```bash
     npm run watch
     ```
     This starts the SAP CAP watcher. By default, it runs on `http://localhost:4004`. It automatically compiles your CDS files and watches for backend changes.
   
   - In another terminal, run the frontend:
     ```bash
     cd app
     npm run dev
     ```
     This starts the Svelte 5 application on `http://localhost:5173`.

---

## Coding Guidelines

To keep the codebase uniform and maintainable, please follow these guidelines:

### 1. SAP CAP Backend (`srv/`, `db/`)
- Write clean schema definitions in CDS syntax (`.cds`). Follow the camel-case convention for entities and properties, starting with uppercase for Entities (e.g., `Accounts`, `AllocationRules`) and uppercase/camel-case for properties (e.g., `SoldeActuel`, `TypePlacement`).
- Keep custom handler files (`.js`) modular and handle errors gracefully using native SAP CAP request error interfaces (`req.error(...)`).
- Never write credentials, credentials parameters, or private connection strings in `mta.yaml` or `.cds` files. Use environment variables.

### 2. Frontend Svelte 5 (`app/src/`)
- We use **Svelte 5** and its modern **Runes** engine (`$state`, `$derived`, `$derived.by`, `$effect`). Do not use Svelte 4 legacy state definitions (like `let count = 0` updated directly, or reactive statements like `$: count = ...`).
- Use SAP UI5 Web Components and Fiori UI conventions. Align UI layouts to look native, responsive, and accessible.
- Styling should be clean, modular, and contained inside Svelte components or `app.css`.

### 3. Security-First Rule
- **Never commit `.env` or local databases (`db.sqlite`)**. They are excluded in `.gitignore`.
- If you add configurations that require credentials, ensure they are retrieved from environment variables (`process.env.*`) or bound services.

---

## Git Commit Conventions

We follow the **Conventional Commits** specification. This allows automated changelog generation and version tagging. Commit messages should follow this format:

```text
<type>(<scope>): <description>

[optional body]
```

### Allowed Types:
- `feat`: A new feature for the user or system (e.g. `feat(split): add simulation charts for salary split`)
- `fix`: A bug fix (e.g. `fix(db): resolve unique UUID constraint error on execution logs`)
- `docs`: Documentation-only changes (e.g. `docs(readme): update BTP deployment instructions`)
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process, auxiliary tools, or libraries (e.g. `chore(deps): upgrade svelte to v5.56.8`)

---

## Submitting Pull Requests

1. **Create a branch** for your work:
   - For features: `feature/your-feature-name`
   - For bugfixes: `bugfix/your-bug-name`
2. **Commit your changes** following the commit conventions.
3. **Verify the build**: Run the local builds to ensure there are no compilation errors:
   ```bash
   npm run build
   ```
4. **Push** to your fork and submit a Pull Request against the `main` branch.
5. Provide a clear explanation of your changes in the PR description, referencing any relevant issues.
