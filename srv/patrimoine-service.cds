using patrimonio as my from '../db/schema';

service PatrimoineService {
    entity Accounts as projection on my.Accounts;
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


    action processSalarySplit(salaryAmount: Decimal(15,2), deductLivingBudget: Boolean) returns ExecutionLogs;
    action calculateSalarySplit(salaryAmount: Decimal(15,2), deductLivingBudget: Boolean) returns String;
    action saveConfirmedSalarySplit(transactionsJson: String, salaryAmount: Decimal(15,2)) returns ExecutionLogs;
    action recomputeAccountBalances() returns String;
    action resetToDemoData() returns String;
    action clearAllData() returns String;
    function getMonthlyBudgetSummary() returns String;
    function getUserProfile() returns String;
    action updateUserProfile(preferencesJson: String) returns String;
    function exportUserData() returns String;
}
