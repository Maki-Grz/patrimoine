const cds = require("@sap/cds");

/**
 * SAP CAP Service Implementation for PatrimoineService.
 * Handles database triggers, validations, and custom OData actions for salary splitting and account lifecycle.
 *
 * @param {import("@sap/cds/apis/services").Service} this - The CDS service instance.
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
	} = this.entities;

	/**
	 * After-create trigger on Transactions.
	 * Automatically updates the balance (SoldeActuel) of the source and target accounts.
	 *
	 * @param {Object|Object[]} txData - The transaction(s) created.
	 * @returns {Promise<void>}
	 */
	this.after("CREATE", "Transactions", async (txData) => {
		const txs = Array.isArray(txData) ? txData : [txData];
		for (const transaction of txs) {
			const { Montant, AccountSource_ID, AccountTarget_ID } = transaction;
			const amount = parseFloat(Montant || 0);

			if (AccountSource_ID) {
				const acc = await SELECT.one
					.from(Accounts)
					.where({ ID: AccountSource_ID });
				if (acc) {
					const newSolde = parseFloat(acc.SoldeActuel || 0) - amount;
					await UPDATE(Accounts)
						.set({ SoldeActuel: newSolde })
						.where({ ID: AccountSource_ID });
				}
			}

			if (AccountTarget_ID) {
				const acc = await SELECT.one
					.from(Accounts)
					.where({ ID: AccountTarget_ID });
				if (acc) {
					const newSolde = parseFloat(acc.SoldeActuel || 0) + amount;
					await UPDATE(Accounts)
						.set({ SoldeActuel: newSolde })
						.where({ ID: AccountTarget_ID });
				}
			}
		}
	});

	/**
	 * Before-delete trigger on Accounts.
	 * Cleans up all associated allocation rules, recurring debits, and disconnects transaction relationships.
	 *
	 * @param {import("@sap/cds/apis/services").Request} req - The CDS request object.
	 * @returns {Promise<void>}
	 */
	this.before("DELETE", "Accounts", async (req) => {
		const id = req.data.ID;
		if (!id) return;

		await DELETE.from(AllocationRules).where({ Account_ID: id });

		const { RecurringDebits } = this.entities;
		await DELETE.from(RecurringDebits).where({ Account_ID: id });

		await UPDATE(Transactions)
			.set({ AccountSource_ID: null })
			.where({ AccountSource_ID: id });
		await UPDATE(Transactions)
			.set({ AccountTarget_ID: null })
			.where({ AccountTarget_ID: id });
	});

	/**
	 * Helper function to calculate salary split allocations based on flow graph nodes or classic allocation rules.
	 *
	 * @param {number} salaryAmount - The net salary amount to be split.
	 * @returns {Promise<{transactions: Object[], details: Object}>} The list of proposed transactions and calculation metadata.
	 * @throws {Error} If salary is invalid or if no split configuration (rules or graph) is defined.
	 */
	async function getSalarySplitTransactions(salaryAmount) {
		if (!salaryAmount || salaryAmount <= 0) {
			throw new Error("Le montant du salaire saisi est invalide.");
		}

		const dbNodes = await SELECT.from(FlowNodes);
		const dbConnections = await SELECT.from(FlowConnections);
		const accountsList = await SELECT.from(Accounts);
		const accountsMap = new Map(accountsList.map((a) => [a.ID, a]));

		const transactionsToCreate = [];
		const details = {
			salaryAmount,
			allocations: [],
			skipped: [],
			graphUsed: false,
		};

		if (
			dbNodes &&
			dbNodes.length > 0 &&
			dbConnections &&
			dbConnections.length > 0
		) {
			details.graphUsed = true;

			const nodesMap = new Map(
				dbNodes.map((n) => [
					n.ID,
					{ ...n, Account: accountsMap.get(n.Account_ID) },
				]),
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
				inDegrees[conn.TargetNode_ID] =
					(inDegrees[conn.TargetNode_ID] || 0) + 1;
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
				incomingBalances[sourceNodes[0].ID] = salaryAmount;
			} else if (queue.length > 0) {
				incomingBalances[queue[0]] = salaryAmount;
			}

			const visitedCount = {};
			while (queue.length > 0) {
				const currNodeId = queue.shift();
				visitedCount[currNodeId] = (visitedCount[currNodeId] || 0) + 1;
				if (visitedCount[currNodeId] > 20) {
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

				for (const conn of fixedConns) {
					const val = parseFloat(conn.Valeur || 0);
					const allocated =
						Math.round(Math.min(remainingAmount, val) * 100) / 100;
					if (allocated > 0) {
						remainingAmount -= allocated;
						incomingBalances[conn.TargetNode_ID] += allocated;

						const targetNode = nodesMap.get(conn.TargetNode_ID);
						if (currNode.Account_ID || targetNode.Account_ID) {
							const sourceAcc = currNode.Account;
							const targetAcc = targetNode ? targetNode.Account : null;
							transactionsToCreate.push({
								ID: cds.utils.uuid(),
								Date: new Date().toISOString().slice(0, 19) + "Z",
								Libelle: `Transit flux - de ${currNode.Label} vers ${targetNode.Label}`,
								Montant: allocated,
								Type: "Virement_Split",
								AccountSource_ID: currNode.Account_ID || null,
								AccountSourceLibelle: sourceAcc
									? sourceAcc.Libelle
									: currNode.Label,
								AccountTarget_ID: targetNode.Account_ID || null,
								AccountTargetLibelle: targetAcc
									? targetAcc.Libelle
									: targetNode.Label,
								TypeRegle: "FIXED",
								Valeur: val,
							});
						}

						details.allocations.push({
							sourceNodeId: currNodeId,
							sourceLabel: currNode.Label,
							targetNodeId: conn.TargetNode_ID,
							targetLabel: targetNode.Label,
							amountAllocated: allocated,
							typeRule: "FIXED",
						});
					}

					inDegrees[conn.TargetNode_ID]--;
					if (inDegrees[conn.TargetNode_ID] <= 0) {
						if (!queue.includes(conn.TargetNode_ID)) {
							queue.push(conn.TargetNode_ID);
						}
					}
				}

				const totalPercentSource = currAmount;
				for (const conn of percentConns) {
					const percent = parseFloat(conn.Valeur || 0);
					const val = totalPercentSource * (percent / 100);
					const allocated =
						Math.round(Math.min(remainingAmount, val) * 100) / 100;
					if (allocated > 0) {
						remainingAmount -= allocated;
						incomingBalances[conn.TargetNode_ID] += allocated;

						const targetNode = nodesMap.get(conn.TargetNode_ID);
						if (currNode.Account_ID || targetNode.Account_ID) {
							const sourceAcc = currNode.Account;
							const targetAcc = targetNode ? targetNode.Account : null;
							transactionsToCreate.push({
								ID: cds.utils.uuid(),
								Date: new Date().toISOString().slice(0, 19) + "Z",
								Libelle: `Transit flux - de ${currNode.Label} vers ${targetNode.Label}`,
								Montant: allocated,
								Type: "Virement_Split",
								AccountSource_ID: currNode.Account_ID || null,
								AccountSourceLibelle: sourceAcc
									? sourceAcc.Libelle
									: currNode.Label,
								AccountTarget_ID: targetNode.Account_ID || null,
								AccountTargetLibelle: targetAcc
									? targetAcc.Libelle
									: targetNode.Label,
								TypeRegle: "PERCENT",
								Valeur: percent,
							});
						}

						details.allocations.push({
							sourceNodeId: currNodeId,
							sourceLabel: currNode.Label,
							targetNodeId: conn.TargetNode_ID,
							targetLabel: targetNode.Label,
							amountAllocated: allocated,
							typeRule: "PERCENT",
							percentage: percent,
						});
					}

					inDegrees[conn.TargetNode_ID]--;
					if (inDegrees[conn.TargetNode_ID] <= 0) {
						if (!queue.includes(conn.TargetNode_ID)) {
							queue.push(conn.TargetNode_ID);
						}
					}
				}
			}
		} else {
			const rules = await SELECT.from(AllocationRules);
			for (const rule of rules) {
				rule.Account = accountsMap.get(rule.Account_ID);
			}

			if (rules.length === 0) {
				throw new Error(
					"Aucune règle de répartition configurée et aucun graphe de flux trouvé.",
				);
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

			if (totalFixed > salaryAmount) {
				throw new Error(
					`Le total des règles fixes (${totalFixed} EUR) dépasse le montant du salaire (${salaryAmount} EUR).`,
				);
			}

			for (const rule of rules) {
				let amountToAllocate = 0;
				if (rule.PourcentageOuMontantFixe === "FIXED") {
					amountToAllocate = parseFloat(rule.Valeur || 0);
				} else if (rule.PourcentageOuMontantFixe === "PERCENT") {
					amountToAllocate =
						salaryAmount * (parseFloat(rule.Valeur || 0) / 100);
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

					transactionsToCreate.push({
						ID: cds.utils.uuid(),
						Date: new Date().toISOString().slice(0, 19) + "Z",
						Libelle: `Répartition Salaire - ${account.Libelle}`,
						Montant: amountToAllocate,
						Type: "Virement_Split",
						AccountSource_ID: null,
						AccountSourceLibelle: "Salaire Entrant",
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

	/**
	 * Action handler for processSalarySplit.
	 * Calculates the split and immediately persists all transactions to the database.
	 *
	 * @param {import("@sap/cds/apis/services").Request} req - The CDS request containing salaryAmount.
	 * @returns {Promise<Object>} The execution log representing success or failure.
	 */
	this.on("processSalarySplit", async (req) => {
		const { salaryAmount } = req.data;

		if (!salaryAmount || salaryAmount <= 0) {
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
			const { transactions, details } =
				await getSalarySplitTransactions(salaryAmount);

			const cleanTransactions = transactions.map((tx) => {
				return {
					ID: tx.ID || cds.utils.uuid(),
					Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
					Libelle: tx.Libelle,
					Montant: tx.Montant,
					Type: tx.Type,
					AccountSource_ID: tx.AccountSource_ID,
					AccountTarget_ID: tx.AccountTarget_ID,
				};
			});

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
					{
						message: error.message,
						details: error.details,
						stack: error.stack,
					},
					null,
					2,
				),
			};
			await INSERT.into(ExecutionLogs).entries(errLog);
			return errLog;
		}
	});

	/**
	 * Action handler for calculateSalarySplit.
	 * Calculates the proposed split transactions, clears previous temporary pending transactions,
	 * inserts the new ones, and returns them as a JSON string.
	 *
	 * @param {import("@sap/cds/apis/services").Request} req - The CDS request containing salaryAmount.
	 * @returns {Promise<string>} JSON string of the proposed transactions.
	 */
	this.on("calculateSalarySplit", async (req) => {
		const { salaryAmount } = req.data;
		try {
			await DELETE.from(PendingTransactions);

			const result = await getSalarySplitTransactions(salaryAmount);

			// Determine main checking account to credit the salary
			let checkingAccountId = null;
			const sourceNodes = await SELECT.from(FlowNodes).where({ Type: "Source" });
			if (sourceNodes.length > 0 && sourceNodes[0].Account_ID) {
				checkingAccountId = sourceNodes[0].Account_ID;
			} else {
				const checkingAcc = await SELECT.one.from(Accounts).where({ Type: "Courant" });
				if (checkingAcc) {
					checkingAccountId = checkingAcc.ID;
				}
			}

			// Prepend the salary deposit transaction itself
			if (checkingAccountId) {
				const checkingAcc = await SELECT.one.from(Accounts).where({ ID: checkingAccountId });
				const salaryTx = {
					ID: cds.utils.uuid(),
					Date: new Date().toISOString().slice(0, 19) + "Z",
					Libelle: `Versement Salaire Mensuel`,
					Montant: parseFloat(salaryAmount),
					Type: "Entree",
					AccountSource_ID: null,
					AccountSourceLibelle: "Source externe",
					AccountTarget_ID: checkingAccountId,
					AccountTargetLibelle: checkingAcc ? checkingAcc.Libelle : "Compte Courant",
					TypeRegle: "SALARY",
					Valeur: parseFloat(salaryAmount),
				};
				result.transactions.unshift(salaryTx);
			}

			const pendingTxs = result.transactions.map((tx) => {
				return {
					ID: tx.ID || cds.utils.uuid(),
					Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
					Libelle: tx.Libelle,
					Montant: tx.Montant,
					Type: tx.Type,
					AccountSource_ID: tx.AccountSource_ID || null,
					AccountTarget_ID: tx.AccountTarget_ID || null,
					TypeRegle: tx.TypeRegle || null,
					Valeur: tx.Valeur || null,
				};
			});

			if (pendingTxs.length > 0) {
				await INSERT.into(PendingTransactions).entries(pendingTxs);
			}

			return JSON.stringify(result.transactions);
		} catch (error) {
			return req.error(400, error.message);
		}
	});

	/**
	 * Action handler for saveConfirmedSalarySplit.
	 * Receives a set of user-confirmed transactions, saves them as real transactions,
	 * and clears them from the pending transaction queue.
	 *
	 * @param {import("@sap/cds/apis/services").Request} req - The CDS request containing transactionsJson and salaryAmount.
	 * @returns {Promise<Object>} Execution log of the save operation.
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
			return req.error(400, "Le JSON des transactions est invalide.");
		}

		if (transactionsToCreate.length === 0) {
			return req.error(400, "La liste des transactions est vide.");
		}

		try {
			const checkedIds = transactionsToCreate.map((tx) => tx.ID);

			const cleanTransactions = transactionsToCreate.map((tx) => {
				return {
					ID: tx.ID || cds.utils.uuid(),
					Date: tx.Date || new Date().toISOString().slice(0, 19) + "Z",
					Libelle: tx.Libelle,
					Montant: parseFloat(tx.Montant),
					Type: tx.Type || "Virement_Split",
					AccountSource_ID: tx.AccountSource_ID || null,
					AccountTarget_ID: tx.AccountTarget_ID || null,
				};
			});

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

			const statusMsg = `Répartition manuelle du salaire : ${cleanTransactions.length} virement(s) enregistré(s) avec succès. ${remainingPending.length} virement(s) restant(s) en attente.`;

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
					{
						message: error.message,
						details: error.details,
						stack: error.stack,
					},
					null,
					2,
				),
			};
			await INSERT.into(ExecutionLogs).entries(errLog);
			return req.error(500, error.message);
		}
	});
});
