using patrimonio as my from '../db/schema';

/**
 * Sovereign wealth management and financial orchestration service.
 * Exposes OData v4 endpoints for account tracking, DAG salary flows, living expenses, and GDPR operations.
 */
service PatrimoineService {
    /**
     * Account entities with a virtual MotifAjustement annotation for tracking valuation changes.
     */
    entity Accounts as projection on my.Accounts {
        *,
        @Core.Computed: false
        virtual MotifAjustement : String(255)
    };
    entity SalaryConfig as projection on my.SalaryConfig;
    entity AllocationRules as projection on my.AllocationRules;
    entity Transactions as projection on my.Transactions;
    entity RecurringDebits as projection on my.RecurringDebits;
    entity ExecutionLogs as projection on my.ExecutionLogs;
    entity InterestRateHistory as projection on my.InterestRateHistory;
    entity StockFluctuations as projection on my.StockFluctuations;
    entity FlowNodes as projection on my.FlowNodes;
    entity FlowConnections as projection on my.FlowConnections;
    entity PendingTransactions as projection on my.PendingTransactions;
    entity BalanceHistory as projection on my.BalanceHistory;

    /**
     * Executes automatic salary split calculation and immediate ledger transaction creation.
     */
    action processSalarySplit(salaryAmount: Decimal(15,2), deductLivingBudget: Boolean) returns ExecutionLogs;

    /**
     * Simulates salary split allocations using DAG graph or rules and stages proposed transactions in PendingTransactions.
     */
    action calculateSalarySplit(salaryAmount: Decimal(15,2), deductLivingBudget: Boolean) returns String;

    /**
     * Atomically commits user-confirmed salary split transactions into the ledger and clears pending queue.
     */
    action saveConfirmedSalarySplit(transactionsJson: String, salaryAmount: Decimal(15,2)) returns ExecutionLogs;

    /**
     * Recalculates all account balances from the underlying transaction ledger.
     */
    action recomputeAccountBalances() returns String;

    /**
     * Resets database state to default French wealth management demo accounts and initial parameters.
     */
    action resetToDemoData() returns String;

    /**
     * GDPR Art. 17 (Right to Erasure): Completely purges all data across all tables for a zero-data fresh start.
     */
    action clearAllData() returns String;

    /**
     * Computes the everyday living budget status, remaining days until payday, and spending category breakdown.
     */
    function getMonthlyBudgetSummary() returns String;

    /**
     * Returns the user identity, SAP BTP environment metadata, and financial preferences.
     */
    function getUserProfile() returns String;

    /**
     * Updates user financial preferences (net salary, payday, living budget, safety cushion) in database.
     */
    action updateUserProfile(preferencesJson: String) returns String;

    /**
     * GDPR Art. 20 (Data Portability): Exports all user financial assets and records as structured JSON.
     */
    function exportUserData() returns String;
}
