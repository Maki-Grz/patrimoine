/**
 * @fileoverview Utility script to restore default French wealth demo accounts.
 * Run with: node srv/seed-demo.js or npm run db:seed
 */
const cds = require('@sap/cds');

async function seedDatabase() {
  try {
    await cds.connect.to('db');
    const srv = await cds.serve('PatrimoineService').from('srv/patrimoine-service');
    const msg = await srv.send('resetToDemoData');
    console.log(`✓ ${msg}`);
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de la réinitialisation de la base de données:', err);
    process.exit(1);
  }
}

seedDatabase();
