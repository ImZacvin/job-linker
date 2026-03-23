import { Pool } from 'pg'

console.log("DB URL:", process.env.DATABASE_URL ? "exists" : "MISSING!");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test the connection
pool.query('SELECT NOW()')
  .then(() => console.log("DB connected"))
  .catch(err => console.error("DB connection failed:", err.message));

export default pool;