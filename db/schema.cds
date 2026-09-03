namespace patrimonio;

using { cuid, managed } from '@sap/cds/common';

// Types de placements et d'allocations
type PlacementCategory : String enum {
    Courant;
    Epargne;
    Actions;
    Verrouille;
    Autre;
};

type RuleType : String enum {
    PERCENT;
    FIXED;
};

type TransactionType : String enum {
    Entree;
    Sortie;
    Virement_Split;
    Virement_Interne;
    Ajustement;
};

entity Accounts : cuid, managed {
    Libelle       : String(100) not null;
    Type          : String(50) not null;           // Courant, Livret A, LDDS, LEP, PEA, PEG Castor Vinci, Amundi, etc.
    SoldeActuel   : Decimal(15, 2) default 0.00;
    Devise        : String(3) default 'EUR';
    TypePlacement : PlacementCategory default 'Courant';
    DateMaturite  : Date;                          // Pour les placements bloqués (PEG/PEE/PER)
    TauxActuel    : Decimal(5, 2) default 0.00;    // Taux courant ou rendement estimé en %
    IBAN          : String(34);                    // IBAN pour virements
    Plafond       : Decimal(15, 2);                // Plafond réglementaire (Livret A: 22 950 €, LDDS: 12 000 €, etc.)
    Etablissement : String(100);                   // Nom de la banque / établissement financier
    Couleur       : String(7);                     // Code couleur hexadécimal (#0a6ed1)
    Ordre         : Integer default 0;             // Ordre de tri dans l'interface
}

entity SalaryConfig : cuid, managed {
    MontantBrut          : Decimal(15, 2);
    MontantNet           : Decimal(15, 2) not null;
    JourDePaie           : Integer default 28;
    BudgetVieCourante    : Decimal(15, 2) default 800.00; // Enveloppe mensuelle pour courses, restos, sorties, vie courante
    MatelasSecurite      : Decimal(15, 2) default 500.00; // Seuil plancher minimal sur le compte courant
}

entity AllocationRules : cuid, managed {
    Account                  : Association to Accounts;
    PourcentageOuMontantFixe : RuleType not null;  // 'PERCENT' ou 'FIXED'
    Valeur                   : Decimal(15, 2) not null;
}

entity Transactions : cuid, managed {
    Date          : DateTime default $now;
    Libelle       : String(255) not null;
    Montant       : Decimal(15, 2) not null;
    Type          : TransactionType default 'Virement_Split'; // Entree, Sortie, Virement_Split, Virement_Interne, Ajustement
    AccountSource : Association to Accounts;
    AccountTarget : Association to Accounts;
    Categorie     : String(50);                    // Salaire, Logement, Epargne, Placements, Charges...
    Statut        : String(20) default 'Execute';  // Execute, En_Attente, Annule
}

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

entity RecurringDebits : cuid, managed {
    Libelle             : String(100) not null;
    Montant             : Decimal(15, 2) not null;
    JourDuMois          : Integer not null;
    Account             : Association to Accounts;
    Actif               : Boolean default true;
    Type                : String(20) default 'Automatique'; // 'Automatique' ou 'Manuel'
    DernierPaiementDate : Date;                             // Date du dernier virement manuel
    Categorie           : String(50);
}

entity ExecutionLogs : cuid, managed {
    Timestamp   : DateTime default $now;
    Statut      : String(10);                      // SUCCESS, ERROR
    Message     : String(1000);
    DetailsJSON : LargeString;
}

// Suivi des taux d'intérêt historiques ou planifiés (ex: Livret A)
entity InterestRateHistory : cuid, managed {
    Account   : Association to Accounts;
    DateDebut : Date;
    DateFin   : Date;
    Taux      : Decimal(5, 2);                     // Ex: 1.70% ou 3.00%
}

// Abondement d'entreprise & variations de parts
entity StockFluctuations : cuid, managed {
    Account         : Association to Accounts;
    DateFluctuation : DateTime default $now;
    ValeurPart      : Decimal(15, 4);              // Valeur unitaire de l'action
    NombreParts     : Decimal(15, 4);
    Abondement      : Decimal(15, 2);              // Montant d'abondement versé
}

// Modélisation du graphe de transit des flux (Style n8n)
entity FlowNodes : cuid, managed {
    Label   : String(100) not null;
    Type    : String(50);                          // 'Source', 'Transit', 'Target'
    Account : Association to Accounts;
    PosX    : Integer;                             // Coordonnées pour l'affichage visuel
    PosY    : Integer;
}

entity FlowConnections : cuid, managed {
    SourceNode : Association to FlowNodes;
    TargetNode : Association to FlowNodes;
    TypeRegle  : RuleType not null;                // 'PERCENT' ou 'FIXED'
    Valeur     : Decimal(15, 2) not null;
}
