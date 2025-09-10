import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: '', // empty for trust auth
  port: process.env.DB_PORT,
});

export default pool;
