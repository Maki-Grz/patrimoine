/**
 * @fileoverview Utility script to wipe all application data for clean zero-data deployment.
 * Can be executed via: node srv/clean-db.js or npm run db:clean.
 * 
 * @module clean-db
 */

const cds = require("@sap/cds");

/**
 * Connects to the database and calls the clearAllData service action to wipe all tables.
 *
 * @async
 * @function cleanDatabase
 * @returns {Promise<void>} Resolves when the database has been completely purged.
 */
async function cleanDatabase() {
	try {
		await cds.connect.to("db");
		const srv = await cds.serve("PatrimoineService").from("srv/patrimoine-service");
		const msg = await srv.send("clearAllData");
		console.log(`✓ ${msg}`);
		process.exit(0);
	} catch (err) {
		console.error("Error during database cleanup:", err);
		process.exit(1);
	}
}

cleanDatabase();
