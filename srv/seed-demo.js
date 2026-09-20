/**
 * @fileoverview Utility script to restore default French wealth demo accounts and sample datasets.
 * Can be executed via: node srv/seed-demo.js or npm run db:seed.
 * 
 * @module seed-demo
 */

const cds = require("@sap/cds");

/**
 * Connects to the database and calls the resetToDemoData service action to restore demo records.
 *
 * @async
 * @function seedDatabase
 * @returns {Promise<void>} Resolves when the demo data has been successfully seeded.
 */
async function seedDatabase() {
	try {
		await cds.connect.to("db");
		const srv = await cds.serve("PatrimoineService").from("srv/patrimoine-service");
		const msg = await srv.send("resetToDemoData");
		console.log(`✓ ${msg}`);
		process.exit(0);
	} catch (err) {
		console.error("Error during database demo data initialization:", err);
		process.exit(1);
	}
}

seedDatabase();
