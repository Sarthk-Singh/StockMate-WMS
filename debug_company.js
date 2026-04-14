// Run: node debug_company.js
// Shows what company_names are stored in warehouse and users tables
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function run() {
    console.log('\n=== USERS TABLE ===');
    try {
        const u = await pool.query('SELECT user_id, name, email, company_name FROM users LIMIT 10');
        u.rows.forEach(r => console.log(`  [${r.user_id}] ${r.name} | email: ${r.email} | company: "${r.company_name}"`));
    } catch(e) { console.log('Error:', e.message); }

    console.log('\n=== WAREHOUSE TABLE ===');
    try {
        const w = await pool.query('SELECT warehouse_id, name, company_name FROM warehouse LIMIT 20');
        if (w.rows.length === 0) console.log('  (no warehouses found)');
        w.rows.forEach(r => console.log(`  [${r.warehouse_id}] "${r.name}" | company: "${r.company_name}"`));
    } catch(e) { console.log('Error:', e.message); }

    console.log('\n=== RACKS TABLE ===');
    try {
        const r = await pool.query('SELECT rack_id, warehouse_id, name FROM racks LIMIT 10');
        if (r.rows.length === 0) console.log('  (no racks found)');
        r.rows.forEach(r => console.log(`  [rack ${r.rack_id}] warehouse_id=${r.warehouse_id} | name="${r.name}"`));
    } catch(e) { console.log('Error:', e.message); }

    console.log('\n=== BINS TABLE ===');
    try {
        const b = await pool.query('SELECT bin_id, rack_id, warehouse_id, capacity, current_load FROM bins LIMIT 10');
        if (b.rows.length === 0) console.log('  (no bins found)');
        b.rows.forEach(r => console.log(`  [bin ${r.bin_id}] rack_id=${r.rack_id} wh_id=${r.warehouse_id} cap=${r.capacity} load=${r.current_load}`));
    } catch(e) { console.log('Error:', e.message); }

    console.log('\n=== PRODUCTS TABLE ===');
    try {
        const p = await pool.query('SELECT product_id, name, sku, bin_id, quantity FROM products LIMIT 10');
        if (p.rows.length === 0) console.log('  (no products found)');
        p.rows.forEach(r => console.log(`  [${r.product_id}] "${r.name}" sku="${r.sku}" bin_id=${r.bin_id} qty=${r.quantity}`));
    } catch(e) { console.log('Error:', e.message); }

    pool.end();
}

run();
