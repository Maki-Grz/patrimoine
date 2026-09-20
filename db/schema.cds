namespace patrimonio;

using { cuid, managed } from '@sap/cds/common';

/**
 * Investment and allocation categories for accounts.
 */
type PlacementCategory : String enum {
    Courant;
    Epargne;
    Actions;
    Verrouille;
    Autre;
};

/**
 * Rule types for allocation and DAG flow edges (Percentage or Fixed amount).
 */
type RuleType : String enum {
    PERCENT;
    FIXED;
};

/**
 * Types of financial operations supported by the platform.
 */
type TransactionType : String enum {
    Entree;
    Sortie;
    Virement_Split;
    Virement_Interne;
    Ajustement;
};

/**
 * Bank, savings, and investment accounts.
 */
entity Accounts : cuid, managed {
    Libelle       : String(100) not null;
    Type          : String(50) not null;           // Checking, Livret A, LDDS, LEP, PEA, PEG Employee Savings, Amundi, etc.
    SoldeActuel   : Decimal(15, 2) default 0.00;
    Devise        : String(3) default 'EUR';
    TypePlacement : PlacementCategory default 'Courant';
    DateMaturite  : Date;                          // For locked investment accounts (PEG/PEE/PER)
    TauxActuel    : Decimal(5, 2) default 0.00;    // Current interest rate or estimated yield in %
    IBAN          : String(34);                    // IBAN for wire transfers
    Plafond       : Decimal(15, 2);                // Regulatory ceiling (Livret A: €22,950, LDDS: €12,000, etc.)
    Etablissement : String(100);                   // Bank / financial institution name
    Couleur       : String(7);                     // Hexadecimal color code (#0a6ed1)
    Ordre         : Integer default 0;             // Display sort order in the UI
}

/**
 * Global salary configuration and monthly living budget thresholds.
 */
entity SalaryConfig : cuid, managed {
    MontantBrut          : Decimal(15, 2);
    MontantNet           : Decimal(15, 2) not null;
    JourDePaie           : Integer default 28;
    BudgetVieCourante    : Decimal(15, 2) default 800.00; // Monthly allowance for groceries, restaurants, living expenses
    MatelasSecurite      : Decimal(15, 2) default 500.00; // Minimum safety cushion threshold on checking account
}

/**
 * Classic salary allocation rules (Fixed amounts or Percentages).
 */
entity AllocationRules : cuid, managed {
    Account                  : Association to Accounts;
    PourcentageOuMontantFixe : RuleType not null;  // 'PERCENT' or 'FIXED'
    Valeur                   : Decimal(15, 2) not null;
}

/**
 * Ledger of executed financial transactions.
 */
entity Transactions : cuid, managed {
    Date          : DateTime default $now;
    Libelle       : String(255) not null;
    Montant       : Decimal(15, 2) not null;
    Type          : TransactionType default 'Virement_Split'; // Entree, Sortie, Virement_Split, Virement_Interne, Ajustement
    AccountSource : Association to Accounts;
    AccountTarget : Association to Accounts;
    Categorie     : String(50);                    // Salary, Housing, Savings, Investments, Utilities...
    Statut        : String(20) default 'Execute';  // Execute, En_Attente, Annule
}

/**
 * Staged transactions awaiting user confirmation during salary split wizard.
 */
entity PendingTransactions : cuid, managed {
    Date          : DateTime default $now;
    Libelle       : String(255) not null;
    Montant       : Decimal(15, 2) not null;
    Type          : TransactionType default 'Virement_Split';
    AccountSource : Association to Accounts;
    AccountTarget : Association to Accounts;
    TypeRegle     : String(10);
    Valeur        : Decimal(15, 2);
}

/**
 * Monthly recurring fixed charges, rent, and subscriptions.
 */
entity RecurringDebits : cuid, managed {
    Libelle             : String(100) not null;
    Montant             : Decimal(15, 2) not null;
    JourDuMois          : Integer not null;
    Account             : Association to Accounts;
    Actif               : Boolean default true;
    Type                : String(20) default 'Automatique'; // 'Automatique' or 'Manuel'
    DernierPaiementDate : Date;                             // Date of last manual wire transfer
    Categorie           : String(50);
}

/**
 * Audit trail and execution logs for salary distribution and automated operations.
 */
entity ExecutionLogs : cuid, managed {
    Timestamp   : DateTime default $now;
    Statut      : String(10);                      // SUCCESS, ERROR
    Message     : String(1000);
    DetailsJSON : LargeString;
}

/**
 * Historical or scheduled interest rate tracking for savings accounts (e.g. Livret A).
 */
entity InterestRateHistory : cuid, managed {
    Account   : Association to Accounts;
    DateDebut : Date;
    DateFin   : Date;
    Taux      : Decimal(5, 2);                     // E.g., 1.70% or 3.00%
}

/**
 * Company matching contributions and unit price fluctuations for employee shares.
 */
entity StockFluctuations : cuid, managed {
    Account         : Association to Accounts;
    DateFluctuation : DateTime default $now;
    ValeurPart      : Decimal(15, 4);              // Share unit price
    NombreParts     : Decimal(15, 4);
    Abondement      : Decimal(15, 2);              // Employer matching contribution paid
}

/**
 * Visual transit nodes for the financial DAG distribution graph.
 */
entity FlowNodes : cuid, managed {
    Label   : String(100) not null;
    Type    : String(50);                          // 'Source', 'Transit', 'Target'
    Account : Association to Accounts;
    PosX    : Integer;                             // Layout coordinates for visual canvas
    PosY    : Integer;
}

/**
 * Directed edges and distribution rules between nodes in the DAG graph.
 */
entity FlowConnections : cuid, managed {
    SourceNode : Association to FlowNodes;
    TargetNode : Association to FlowNodes;
    TypeRegle  : RuleType not null;                // 'PERCENT' or 'FIXED'
    Valeur     : Decimal(15, 2) not null;
}

/**
 * Granular balance evolution history and valuation tracking for accounts.
 */
entity BalanceHistory : cuid, managed {
    Account      : Association to Accounts;
    Date         : DateTime default $now;
    AncienSolde  : Decimal(15, 2);
    NouveauSolde : Decimal(15, 2);
    Delta        : Decimal(15, 2);
    Motif        : String(255);
}
