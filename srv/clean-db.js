/**
 * @fileoverview Utility script to wipe all application data for clean deployment.
 * Run with: node srv/clean-db.js or npm run db:clean
 */
const cds = require('@sap/cds');

async function cleanDatabase() {
  try {
    await cds.connect.to('db');
    const srv = await cds.serve('PatrimoineService').from('srv/patrimoine-service');
    const msg = await srv.send('clearAllData');
    console.log(`✓ ${msg}`);
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de la purge de la base de données:', err);
    process.exit(1);
  }
}

cleanDatabase();
