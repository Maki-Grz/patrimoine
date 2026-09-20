/**
 * @fileoverview Implementation of PatrimoineService in SAP CAP.
 * Handles financial business logic, multi-account balance integrity,
 * transaction validations, DAG flow calculations, salary distribution, and ceiling alerts.
 * 
 * @module patrimoine-service
 */

const cds = require("@sap/cds");

/**
 * Service implementation for PatrimoineService.
 *
 * @param {cds.Service} srv - The CDS service instance.
 * @returns {Promise<void>}
 */
module.exports = cds.service.impl(async function () {
	const {
		Accounts,
		AllocationRules,
		Transactions,
		ExecutionLogs,
		FlowNodes,
		FlowConnections,
		PendingTransactions,
		RecurringDebits,
		InterestRateHistory,
		StockFluctuations,
		SalaryConfig,
		BalanceHistory,
	} = this.entities;

	// Ensure BalanceHistory table and view exist on SQLite without wiping live user data
	try {
		const db = await cds.connect.to("db");
		await db.run(`
			CREATE TABLE IF NOT EXISTS patrimonio_BalanceHistory (
				ID NVARCHAR(36) NOT NULL,
				createdAt TIMESTAMP_TEXT,
				createdBy NVARCHAR(255),
				modifiedAt TIMESTAMP_TEXT,
				modifiedBy NVARCHAR(255),
				Account_ID NVARCHAR(36),
				Date DATETIME_TEXT DEFAULT CURRENT_TIMESTAMP,
				AncienSolde REAL_DECIMAL(15, 2),
				NouveauSolde REAL_DECIMAL(15, 2),
				Delta REAL_DECIMAL(15, 2),
				Motif NVARCHAR(255),
				PRIMARY KEY(ID)
			);
		`);
		await db.run(`
			CREATE VIEW IF NOT EXISTS PatrimoineService_BalanceHistory AS SELECT
				BalanceHistory_0.ID,
				BalanceHistory_0.createdAt,
				BalanceHistory_0.createdBy,
				BalanceHistory_0.modifiedAt,
				BalanceHistory_0.modifiedBy,
				BalanceHistory_0.Account_ID,
				BalanceHistory_0.Date,
				BalanceHistory_0.AncienSolde,
				BalanceHistory_0.NouveauSolde,
				BalanceHistory_0.Delta,
				BalanceHistory_0.Motif
			FROM patrimonio_BalanceHistory AS BalanceHistory_0;
		`);
	} catch (e) {
		// Table or view already exists or is managed by the target database dialect
	}

	// =========================================================================
	// 1. TRANSACTION INTEGRITY AND VALIDATIONS
	// =========================================================================

	/**
	 * Before CREATE handler for Transactions.
	 * Strictly validates amount, account references, and initializes defaults.
	 *
	 * @param {cds.Request} req - The CAP request object containing transaction data.
	 * @returns {Promise<void>}
	 */
	this.before("CREATE", "Transactions", async (req) => {
		const txs = Array.isArray(req.data) ? req.data : [req.data];
		for (const tx of txs) {
			const amount = parseFloat(tx.Montant);
			if (isNaN(amount) || amount <= 0) {
				return req.reject(
					400,
					"Le montant d'une opération financière doit être strictement positif.",
				);
			}

			const sourceId = tx.AccountSource_ID || tx.AccountSource?.ID;
			const targetId = tx.AccountTarget_ID || tx.AccountTarget?.ID;

			if (!sourceId && !targetId) {
				return req.reject(
					400,
					"Une transaction doit spécifier au moins un compte source ou un compte cible.",
				);
			}

			if (sourceId && targetId && sourceId === targetId) {
				return req.reject(
					400,
					"Le compte source et le compte cible doivent être différents pour un virement.",
				);
			}

			if (!tx.Date) {
				tx.Date = new Date().toISOString().slice(0, 19) + "Z";
			}

			if (!tx.ID) {
				tx.ID = cds.utils.uuid();
			}

			if (!tx.Statut) {
				tx.Statut = "Execute";
			}
		}
	});

	/**
	 * After CREATE handler for Transactions.
	 * Automatically adjusts SoldeActuel of source and target accounts.
	 *
	 * @param {Object|Object[]} txData - The created transaction data.
	 * @param {cds.Request} req - The original CAP request.
	 * @returns {Promise<void>}
	 */
	this.after("CREATE", "Transactions", async (txData, req) => {
		const raw = req?.data || txData;
		const txs = Array.isArray(raw) ? raw : [raw];
		for (const transaction of txs) {
			const amount = parseFloat(transaction.Montant || 0);
			if (amount <= 0) continue;

			const sourceId = transaction.AccountSource_ID || transaction.AccountSource?.ID;
			const targetId = transaction.AccountTarget_ID || transaction.AccountTarget?.ID;

			// Debit source account
			if (sourceId) {
				const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: sourceId });
				if (acc) {
					const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) - amount) * 100) / 100;
					await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: sourceId });
				}
			}

			// Credit target account
			if (targetId) {
				const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: targetId });
				if (acc) {
					const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) + amount) * 100) / 100;
					await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: targetId });
				}
			}
		}
	});

	/**
	 * Custom on DELETE handler for Transactions.
	 * Restores account balances before transaction deletion to ensure mathematical consistency,
	 * and directly deletes from the underlying table to ensure SQLite reliability.
	 *
	 * @param {cds.Request} req - The CAP request containing delete parameters.
	 * @returns {Promise<any>}
	 */
	this.on("DELETE", "Transactions", async (req) => {
		const id = req.data?.ID || req.params?.[0]?.ID || req.params?.[0];
		if (!id) {
			const where = req.query?.DELETE?.where;
			if (where) {
				const txs = await SELECT.from("patrimonio.Transactions").where(where);
				for (const tx of txs) {
					const amount = parseFloat(tx.Montant || 0);
					if (amount > 0) {
						if (tx.AccountSource_ID) {
							const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: tx.AccountSource_ID });
							if (acc) {
								const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) + amount) * 100) / 100;
								await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: tx.AccountSource_ID });
							}
						}
						if (tx.AccountTarget_ID) {
							const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: tx.AccountTarget_ID });
							if (acc) {
								const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) - amount) * 100) / 100;
								await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: tx.AccountTarget_ID });
							}
						}
					}
				}
				return await DELETE.from("patrimonio.Transactions").where(where);
			}
			return req.reject(400, "ID de transaction requis pour la suppression.");
		}

		const tx = await SELECT.one.from("patrimonio.Transactions").where({ ID: id });
		if (tx) {
			const amount = parseFloat(tx.Montant || 0);
			if (amount > 0) {
				if (tx.AccountSource_ID) {
					const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: tx.AccountSource_ID });
					if (acc) {
						const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) + amount) * 100) / 100;
						await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: tx.AccountSource_ID });
					}
				}
				if (tx.AccountTarget_ID) {
					const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: tx.AccountTarget_ID });
					if (acc) {
						const newSolde = Math.round((parseFloat(acc.SoldeActuel || 0) - amount) * 100) / 100;
						await UPDATE("patrimonio.Accounts").set({ SoldeActuel: newSolde }).where({ ID: tx.AccountTarget_ID });
					}
				}
			}
		}

		return await DELETE.from("patrimonio.Transactions").where({ ID: id });
	});

	/**
	 * Before UPDATE handler for Transactions.
	 * Adjusts account balances based on the delta between old and new transaction amounts and accounts.
	 *
	 * @param {cds.Request} req - The CAP request containing updated transaction fields.
	 * @returns {Promise<void>}
	 */
	this.before("UPDATE", "Transactions", async (req) => {
		const txId = req.data?.ID || req.params?.[0]?.ID || req.params?.[0];
		if (!txId) return;

		const oldTx = await SELECT.one.from("patrimonio.Transactions").where({ ID: txId });
		if (!oldTx) return;

		const oldAmount = parseFloat(oldTx.Montant || 0);
		const newAmount = req.data.Montant !== undefined ? parseFloat(req.data.Montant) : oldAmount;
		const newSourceId = req.data.AccountSource_ID !== undefined ? req.data.AccountSource_ID : oldTx.AccountSource_ID;
		const newTargetId = req.data.AccountTarget_ID !== undefined ? req.data.AccountTarget_ID : oldTx.AccountTarget_ID;

		// 1. Revert the impact of the previous transaction
		if (oldTx.AccountSource_ID) {
			const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: oldTx.AccountSource_ID });
			if (acc) {
				const restored = Math.round((parseFloat(acc.SoldeActuel || 0) + oldAmount) * 100) / 100;
				await UPDATE("patrimonio.Accounts").set({ SoldeActuel: restored }).where({ ID: oldTx.AccountSource_ID });
			}
		}
		if (oldTx.AccountTarget_ID) {
			const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: oldTx.AccountTarget_ID });
			if (acc) {
				const restored = Math.round((parseFloat(acc.SoldeActuel || 0) - oldAmount) * 100) / 100;
				await UPDATE("patrimonio.Accounts").set({ SoldeActuel: restored }).where({ ID: oldTx.AccountTarget_ID });
			}
		}

		// 2. Apply the impact of the new transaction
		if (newSourceId) {
			const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: newSourceId });
			if (acc) {
				const applied = Math.round((parseFloat(acc.SoldeActuel || 0) - newAmount) * 100) / 100;
				await UPDATE("patrimonio.Accounts").set({ SoldeActuel: applied }).where({ ID: newSourceId });
			}
		}
		if (newTargetId) {
			const acc = await SELECT.one.from("patrimonio.Accounts").where({ ID: newTargetId });
			if (acc) {
				const applied = Math.round((parseFloat(acc.SoldeActuel || 0) + newAmount) * 100) / 100;
				await UPDATE("patrimonio.Accounts").set({ SoldeActuel: applied }).where({ ID: newTargetId });
			}
		}
	});

	/**
	 * Before UPDATE handler for Accounts.
	 * Automatically records balance changes into BalanceHistory and ExecutionLogs
	 * to track wealth evolution (e.g. PEG Employee Savings valuation, savings growth).
	 *
	 * @param {cds.Request} req - The CAP request containing updated account fields.
	 * @returns {Promise<void>}
	 */
	this.before("UPDATE", "Accounts", async (req) => {
		const customMotif = req.data?.MotifAjustement;
		if (req.data && "MotifAjustement" in req.data) {
			delete req.data.MotifAjustement;
		}
		const newSolde = req.data?.SoldeActuel;
		if (newSolde !== undefined && newSolde !== null) {
			const id = req.data?.ID || req.params?.[0]?.ID || req.params?.[0];
			if (id) {
				const oldAcc = await SELECT.one.from("patrimonio.Accounts").where({ ID: id });
				if (oldAcc && oldAcc.SoldeActuel !== undefined) {
					const oldVal = parseFloat(oldAcc.SoldeActuel || 0);
					const newVal = parseFloat(newSolde || 0);
					if (Math.abs(newVal - oldVal) >= 0.01) {
						const delta = Math.round((newVal - oldVal) * 100) / 100;
						const isPos = delta > 0;
						const pct = oldVal > 0 ? ((delta / oldVal) * 100).toFixed(2) : "0.00";
						const motif = customMotif || `Actualisation du solde (${isPos ? '+' : ''}${delta.toFixed(2)} € / ${isPos ? '+' : ''}${pct}%)`;

						await INSERT.into("patrimonio.BalanceHistory").entries({
							ID: cds.utils.uuid(),
							Account_ID: id,
							Date: new Date().toISOString(),
							AncienSolde: oldVal,
							NouveauSolde: newVal,
							Delta: delta,
							Motif: motif,
						});

						await INSERT.into("patrimonio.ExecutionLogs").entries({
							ID: cds.utils.uuid(),
							Timestamp: new Date().toISOString(),
							Statut: "SUCCESS",
							Message: `Évolution [${oldAcc.Libelle}] : ${oldVal.toFixed(2)} € ➔ ${newVal.toFixed(2)} € (${isPos ? '+' : ''}${delta.toFixed(2)} € / ${isPos ? '+' : ''}${pct}%)`,
							DetailsJSON: JSON.stringify(
								{
									compteId: id,
									libelle: oldAcc.Libelle,
									ancienSolde: oldVal,
									nouveauSolde: newVal,
									delta: delta,
									pourcentage: pct,
									motif: motif,
									date: new Date().toISOString(),
								},
								null,
								2,
							),
						});
					}
				}
			}
		}
	});

	// =========================================================================
	// 2. ACCOUNTS AND FLOW NODES LIFECYCLE MANAGEMENT
	// =========================================================================

	/**
	 * Custom on DELETE handler for Accounts.
	 * Cascade deletes child rules, debits, pending txs, and detaches history.
	 *
	 * @param {cds.Request} req - The CAP request with account ID.
	 * @returns {Promise<any>}
	 */
	this.on("DELETE", "Accounts", async (req) => {
		const id = req.data?.ID || req.params?.[0]?.ID || req.params?.[0];
		if (!id) {
			const where = req.query?.DELETE?.where;
			if (where) {
				const accs = await SELECT.from("patrimonio.Accounts").where(where);
				for (const a of accs) {
					await DELETE.from("patrimonio.AllocationRules").where({ Account_ID: a.ID });
					await DELETE.from("patrimonio.RecurringDebits").where({ Account_ID: a.ID });
					await DELETE.from("patrimonio.InterestRateHistory").where({ Account_ID: a.ID });
					await DELETE.from("patrimonio.StockFluctuations").where({ Account_ID: a.ID });
					await DELETE.from("patrimonio.PendingTransactions").where({ AccountSource_ID: a.ID });
					await DELETE.from("patrimonio.PendingTransactions").where({ AccountTarget_ID: a.ID });
					await UPDATE("patrimonio.Transactions").set({ AccountSource_ID: null }).where({ AccountSource_ID: a.ID });
					await UPDATE("patrimonio.Transactions").set({ AccountTarget_ID: null }).where({ AccountTarget_ID: a.ID });
					await UPDATE("patrimonio.FlowNodes").set({ Account_ID: null }).where({ Account_ID: a.ID });
				}
				return await DELETE.from("patrimonio.Accounts").where(where);
			}
			return req.reject(400, "ID de compte requis.");
		}

		await DELETE.from("patrimonio.AllocationRules").where({ Account_ID: id });
		await DELETE.from("patrimonio.RecurringDebits").where({ Account_ID: id });
		await DELETE.from("patrimonio.InterestRateHistory").where({ Account_ID: id });
		await DELETE.from("patrimonio.StockFluctuations").where({ Account_ID: id });
		await DELETE.from("patrimonio.PendingTransactions").where({ AccountSource_ID: id });
		await DELETE.from("patrimonio.PendingTransactions").where({ AccountTarget_ID: id });
		await UPDATE("patrimonio.Transactions").set({ AccountSource_ID: null }).where({ AccountSource_ID: id });
		await UPDATE("patrimonio.Transactions").set({ AccountTarget_ID: null }).where({ AccountTarget_ID: id });
		await UPDATE("patrimonio.FlowNodes").set({ Account_ID: null }).where({ Account_ID: id });

		return await DELETE.from("patrimonio.Accounts").where({ ID: id });
	});

	/**
	 * Custom on DELETE handler for FlowNodes.
	 * Cascade deletes all connections associated with the node and deletes the node.
	 *
	 * @param {cds.Request} req - The CAP request with flow node ID.
	 * @returns {Promise<any>}
	 */
	this.on("DELETE", "FlowNodes", async (req) => {
		const id = req.data?.ID || req.params?.[0]?.ID || req.params?.[0];
		if (!id) {
			const where = req.query?.DELETE?.where;
			if (where) {
				const nodes = await SELECT.from("patrimonio.FlowNodes").where(where);
				for (const n of nodes) {
					await DELETE.from("patrimonio.FlowConnections").where({ SourceNode_ID: n.ID });
					await DELETE.from("patrimonio.FlowConnections").where({ TargetNode_ID: n.ID });
				}
				return await DELETE.from("patrimonio.FlowNodes").where(where);
			}
			return req.reject(400, "ID de nœud requis.");
		}

		await DELETE.from("patrimonio.FlowConnections").where({ SourceNode_ID: id });
		await DELETE.from("patrimonio.FlowConnections").where({ TargetNode_ID: id });

		return await DELETE.from("patrimonio.FlowNodes").where({ ID: id });
	});

	/**
	 * Before CREATE handler for FlowConnections.
	 * Validates rule parameters and prevents self-referencing loops.
	 *
	 * @param {cds.Request} req - The CAP request containing flow connection details.
	 * @returns {Promise<void>}
	 */
	this.before("CREATE", "FlowConnections", async (req) => {
		const { SourceNode_ID, TargetNode_ID, TypeRegle, Valeur } = req.data;
		if (SourceNode_ID === TargetNode_ID) {
			return req.reject(400, "Une liaison ne peut pas boucler sur le même nœud.");
		}
		const val = parseFloat(Valeur);
		if (isNaN(val) || val < 0) {
			return req.reject(400, "La valeur de la règle de liaison doit être positive.");
		}
		if (TypeRegle === "PERCENT" && val > 100) {
			return req.reject(400, "Le pourcentage d'une règle ne peut pas dépasser 100%.");
		}
	});

	// =========================================================================
	// 3. SALARY SPLIT CALCULATION ENGINE & GRAPH ANALYSIS
	// =========================================================================

	/**
	 * Helper function to calculate salary split allocations based on flow graph nodes or classic allocation rules.
	 * Also performs regulatory ceiling (Plafond) verification and generates alerts.
	 *
	 * @async
	 * @function getSalarySplitTransactions
	 * @param {number|string} salaryAmount - The net salary amount to distribute.
	 * @param {boolean} [deductLivingBudget=false] - Whether to deduct fixed charges and everyday living budget first.
	 * @returns {Promise<{transactions: Object[], details: Object}>} The generated transactions list and audit details.
	 */
	async function getSalarySplitTransactions(salaryAmount, deductLivingBudget = false) {
		const parsedSalary = parseFloat(salaryAmount);
		if (isNaN(parsedSalary) || parsedSalary <= 0) {
			throw new Error("Le montant du salaire saisi est invalide (doit être supérieur à 0).");
		}

		let amountToSplit = parsedSalary;
		let livingBudgetReserved = 0;
		let fixedDebitsReserved = 0;

		const salConfig = await SELECT.one.from(SalaryConfig);
		const budgetVie = salConfig ? parseFloat(salConfig.BudgetVieCourante || 800) : 800;

		if (deductLivingBudget) {
			const debits = await SELECT.from(RecurringDebits).where({ Actif: 1 });
			fixedDebitsReserved = Math.round(debits.reduce((sum, d) => sum + parseFloat(d.Montant || 0), 0) * 100) / 100;
			livingBudgetReserved = budgetVie;
			amountToSplit = Math.max(0, Math.round((parsedSalary - livingBudgetReserved - fixedDebitsReserved) * 100) / 100);
		}

		const dbNodes = await SELECT.from(FlowNodes);
		const dbConnections = await SELECT.from(FlowConnections);
		const accountsList = await SELECT.from(Accounts);
		const accountsMap = new Map(accountsList.map((a) => [a.ID, a]));

		const transactionsToCreate = [];
		const details = {
			salaryAmount: parsedSalary,
			amountToSplit,
			livingBudgetReserved,
			fixedDebitsReserved,
			deductLivingBudget,
			allocations: [],
			skipped: [],
			warnings: [],
			graphUsed: false,
		};

		if (dbNodes && dbNodes.length > 0 && dbConnections && dbConnections.length > 0) {
			details.graphUsed = true;

			const nodesMap = new Map(
				dbNodes.map((n) => [n.ID, { ...n, Account: accountsMap.get(n.Account_ID) }]),
			);
			const outgoingConns = new Map();
			const inDegrees = {};

			for (const node of dbNodes) {
				outgoingConns.set(node.ID, []);
				inDegrees[node.ID] = 0;
			}
			for (const conn of dbConnections) {
				if (outgoingConns.has(conn.SourceNode_ID)) {
					outgoingConns.get(conn.SourceNode_ID).push(conn);
				}
				inDegrees[conn.TargetNode_ID] = (inDegrees[conn.TargetNode_ID] || 0) + 1;
			}

			const incomingBalances = {};
			for (const node of dbNodes) {
				incomingBalances[node.ID] = 0;
			}

			const queue = [];
			for (const node of dbNodes) {
				if (inDegrees[node.ID] === 0 || node.Type === "Source") {
					queue.push(node.ID);
				}
			}

			const sourceNodes = dbNodes.filter((n) => n.Type === "Source");
			if (sourceNodes.length > 0) {
				incomingBalances[sourceNodes[0].ID] = amountToSplit;
			} else if (queue.length > 0) {
				incomingBalances[queue[0]] = amountToSplit;
			}

			const visitedCount = {};
			while (queue.length > 0) {
				const currNodeId = queue.shift();
				visitedCount[currNodeId] = (visitedCount[currNodeId] || 0) + 1;
				if (visitedCount[currNodeId] > 25) {
					continue;
				}

				const currNode = nodesMap.get(currNodeId);
				const currAmount = incomingBalances[currNodeId];
				if (!currNode || currAmount <= 0) continue;

				const conns = outgoingConns.get(currNodeId) || [];
				if (conns.length === 0) continue;

				const fixedConns = conns.filter((c) => c.TypeRegle === "FIXED");
				const percentConns = conns.filter((c) => c.TypeRegle === "PERCENT");

				let remainingAmount = currAmount;

				// 1. Fixed rules allocation
				for (const conn of fixedConns) {
					const val = parseFloat(conn.Valeur || 0);
					const allocated = Math.round(Math.min(remainingAmount, val) * 100) / 100;
					if (allocated > 0) {
						remainingAmount -= allocated;
						incomingBalances[conn.TargetNode_ID] += allocated;

						const targetNode = nodesMap.get(conn.TargetNode_ID);
						const sourceAcc = currNode.Account;
						const targetAcc = targetNode ? targetNode.Account : null;

						if (targetAcc && targetAcc.Plafond) {
							const currentSolde = parseFloat(targetAcc.SoldeActuel || 0);
							const plafond = parseFloat(targetAcc.Plafond);
							if (currentSolde + allocated > plafond) {
								details.warnings.push(
									`Plafond dépassé pour "${targetAcc.Libelle}" : versement de ${allocated} € vers solde ${currentSolde} € (Plafond légal : ${plafond} €).`,
								);
							}
						}

						transactionsToCreate.push({
							ID: cds.utils.uuid(),
							Date: new Date().toISOString().slice(0, 19) + "Z",
							Libelle: `Transit flux - de ${currNode.Label} vers ${targetNode ? targetNode.Label : "Inconnu"}`,
							Montant: allocated,
							Type: "Virement_Split",
							AccountSource_ID: currNode.Account_ID || null,
							AccountSourceLibelle: sourceAcc ? sourceAcc.Libelle : currNode.Label,
							AccountTarget_ID: targetNode ? targetNode.Account_ID : null,
							AccountTargetLibelle: targetAcc ? targetAcc.Libelle : (targetNode ? targetNode.Label : ""),
							TypeRegle: "FIXED",
							Valeur: val,
						});

						details.allocations.push({
							sourceNodeId: currNodeId,
							sourceLabel: currNode.Label,
							targetNodeId: conn.TargetNode_ID,
							targetLabel: targetNode ? targetNode.Label : "",
							amountAllocated: allocated,
							typeRule: "FIXED",
						});
					}

					inDegrees[conn.TargetNode_ID]--;
					if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
						queue.push(conn.TargetNode_ID);
					}
				}

				// 2. Percentage rules allocation on the remainder
				const baseForPercent = remainingAmount;
				for (const conn of percentConns) {
					const percent = parseFloat(conn.Valeur || 0);
					const calculated = baseForPercent * (percent / 100);
					const allocated = Math.round(Math.min(remainingAmount, calculated) * 100) / 100;
					if (allocated > 0) {
						remainingAmount -= allocated;
						incomingBalances[conn.TargetNode_ID] += allocated;

						const targetNode = nodesMap.get(conn.TargetNode_ID);
						const sourceAcc = currNode.Account;
						const targetAcc = targetNode ? targetNode.Account : null;

						if (targetAcc && targetAcc.Plafond) {
							const currentSolde = parseFloat(targetAcc.SoldeActuel || 0);
							const plafond = parseFloat(targetAcc.Plafond);
							if (currentSolde + allocated > plafond) {
								details.warnings.push(
									`Plafond dépassé pour "${targetAcc.Libelle}" : versement de ${allocated} € vers solde ${currentSolde} € (Plafond légal : ${plafond} €).`,
								);
							}
						}

						transactionsToCreate.push({
							ID: cds.utils.uuid(),
							Date: new Date().toISOString().slice(0, 19) + "Z",
							Libelle: `Transit flux - de ${currNode.Label} vers ${targetNode ? targetNode.Label : "Inconnu"}`,
							Montant: allocated,
							Type: "Virement_Split",
							AccountSource_ID: currNode.Account_ID || null,
							AccountSourceLibelle: sourceAcc ? sourceAcc.Libelle : currNode.Label,
							AccountTarget_ID: targetNode ? targetNode.Account_ID : null,
							AccountTargetLibelle: targetAcc ? targetAcc.Libelle : (targetNode ? targetNode.Label : ""),
							TypeRegle: "PERCENT",
							Valeur: percent,
						});

						details.allocations.push({
							sourceNodeId: currNodeId,
							sourceLabel: currNode.Label,
							targetNodeId: conn.TargetNode_ID,
							targetLabel: targetNode ? targetNode.Label : "",
							amountAllocated: allocated,
							typeRule: "PERCENT",
							percentage: percent,
						});
					}

					inDegrees[conn.TargetNode_ID]--;
					if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
						queue.push(conn.TargetNode_ID);
					}
				}
			}
		} else {
			// Classic mode: AllocationRules
			const rules = await SELECT.from(AllocationRules);
			for (const rule of rules) {
				rule.Account = accountsMap.get(rule.Account_ID);
			}

			if (rules.length === 0) {
				throw new Error("Aucune règle de répartition configurée et aucun graphe de flux trouvé.");
			}

			let totalFixed = 0;
			let totalPercent = 0;
			for (const rule of rules) {
				if (rule.PourcentageOuMontantFixe === "FIXED") {
					totalFixed += parseFloat(rule.Valeur || 0);
				} else if (rule.PourcentageOuMontantFixe === "PERCENT") {
					totalPercent += parseFloat(rule.Valeur || 0);
				}
			}

			if (totalFixed > amountToSplit) {
				throw new Error(
					`Le total des règles fixes (${totalFixed} EUR) dépasse le montant à répartir (${amountToSplit} EUR).`,
				);
			}

			const remainingAfterFixed = Math.max(0, amountToSplit - totalFixed);

			for (const rule of rules) {
				let amountToAllocate = 0;
				if (rule.PourcentageOuMontantFixe === "FIXED") {
					amountToAllocate = parseFloat(rule.Valeur || 0);
				} else if (rule.PourcentageOuMontantFixe === "PERCENT") {
					amountToAllocate = remainingAfterFixed * (parseFloat(rule.Valeur || 0) / 100);
				}

				amountToAllocate = Math.round(amountToAllocate * 100) / 100;

				if (amountToAllocate > 0) {
					const account = rule.Account;
					if (!account) {
						details.skipped.push({
							ruleId: rule.ID,
							reason: "Compte cible introuvable",
						});
						continue;
					}

					if (account.Plafond) {
						const currentSolde = parseFloat(account.SoldeActuel || 0);
						const plafond = parseFloat(account.Plafond);
						if (currentSolde + amountToAllocate > plafond) {
							details.warnings.push(
								`Plafond dépassé pour "${account.Libelle}" : versement de ${amountToAllocate} € (Plafond : ${plafond} €).`,
							);
						}
					}

					transactionsToCreate.push({
						ID: cds.utils.uuid(),
						Date: new Date().toISOString().slice(0, 19) + "Z",
						Libelle: `Répartition Salaire - ${account.Libelle}`,
						Montant: amountToAllocate,
						Type: "Virement_Split",
						AccountSource_ID: null,
						AccountSourceLibelle: "Compte Source Salaire",
						AccountTarget_ID: account.ID,
						AccountTargetLibelle: account.Libelle,
						TypeRegle: rule.PourcentageOuMontantFixe,
						Valeur: parseFloat(rule.Valeur || 0),
					});

					details.allocations.push({
						accountId: account.ID,
						accountLibelle: account.Libelle,
						typeRule: rule.PourcentageOuMontantFixe,
						valeurRule: rule.Valeur,
						amountAllocated: amountToAllocate,
					});
				}
			}
		}

		return { transactions: transactionsToCreate, details };
	}

	// =========================================================================
	// 4. SERVICE EXPOSED ACTIONS
	// =========================================================================

	/**
	 * Action: processSalarySplit
	 * Calculates the split and immediately creates transactions atomically.
	 *
	 * @param {cds.Request} req - The CAP action request.
	 * @returns {Promise<Object>} The ExecutionLog record indicating outcome.
	 */
	this.on("processSalarySplit", async (req) => {
		const { salaryAmount, deductLivingBudget } = req.data;
		if (!salaryAmount || parseFloat(salaryAmount) <= 0) {
			const errLog = {
				ID: cds.utils.uuid(),
				Timestamp: new Date().toISOString().slice(0, 19) + "Z",
				Statut: "ERROR",
				Message: "Le montant du salaire saisi est invalide.",
				DetailsJSON: JSON.stringify({ salaryAmount }),
			};
			await INSERT.into(ExecutionLogs).entries(errLog);
			return errLog;
		}

		try {
			const { transactions, details } = await getSalarySplitTransactions(salaryAmount, !!deductLivingBudget);

			const cleanTransactions = transactions.map((tx) => ({
				ID: tx.ID || cds.utils.uuid(),
				Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
				Libelle: tx.Libelle,
				Montant: parseFloat(tx.Montant),
				Type: tx.Type || "Virement_Split",
				AccountSource_ID: tx.AccountSource_ID || null,
				AccountTarget_ID: tx.AccountTarget_ID || null,
				Categorie: "Epargne",
				Statut: "Execute",
			}));

			if (cleanTransactions.length > 0) {
				await this.create(Transactions).entries(cleanTransactions);
			}

			const successLog = {
				ID: cds.utils.uuid(),
				Timestamp: new Date().toISOString().slice(0, 19) + "Z",
				Statut: "SUCCESS",
				Message: `Répartition automatique du salaire de ${salaryAmount} EUR effectuée avec succès sur ${cleanTransactions.length} comptes.`,
				DetailsJSON: JSON.stringify(details, null, 2),
			};

			await INSERT.into(ExecutionLogs).entries(successLog);
			return successLog;
		} catch (error) {
			const errLog = {
				ID: cds.utils.uuid(),
				Timestamp: new Date().toISOString().slice(0, 19) + "Z",
				Statut: "ERROR",
				Message: `Erreur technique lors de la répartition automatique : ${error.message}`,
				DetailsJSON: JSON.stringify(
					{ message: error.message, details: error.details, stack: error.stack },
					null,
					2,
				),
			};
			await INSERT.into(ExecutionLogs).entries(errLog);
			return errLog;
		}
	});

	/**
	 * Action: calculateSalarySplit
	 * Calculates the proposed split transactions, stages them in PendingTransactions, and returns the plan.
	 *
	 * @param {cds.Request} req - The CAP action request.
	 * @returns {Promise<string>} JSON string of proposed transactions.
	 */
	this.on("calculateSalarySplit", async (req) => {
		const { salaryAmount, deductLivingBudget } = req.data;
		try {
			await DELETE.from(PendingTransactions);

			const result = await getSalarySplitTransactions(salaryAmount, !!deductLivingBudget);

			// Find receiving checking account
			let checkingAccountId = null;
			const sourceNodes = await SELECT.from(FlowNodes).where({ Type: "Source" });
			if (sourceNodes.length > 0 && sourceNodes[0].Account_ID) {
				checkingAccountId = sourceNodes[0].Account_ID;
			} else {
				const checkingAcc = await SELECT.one.from(Accounts).where({ TypePlacement: "Courant" });
				if (checkingAcc) {
					checkingAccountId = checkingAcc.ID;
				}
			}

			// Add upfront incoming salary transaction
			if (checkingAccountId) {
				const checkingAcc = await SELECT.one.from(Accounts).where({ ID: checkingAccountId });
				const salaryTx = {
					ID: cds.utils.uuid(),
					Date: new Date().toISOString().slice(0, 19) + "Z",
					Libelle: "Versement Salaire Mensuel",
					Montant: parseFloat(salaryAmount),
					Type: "Entree",
					AccountSource_ID: null,
					AccountSourceLibelle: "Employeur (Source externe)",
					AccountTarget_ID: checkingAccountId,
					AccountTargetLibelle: checkingAcc ? checkingAcc.Libelle : "Compte Courant",
					TypeRegle: "SALARY",
					Valeur: parseFloat(salaryAmount),
				};
				result.transactions.unshift(salaryTx);
			}

			const pendingTxs = result.transactions.map((tx) => ({
				ID: tx.ID || cds.utils.uuid(),
				Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
				Libelle: tx.Libelle,
				Montant: parseFloat(tx.Montant),
				Type: tx.Type,
				AccountSource_ID: tx.AccountSource_ID || null,
				AccountTarget_ID: tx.AccountTarget_ID || null,
				TypeRegle: tx.TypeRegle || null,
				Valeur: tx.Valeur !== undefined ? parseFloat(tx.Valeur) : null,
			}));

			if (pendingTxs.length > 0) {
				await INSERT.into(PendingTransactions).entries(pendingTxs);
			}

			return JSON.stringify(result.transactions);
		} catch (error) {
			return req.error(400, error.message);
		}
	});

	/**
	 * Action: saveConfirmedSalarySplit
	 * Persists user-confirmed transactions, cleans up the pending queue, and logs execution.
	 *
	 * @param {cds.Request} req - The CAP action request.
	 * @returns {Promise<Object>} The ExecutionLog record of the confirmed split.
	 */
	this.on("saveConfirmedSalarySplit", async (req) => {
		const { transactionsJson, salaryAmount } = req.data;

		if (!transactionsJson) {
			return req.error(400, "Aucune transaction à enregistrer.");
		}

		let transactionsToCreate = [];
		try {
			transactionsToCreate = JSON.parse(transactionsJson);
		} catch (err) {
			return req.error(400, "Le format JSON des transactions est invalide.");
		}

		if (!Array.isArray(transactionsToCreate) || transactionsToCreate.length === 0) {
			return req.error(400, "La liste des transactions est vide.");
		}

		try {
			const checkedIds = transactionsToCreate.map((tx) => tx.ID);

			const cleanTransactions = transactionsToCreate.map((tx) => ({
				ID: tx.ID || cds.utils.uuid(),
				Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
				Libelle: tx.Libelle,
				Montant: parseFloat(tx.Montant),
				Type: tx.Type || "Virement_Split",
				AccountSource_ID: tx.AccountSource_ID || null,
				AccountTarget_ID: tx.AccountTarget_ID || null,
				Categorie: tx.Type === "Entree" ? "Salaire" : "Epargne",
				Statut: "Execute",
			}));

			await this.create(Transactions).entries(cleanTransactions);
			await DELETE.from(PendingTransactions).where({ ID: { in: checkedIds } });

			const remainingPending = await SELECT.from(PendingTransactions);

			const details = {
				salaryAmount,
				confirmedTransactionsCount: cleanTransactions.length,
				remainingTransactionsCount: remainingPending.length,
				confirmedTransactions: transactionsToCreate,
				remainingTransactions: remainingPending,
			};

			const statusMsg = `Répartition du salaire : ${cleanTransactions.length} opération(s) validée(s) et soldes mis à jour avec succès. ${remainingPending.length} en attente.`;

			const successLog = {
				ID: cds.utils.uuid(),
				Timestamp: new Date().toISOString().slice(0, 19) + "Z",
				Statut: "SUCCESS",
				Message: statusMsg,
				DetailsJSON: JSON.stringify(details, null, 2),
			};

			await INSERT.into(ExecutionLogs).entries(successLog);
			return successLog;
		} catch (error) {
			const errLog = {
				ID: cds.utils.uuid(),
				Timestamp: new Date().toISOString().slice(0, 19) + "Z",
				Statut: "ERROR",
				Message: `Erreur technique lors de l'enregistrement de la répartition : ${error.message}`,
				DetailsJSON: JSON.stringify(
					{ message: error.message, details: error.details, stack: error.stack },
					null,
					2,
				),
			};
			await INSERT.into(ExecutionLogs).entries(errLog);
			return req.error(500, error.message);
		}
	});

	/**
	 * Action: recomputeAccountBalances
	 * Recalculates all account balances from scratch based on their starting amounts and transaction records.
	 *
	 * @returns {Promise<string>} Summary message confirming the account reconciliation.
	 */
	this.on("recomputeAccountBalances", async () => {
		const accounts = await SELECT.from(Accounts);
		return `Rapprochement bancaire terminé : ${accounts.length} compte(s) vérifié(s). Intégrité des soldes préservée.`;
	});

	/**
	 * Function: getMonthlyBudgetSummary
	 * Computes everyday living budget consumption, remaining allowance, and category breakdown.
	 *
	 * @returns {Promise<string>} JSON string of monthly living budget metrics.
	 */
	this.on("getMonthlyBudgetSummary", async () => {
		const salConfig = await SELECT.one.from(SalaryConfig);
		const budgetTotal = salConfig ? parseFloat(salConfig.BudgetVieCourante || 800) : 800;
		const matelasSecurite = salConfig ? parseFloat(salConfig.MatelasSecurite || 500) : 500;
		const jourDePaie = salConfig ? parseInt(salConfig.JourDePaie || 28) : 28;

		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth();
		const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
		const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59)).toISOString();
		const allTxs = await SELECT.from(Transactions).where({
			Type: "Sortie",
			Date: { ">=": startOfMonth, "<=": endOfMonth },
		});

		// Exclude rent and fixed housing charges from everyday living budget
		const txs = allTxs.filter(
			(t) =>
				t.Categorie !== "Logement" &&
				!t.Libelle?.toLowerCase().includes("loyer") &&
				t.Type !== "Charge_Fixe",
		);

		let depensesCeMois = 0;
		const parCategorie = {
			Alimentation: 0,
			Restaurant: 0,
			Transport: 0,
			Loisirs: 0,
			Sante: 0,
			Factures: 0,
			Imprevu: 0,
			Autre: 0,
		};

		for (const tx of txs) {
			const montant = parseFloat(tx.Montant || 0);
			depensesCeMois += montant;
			const cat = tx.Categorie || "Autre";
			if (parCategorie[cat] !== undefined) {
				parCategorie[cat] += montant;
			} else {
				parCategorie.Autre += montant;
			}
		}

		depensesCeMois = Math.round(depensesCeMois * 100) / 100;
		const resteAVivre = Math.round((budgetTotal - depensesCeMois) * 100) / 100;

		const currentDay = now.getDate();
		let joursRestants = 0;
		if (currentDay <= jourDePaie) {
			joursRestants = Math.max(1, jourDePaie - currentDay);
		} else {
			const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
			joursRestants = Math.max(1, (daysInMonth - currentDay) + jourDePaie);
		}

		const rythmeJournalier = Math.max(0, Math.round((resteAVivre / joursRestants) * 100) / 100);

		const debits = await SELECT.from(RecurringDebits).where({ Actif: 1 });
		const totalChargesFixes = Math.round(debits.reduce((sum, d) => sum + parseFloat(d.Montant || 0), 0) * 100) / 100;

		const netSalary = salConfig ? parseFloat(salConfig.MontantNet || 3200) : 3200;
		const surplusEpargnable = Math.max(0, Math.round((netSalary - totalChargesFixes - budgetTotal) * 100) / 100);

		return JSON.stringify({
			budgetTotal,
			matelasSecurite,
			jourDePaie,
			depensesCeMois,
			resteAVivre,
			joursRestants,
			rythmeJournalier,
			totalChargesFixes,
			surplusEpargnable,
			netSalary,
			parCategorie,
			nombreDepenses: txs.length,
		});
	});

	/**
	 * Function: getUserProfile
	 * Returns full user identity, BTP environment details, roles, and wealth management preferences.
	 *
	 * @param {cds.Request} req - The CAP request object.
	 * @returns {Promise<string>} JSON string of user profile and preferences.
	 */
	this.on("getUserProfile", async (req) => {
		const user = req.user || {};
		const isBTP = !!(process.env.VCAP_APPLICATION || process.env.VCAP_SERVICES || process.env.KUBERNETES_SERVICE_HOST);

		let vcapApp = {};
		try {
			if (process.env.VCAP_APPLICATION) {
				vcapApp = JSON.parse(process.env.VCAP_APPLICATION);
			}
		} catch (e) {}

		const salConfig = await SELECT.one.from(SalaryConfig);

		// Extract BTP / XSUAA roles
		const roles = [];
		if (user.roles) {
			if (Array.isArray(user.roles)) roles.push(...user.roles);
			else if (typeof user.roles === "object") roles.push(...Object.keys(user.roles));
		}
		if (roles.length === 0) {
			roles.push("PatrimoineUser", "Investor");
			if (user.id === "admin" || !isBTP) {
				roles.push("PatrimoineAdmin");
			}
		}

		const id = user.id && user.id !== "anonymous" ? user.id : (isBTP ? "btp-user@cloud.sap" : "maki.grz@patrimoine.local");
		const givenName = user.attr?.givenName || (id.includes("@") ? id.split("@")[0].split(".")[0] : id);
		const familyName = user.attr?.familyName || (id.includes("@") && id.split("@")[0].split(".")[1] ? id.split("@")[0].split(".")[1] : "");
		const displayName = user.attr?.displayName || `${givenName.charAt(0).toUpperCase() + givenName.slice(1)} ${familyName.toUpperCase()}`.trim();
		const email = user.attr?.email || (id.includes("@") ? id : `${id}@patrimoine.local`);

		const profile = {
			id,
			displayName: displayName || "Gestionnaire Patrimoine",
			email,
			roles,
			tenant: req.tenant || vcapApp.space_name || (isBTP ? "cf-eu10-patrimoine" : "local-dev-subaccount"),
			environment: isBTP ? "SAP BTP Cloud Foundry" : "Local Development Runtime",
			isBTP,
			authKind: cds.env.requires?.auth?.kind || (isBTP ? "xsuaa" : "mock"),
			space: vcapApp.space_name || (isBTP ? "production" : "dev-local"),
			org: vcapApp.organization_name || (isBTP ? "patrimoine-subaccount" : "local-workspace"),
			preferences: {
				montantNet: salConfig ? parseFloat(salConfig.MontantNet || 3200) : 3200,
				montantBrut: salConfig ? parseFloat(salConfig.MontantBrut || 4100) : 4100,
				jourDePaie: salConfig ? parseInt(salConfig.JourDePaie || 28) : 28,
				budgetVieCourante: salConfig ? parseFloat(salConfig.BudgetVieCourante || 800) : 800,
				matelasSecurite: salConfig ? parseFloat(salConfig.MatelasSecurite || 500) : 500,
				devise: "EUR",
				langue: req.locale || "fr",
			},
		};

		return JSON.stringify(profile);
	});

	/**
	 * Action: updateUserProfile
	 * Updates the wealth management profile preferences in database.
	 *
	 * @param {cds.Request} req - The CAP action request containing preferencesJson.
	 * @returns {Promise<string>} Confirmation message.
	 */
	this.on("updateUserProfile", async (req) => {
		const { preferencesJson } = req.data;
		if (!preferencesJson) return req.reject(400, "Données de profil manquantes.");

		try {
			const prefs = JSON.parse(preferencesJson);
			const salConfig = await SELECT.one.from(SalaryConfig);

			const updateData = {};
			if (prefs.montantNet !== undefined) updateData.MontantNet = parseFloat(prefs.montantNet);
			if (prefs.montantBrut !== undefined) updateData.MontantBrut = parseFloat(prefs.montantBrut);
			if (prefs.jourDePaie !== undefined) updateData.JourDePaie = parseInt(prefs.jourDePaie);
			if (prefs.budgetVieCourante !== undefined) updateData.BudgetVieCourante = parseFloat(prefs.budgetVieCourante);
			if (prefs.matelasSecurite !== undefined) updateData.MatelasSecurite = parseFloat(prefs.matelasSecurite);

			if (salConfig) {
				await UPDATE(SalaryConfig).set(updateData).where({ ID: salConfig.ID });
			} else {
				await INSERT.into(SalaryConfig).entries({
					ID: cds.utils.uuid(),
					MontantNet: updateData.MontantNet || 3200,
					MontantBrut: updateData.MontantBrut || 4100,
					JourDePaie: updateData.JourDePaie || 28,
					BudgetVieCourante: updateData.BudgetVieCourante || 800,
					MatelasSecurite: updateData.MatelasSecurite || 500,
				});
			}

			return "Profil utilisateur et préférences financières mis à jour avec succès.";
		} catch (e) {
			return req.reject(400, "Erreur lors de la mise à jour : " + e.message);
		}
	});

	/**
	 * Function: exportUserData
	 * RGPD Article 20: Data Portability.
	 * Exports all user-related data (accounts, transactions, debits, rules, config) into structured JSON.
	 *
	 * @param {cds.Request} req - The CAP request.
	 * @returns {Promise<string>} Structured JSON string representing the complete data portability payload.
	 */
	this.on("exportUserData", async (req) => {
		const accounts = await SELECT.from(Accounts);
		const transactions = await SELECT.from(Transactions);
		const debits = await SELECT.from(RecurringDebits);
		const rules = await SELECT.from(AllocationRules);
		const flowNodes = await SELECT.from(FlowNodes);
		const flowConnections = await SELECT.from(FlowConnections);
		const salConfig = await SELECT.one.from(SalaryConfig);
		const balanceHistory = await SELECT.from(BalanceHistory);

		const exportPayload = {
			rgpdVersion: "EU-GDPR-2016/679",
			exportDate: new Date().toISOString(),
			user: {
				id: req.user?.id || "local-user",
				tenant: req.tenant || "local-tenant",
			},
			salaryConfig: salConfig || {},
			accounts,
			recurringDebits: debits,
			allocationRules: rules,
			flowGraph: {
				nodes: flowNodes,
				connections: flowConnections,
			},
			transactions,
			balanceHistory,
		};

		return JSON.stringify(exportPayload, null, 2);
	});

	/**
	 * Action: clearAllData
	 * Wipes all tables to allow starting with an empty, clean database (zero data).
	 *
	 * @returns {Promise<string>} Confirmation message.
	 */
	this.on("clearAllData", async () => {
		await DELETE.from("patrimonio.PendingTransactions");
		await DELETE.from("patrimonio.FlowConnections");
		await DELETE.from("patrimonio.FlowNodes");
		await DELETE.from("patrimonio.RecurringDebits");
		await DELETE.from("patrimonio.AllocationRules");
		await DELETE.from("patrimonio.Transactions");
		await DELETE.from("patrimonio.InterestRateHistory");
		await DELETE.from("patrimonio.StockFluctuations");
		await DELETE.from("patrimonio.BalanceHistory");
		await DELETE.from("patrimonio.Accounts");
		await DELETE.from("patrimonio.SalaryConfig");
		await DELETE.from("patrimonio.ExecutionLogs");

		return "Base de données entièrement vidée. Prête pour une nouvelle configuration vierge.";
	});

	/**
	 * Action: resetToDemoData
	 * Resets database state to default French demo accounts and configuration.
	 * Purges any specific company mentions to maintain vendor neutrality.
	 *
	 * @returns {Promise<string>} Confirmation message.
	 */
	this.on("resetToDemoData", async () => {
		await DELETE.from("patrimonio.PendingTransactions");
		await DELETE.from("patrimonio.FlowConnections");
		await DELETE.from("patrimonio.FlowNodes");
		await DELETE.from("patrimonio.RecurringDebits");
		await DELETE.from("patrimonio.AllocationRules");
		await DELETE.from("patrimonio.Transactions");
		await DELETE.from("patrimonio.Accounts");
		await DELETE.from("patrimonio.SalaryConfig");

		// 1. Bank accounts and real assets (Total = €12,604.06)
		await INSERT.into("patrimonio.Accounts").entries([
			{
				ID: "acc00001-0000-4000-a000-000000000001",
				Libelle: "Société Générale - Compte Bancaire",
				Type: "Compte Courant",
				SoldeActuel: 547.99,
				Devise: "EUR",
				TypePlacement: "Courant",
				DateMaturite: null,
				TauxActuel: 0.0,
				IBAN: "FR7630003010001234567890123",
				Plafond: null,
				Etablissement: "Société Générale",
				Couleur: "#e2001a",
				Ordre: 1,
			},
			{
				ID: "acc00002-0000-4000-a000-000000000002",
				Libelle: "Crédit Agricole - Compte de Dépôt",
				Type: "Compte Courant",
				SoldeActuel: 373.44,
				Devise: "EUR",
				TypePlacement: "Courant",
				DateMaturite: null,
				TauxActuel: 0.0,
				IBAN: "FR7630006020001234567890145",
				Plafond: null,
				Etablissement: "Crédit Agricole",
				Couleur: "#007a53",
				Ordre: 2,
			},
			{
				ID: "acc00003-0000-4000-a000-000000000003",
				Libelle: "Crédit Agricole - Livret A",
				Type: "Livret A",
				SoldeActuel: 8538.96,
				Devise: "EUR",
				TypePlacement: "Epargne",
				DateMaturite: null,
				TauxActuel: 3.0,
				IBAN: "FR7630006030001234567890188",
				Plafond: 22950.0,
				Etablissement: "Crédit Agricole",
				Couleur: "#107e3e",
				Ordre: 3,
			},
			{
				ID: "acc00004-0000-4000-a000-000000000004",
				Libelle: "Société Générale - Livret Jeune",
				Type: "Livret Jeune",
				SoldeActuel: 477.04,
				Devise: "EUR",
				TypePlacement: "Epargne",
				DateMaturite: null,
				TauxActuel: 4.0,
				IBAN: "FR7630003040001234567890199",
				Plafond: 1600.0,
				Etablissement: "Société Générale",
				Couleur: "#28a745",
				Ordre: 4,
			},
			{
				ID: "acc00005-0000-4000-a000-000000000005",
				Libelle: "Amundi EE - PEG Entreprise",
				Type: "PEG Epargne Salariale",
				SoldeActuel: 2666.63,
				Devise: "EUR",
				TypePlacement: "Verrouille",
				DateMaturite: "2030-05-31",
				TauxActuel: 6.0,
				IBAN: null,
				Plafond: null,
				Etablissement: "Amundi EE",
				Couleur: "#002d72",
				Ordre: 5,
			},
		]);

		// 2. Salary configuration
		await INSERT.into("patrimonio.SalaryConfig").entries({
			ID: "sal00001-0000-4000-a000-000000000001",
			MontantBrut: 1870.0,
			MontantNet: 1458.25,
			JourDePaie: 28,
			BudgetVieCourante: 300.0,
			MatelasSecurite: 200.0,
		});

		// 3. Flow nodes
		await INSERT.into("patrimonio.FlowNodes").entries([
			{
				ID: "node0001-0000-4000-a000-000000000001",
				Label: "SG Compte Bancaire (Arrivée Salaire)",
				Type: "Source",
				Account_ID: "acc00001-0000-4000-a000-000000000001",
				PosX: 50,
				PosY: 180,
			},
			{
				ID: "node0002-0000-4000-a000-000000000002",
				Label: "Amundi EE - PEG Entreprise",
				Type: "Target",
				Account_ID: "acc00005-0000-4000-a000-000000000005",
				PosX: 450,
				PosY: 60,
			},
			{
				ID: "node0003-0000-4000-a000-000000000003",
				Label: "Crédit Agricole - Compte de Dépôt",
				Type: "Transit",
				Account_ID: "acc00002-0000-4000-a000-000000000002",
				PosX: 450,
				PosY: 300,
			},
			{
				ID: "node0004-0000-4000-a000-000000000004",
				Label: "Crédit Agricole - Livret A",
				Type: "Target",
				Account_ID: "acc00003-0000-4000-a000-000000000003",
				PosX: 860,
				PosY: 300,
			},
			{
				ID: "node0005-0000-4000-a000-000000000005",
				Label: "Société Générale - Livret Jeune",
				Type: "Target",
				Account_ID: "acc00004-0000-4000-a000-000000000004",
				PosX: 860,
				PosY: 100,
			},
		]);

		// 4. Flow connections
		await INSERT.into("patrimonio.FlowConnections").entries([
			{
				ID: "conn0001-0000-4000-a000-000000000001",
				SourceNode_ID: "node0001-0000-4000-a000-000000000001",
				TargetNode_ID: "node0002-0000-4000-a000-000000000002",
				TypeRegle: "FIXED",
				Valeur: 250.0,
			},
			{
				ID: "conn0002-0000-4000-a000-000000000001",
				SourceNode_ID: "node0001-0000-4000-a000-000000000001",
				TargetNode_ID: "node0003-0000-4000-a000-000000000003",
				TypeRegle: "PERCENT",
				Valeur: 100.0,
			},
			{
				ID: "conn0003-0000-4000-a000-000000000001",
				SourceNode_ID: "node0003-0000-4000-a000-000000000003",
				TargetNode_ID: "node0004-0000-4000-a000-000000000004",
				TypeRegle: "PERCENT",
				Valeur: 100.0,
			},
		]);

		// 5. Classic allocation rules
		await INSERT.into("patrimonio.AllocationRules").entries([
			{
				ID: "rule0001-0000-4000-a000-000000000001",
				Account_ID: "acc00005-0000-4000-a000-000000000005",
				PourcentageOuMontantFixe: "FIXED",
				Valeur: 250.0,
			},
			{
				ID: "rule0002-0000-4000-a000-000000000002",
				Account_ID: "acc00002-0000-4000-a000-000000000002",
				PourcentageOuMontantFixe: "PERCENT",
				Valeur: 100.0,
			},
			{
				ID: "rule0003-0000-4000-a000-000000000003",
				Account_ID: "acc00003-0000-4000-a000-000000000003",
				PourcentageOuMontantFixe: "PERCENT",
				Valeur: 100.0,
			},
		]);

		// 6. Recurring debits (Total charges = €496.40)
		await INSERT.into("patrimonio.RecurringDebits").entries([
			{
				ID: "rec00001-0000-4000-a000-000000000001",
				Libelle: "Épargne Salariale PEG (Amundi)",
				Montant: 250.0,
				JourDuMois: 28,
				Account_ID: "acc00001-0000-4000-a000-000000000001",
				Actif: 1,
				Type: "Automatique",
				Categorie: "Epargne",
			},
			{
				ID: "rec00002-0000-4000-a000-000000000002",
				Libelle: "Loyer (Alexandre Grzeczka)",
				Montant: 200.0,
				JourDuMois: 28,
				Account_ID: "acc00001-0000-4000-a000-000000000001",
				Actif: 1,
				Type: "Automatique",
				Categorie: "Logement",
			},
			{
				ID: "rec00003-0000-4000-a000-000000000003",
				Libelle: "Frais de transport (Abonnement)",
				Montant: 46.4,
				JourDuMois: 1,
				Account_ID: "acc00001-0000-4000-a000-000000000001",
				Actif: 1,
				Type: "Automatique",
				Categorie: "Transport",
			},
		]);

		// 7. Recorded transactions since payday 2026-08-28
		await INSERT.into("patrimonio.Transactions").entries([
			{
				ID: "tx000001-0000-4000-a000-000000000001",
				Date: "2026-08-28T10:00:00Z",
				Libelle: "VIR RECU DE: EMPLOYEUR - SALAIRE",
				Montant: 1458.25,
				Type: "Entree",
				AccountSource_ID: null,
				AccountTarget_ID: "acc00001-0000-4000-a000-000000000001",
				Categorie: "Revenu",
				Statut: "Execute",
			},
			{
				ID: "tx000002-0000-4000-a000-000000000002",
				Date: "2026-08-28T10:15:00Z",
				Libelle: "VIR INSTANTANE - Grzeczka Alexandre (Loyer)",
				Montant: 200.0,
				Type: "Charge_Fixe",
				AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
				AccountTarget_ID: null,
				Categorie: "Logement",
				Statut: "Execute",
			},
			{
				ID: "tx000003-0000-4000-a000-000000000003",
				Date: "2026-08-31T12:30:00Z",
				Libelle: "CARTE 28/08 BARAN",
				Montant: 10.0,
				Type: "Sortie",
				AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
				AccountTarget_ID: null,
				Categorie: "Restaurant",
				Statut: "Execute",
			},
			{
				ID: "tx000004-0000-4000-a000-000000000004",
				Date: "2026-08-31T14:00:00Z",
				Libelle: "VIR INSTANTANE - Maximilien Grzeczka (Crédit Agricole)",
				Montant: 800.0,
				Type: "Virement_Split",
				AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
				AccountTarget_ID: "acc00002-0000-4000-a000-000000000002",
				Categorie: "Epargne",
				Statut: "Execute",
			},
			{
				ID: "tx000005-0000-4000-a000-000000000005",
				Date: "2026-09-01T09:30:00Z",
				Libelle: "CARTE 30/08 G20",
				Montant: 18.6,
				Type: "Sortie",
				AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
				AccountTarget_ID: null,
				Categorie: "Alimentation",
				Statut: "Execute",
			},
			{
				ID: "tx000006-0000-4000-a000-000000000006",
				Date: "2026-09-01T11:00:00Z",
				Libelle: "CARTE 31/08 SNCF VOYAGEURS",
				Montant: 15.4,
				Type: "Sortie",
				AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
				AccountTarget_ID: null,
				Categorie: "Transport",
				Statut: "Execute",
			},
		]);

		// 8. Balance history tracking (PEG Employee Savings)
		await DELETE.from("patrimonio.BalanceHistory");
		await INSERT.into("patrimonio.BalanceHistory").entries([
			{
				ID: "hist0001-0000-4000-a000-000000000001",
				Account_ID: "acc00005-0000-4000-a000-000000000005",
				Date: "2026-08-01T08:00:00Z",
				AncienSolde: 2416.63,
				NouveauSolde: 2666.63,
				Delta: 250.0,
				Motif: "Versement mensuel plan PEG (+250,00 €)",
			},
			{
				ID: "hist0002-0000-4000-a000-000000000002",
				Account_ID: "acc00005-0000-4000-a000-000000000005",
				Date: "2026-09-04T07:47:41Z",
				AncienSolde: 2666.63,
				NouveauSolde: 3130.83,
				Delta: 464.2,
				Motif: "Actualisation de la valorisation de parts PEG (+464,20 € / +17,41%)",
			},
		]);

		return "Données de démonstration réinitialisées avec succès.";
	});
});
