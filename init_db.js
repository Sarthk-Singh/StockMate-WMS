require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const setupDB = async () => {
    try {
        console.log("Validating schemas...");
        
        // 1. Warehouses
        await pool.query(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                total_area NUMERIC,
                company_name VARCHAR(255)
            );
        `);
        // Note: Earlier tables were `warehouse`. Let's ensure compatibility.
        // Actually, the user explicitly asked for "warehouses: id, name, location, total_area". 
        // We will create the exact tables specified.

        // 2. Racks
        await pool.query(`
            CREATE TABLE IF NOT EXISTS racks (
                id SERIAL PRIMARY KEY,
                warehouse_id INT,
                rack_number VARCHAR(50)
            );
        `);

        // 3. Bins
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bins (
                id SERIAL PRIMARY KEY,
                rack_id INT,
                bin_number VARCHAR(50),
                max_capacity NUMERIC,
                used_space NUMERIC DEFAULT 0
            );
        `);

        // 4. Products
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                sku VARCHAR(100) UNIQUE,
                category VARCHAR(255),
                quantity INT DEFAULT 0,
                weight NUMERIC DEFAULT 0,
                size NUMERIC DEFAULT 0,
                priority VARCHAR(50),
                bin_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Alter existing table if missing columns
            ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100) UNIQUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS priority VARCHAR(50);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(255);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS size NUMERIC DEFAULT 0;
        `);

        // 5. Activity Log
        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                action VARCHAR(255),
                detail TEXT,
                user_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Database schema enforcement initialized.");
        process.exit(0);

    } catch(e) {
        console.error("DB Init Error: ", e);
        process.exit(1);
    }
};

setupDB();
