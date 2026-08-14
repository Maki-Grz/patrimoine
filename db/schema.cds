namespace patrimonio;

entity Accounts {
    key ID        : UUID;
    Libelle       : String(100);
    Type          : String(50); // Courant, Livret A, PEG Castor Vinci, Amundi, etc.
    SoldeActuel   : Decimal(15, 2);
    Devise        : String(3) default 'EUR';
    TypePlacement : String(50); // 'Epargne', 'Actions', 'Verrouille', 'Courant'
    DateMaturite  : Date;      // Pour les placements bloqués (PEG)
    TauxActuel    : Decimal(5, 2); // Taux courant en %
    IBAN          : String(34);    // IBAN pour copie rapide
}


entity SalaryConfig {
    key ID       : UUID;
    MontantBrut  : Decimal(15, 2);
    MontantNet   : Decimal(15, 2);
    JourDePaie   : Integer;
}

entity AllocationRules {
    key ID                   : UUID;
    Account                  : Association to Accounts;
    PourcentageOuMontantFixe : String(10); // 'PERCENT' ou 'FIXED'
    Valeur                   : Decimal(15, 2);
}

entity Transactions {
    key ID        : UUID;
    Date          : DateTime;
    Libelle       : String(255);
    Montant       : Decimal(15, 2);
    Type          : String(20); // Entree, Sortie, Virement_Split
    AccountSource : Association to Accounts;
    AccountTarget : Association to Accounts;
}

entity PendingTransactions {
    key ID        : UUID;
    Date          : DateTime;
    Libelle       : String(255);
    Montant       : Decimal(15, 2);
    Type          : String(20);
    AccountSource : Association to Accounts;
    AccountTarget : Association to Accounts;
    TypeRegle     : String(10);
    Valeur        : Decimal(15, 2);
}


entity RecurringDebits {
    key ID                  : UUID;
    Libelle                 : String(100);
    Montant                 : Decimal(15, 2);
    JourDuMois              : Integer;
    Account                 : Association to Accounts;
    Actif                   : Boolean default true;
    Type                    : String(20) default 'Automatique'; // 'Automatique' ou 'Manuel'
    DernierPaiementDate     : Date; // Date du dernier virement manuel
}

entity ExecutionLogs {
    key ID      : UUID;
    Timestamp   : DateTime;
    Statut      : String(10); // SUCCESS, ERROR
    Message     : String(1000);
    DetailsJSON : LargeString;
}

// Suivi des taux d'intérêt historiques ou planifiés (ex: Livret A)
entity InterestRateHistory {
    key ID    : UUID;
    Account   : Association to Accounts;
    DateDebut : Date;
    DateFin   : Date;
    Taux      : Decimal(5, 2); // Ex: 1.70% ou 3.00%
}

// Abondement d'entreprise & variations de parts
entity StockFluctuations {
    key ID          : UUID;
    Account         : Association to Accounts;
    DateFluctuation : DateTime;
    ValeurPart      : Decimal(15, 4); // Valeur unitaire de l'action
    NombreParts     : Decimal(15, 4);
    Abondement      : Decimal(15, 2); // Montant d'abondement versé
}

// Modélisation du graphe de transit des flux (Style n8n)
entity FlowNodes {
    key ID  : UUID;
    Label   : String(100);
    Type    : String(50);   // 'Source', 'Transit', 'Target'
    Account : Association to Accounts;
    PosX    : Integer;      // Coordonnées pour l'affichage visuel
    PosY    : Integer;
}

entity FlowConnections {
    key ID     : UUID;
    SourceNode : Association to FlowNodes;
    TargetNode : Association to FlowNodes;
    TypeRegle  : String(20);   // 'PERCENT' ou 'FIXED'
    Valeur     : Decimal(15, 2);
}
