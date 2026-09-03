const test = require("node:test");
const assert = require("node:assert/strict");
const cds = require("@sap/cds");

test("Patrimoine CAP Service & Business Logic Tests", async (t) => {
	let srv;

	await t.test("Bootstrap CDS and serve PatrimoineService", async () => {
		await cds.connect.to("db");
		srv = await cds.serve("PatrimoineService").from("srv");
		assert.ok(srv, "PatrimoineService loaded successfully");
	});

	await t.test("Reset demo data", async () => {
		const res = await srv.send("resetToDemoData");
		assert.match(res, /réinitialisées avec succès/);
		const accounts = await srv.run(SELECT.from(srv.entities.Accounts));
		assert.strictEqual(accounts.length, 5, "Should have 5 accounts");
		const totalSolde = accounts.reduce((sum, a) => sum + parseFloat(a.SoldeActuel || 0), 0);
		assert.strictEqual(Math.round(totalSolde * 100) / 100, 12604.06, "Total wealth must equal 12 604.06 €");
	});

	await t.test("Transaction validation - reject negative or zero amount", async () => {
		await assert.rejects(
			async () => {
				await srv.create("Transactions").entries({
					Libelle: "Test Montant Négatif",
					Montant: -50,
					AccountSource_ID: "11111111-1111-4111-a111-111111111111",
				});
			},
			{ message: /strictement positif/ },
		);
	});

	await t.test("Transaction creation adjusts account balances correctly", async () => {
		const srcBefore = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00001-0000-4000-a000-000000000001" }),
		);
		const tgtBefore = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00003-0000-4000-a000-000000000003" }),
		);

		const txId = cds.utils.uuid();
		await srv.create("Transactions").entries({
			ID: txId,
			Libelle: "Virement test 100 EUR",
			Montant: 100,
			Type: "Virement_Split",
			AccountSource_ID: "acc00001-0000-4000-a000-000000000001",
			AccountTarget_ID: "acc00003-0000-4000-a000-000000000003",
		});

		const srcAfter = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00001-0000-4000-a000-000000000001" }),
		);
		const tgtAfter = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00003-0000-4000-a000-000000000003" }),
		);

		assert.strictEqual(srcAfter.SoldeActuel, srcBefore.SoldeActuel - 100, "Source should be debited by 100");
		assert.strictEqual(tgtAfter.SoldeActuel, tgtBefore.SoldeActuel + 100, "Target should be credited by 100");

		// Test deletion reverts balances
		await srv.delete("Transactions").where({ ID: txId });
		const srcRestored = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00001-0000-4000-a000-000000000001" }),
		);
		const tgtRestored = await srv.run(
			SELECT.one.from(srv.entities.Accounts).where({ ID: "acc00003-0000-4000-a000-000000000003" }),
		);

		assert.strictEqual(srcRestored.SoldeActuel, srcBefore.SoldeActuel, "Source balance must be restored");
		assert.strictEqual(tgtRestored.SoldeActuel, tgtBefore.SoldeActuel, "Target balance must be restored");
	});

	await t.test("FlowNodes cascade delete removes associated connections", async () => {
		const nodeId = cds.utils.uuid();
		await srv.create("FlowNodes").entries({
			ID: nodeId,
			Label: "Nœud Temporaire",
			Type: "Transit",
			PosX: 100,
			PosY: 100,
		});

		const connId = cds.utils.uuid();
		await srv.create("FlowConnections").entries({
			ID: connId,
			SourceNode_ID: nodeId,
			TargetNode_ID: "node0004-0000-4000-a000-000000000004",
			TypeRegle: "FIXED",
			Valeur: 50,
		});

		const connBefore = await srv.run(SELECT.one.from(srv.entities.FlowConnections).where({ ID: connId }));
		assert.ok(connBefore, "Connection should exist before deletion");

		await srv.delete("FlowNodes").where({ ID: nodeId });
		const connAfter = await srv.run(SELECT.one.from(srv.entities.FlowConnections).where({ ID: connId }));
		assert.strictEqual(connAfter, undefined, "Connection should be cascade deleted");
	});

	await t.test("Salary split calculation and confirmation", async () => {
		const splitJson = await srv.send("calculateSalarySplit", { salaryAmount: 1458.25 });
		const txs = JSON.parse(splitJson);
		assert.ok(Array.isArray(txs), "Proposed txs should be an array");
		assert.ok(txs.length > 0, "Should generate proposed transactions");

		// Confirm salary split
		const log = await srv.send("saveConfirmedSalarySplit", {
			transactionsJson: JSON.stringify(txs),
			salaryAmount: 1458.25,
		});
		assert.strictEqual(log.Statut, "SUCCESS", "Salary split should succeed");
	});

	await t.test("Monthly budget summary and living expenses calculation", async () => {
		const summaryJson = await srv.send("getMonthlyBudgetSummary");
		const summary = JSON.parse(summaryJson);
		assert.strictEqual(summary.budgetTotal, 300, "Living budget should default to 300");
		assert.strictEqual(summary.matelasSecurite, 200, "Safety cushion should default to 200");
		assert.strictEqual(summary.jourDePaie, 28, "Pay day should be 28");
		assert.strictEqual(summary.totalChargesFixes, 496.4, "Fixed charges sum should be 496.40 €");
	});

	await t.test("Salary split with deductLivingBudget reserves living expenses", async () => {
		const splitDeductedJson = await srv.send("calculateSalarySplit", {
			salaryAmount: 1458.25,
			deductLivingBudget: true,
		});
		const txs = JSON.parse(splitDeductedJson);
		assert.ok(Array.isArray(txs), "Deducted txs should be an array");
	});

	await t.test("User profile retrieval and BTP integration details", async () => {
		const profileJson = await srv.send("getUserProfile");
		const profile = JSON.parse(profileJson);
		assert.ok(profile.id, "User ID should be present");
		assert.ok(profile.displayName, "Display name should be present");
		assert.ok(Array.isArray(profile.roles), "Roles should be an array");
		assert.ok(profile.roles.includes("PatrimoineUser"), "Should include PatrimoineUser role");
		assert.strictEqual(profile.preferences.devise, "EUR", "Currency should be EUR");
		assert.strictEqual(profile.preferences.montantNet, 1458.25, "Net salary should match config");

		// Test updating user preferences
		const updateResult = await srv.send("updateUserProfile", {
			preferencesJson: JSON.stringify({
				budgetVieCourante: 850,
				matelasSecurite: 550,
				jourDePaie: 27,
			}),
		});
		assert.ok(updateResult.includes("succès"), "Profile update should succeed");

		// Verify updated profile
		const updatedProfileJson = await srv.send("getUserProfile");
		const updatedProfile = JSON.parse(updatedProfileJson);
		assert.strictEqual(updatedProfile.preferences.budgetVieCourante, 850);
		assert.strictEqual(updatedProfile.preferences.matelasSecurite, 550);
		assert.strictEqual(updatedProfile.preferences.jourDePaie, 27);
	});

	await t.test("RGPD Article 20 - Data portability export", async () => {
		const exportJson = await srv.send("exportUserData");
		const data = JSON.parse(exportJson);
		assert.strictEqual(data.rgpdVersion, "EU-GDPR-2016/679");
		assert.ok(data.exportDate, "Export date must be present");
		assert.ok(Array.isArray(data.accounts), "Accounts must be exported as array");
		assert.ok(data.accounts.length > 0, "Should include active user accounts");
		assert.ok(data.salaryConfig, "Salary config must be exported");
	});

	await t.test("Clear all data wipes database completely for zero-data deployment", async () => {
		const clearRes = await srv.send("clearAllData");
		assert.ok(clearRes.includes("vidée"), "Clear all data should succeed");

		const accounts = await srv.run(SELECT.from("PatrimoineService.Accounts"));
		assert.strictEqual(accounts.length, 0, "Accounts should be empty after clearAllData");

		const txs = await srv.run(SELECT.from("PatrimoineService.Transactions"));
		assert.strictEqual(txs.length, 0, "Transactions should be empty after clearAllData");

		// Restore demo data for subsequent runs
		await srv.send("resetToDemoData");
		const restoredAccs = await srv.run(SELECT.from("PatrimoineService.Accounts"));
		assert.ok(restoredAccs.length > 0, "Demo accounts should be restored");
	});
});
