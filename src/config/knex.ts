import knexLib, { type Knex } from "knex";
import dotenv from "dotenv";

// Load .env into process.env (minimal, safe for local dev)
dotenv.config();

// Minimal Knex configuration file. Keeps DB connection details centralized.
const knexConfig: Knex.Config = {
  client: "pg",
  connection: {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "feeddb",
  },
  pool: { min: 2, max: 10 },
};

// Export a single configured knex instance for the app to import.
export const knex = knexLib(knexConfig);
export default knex;
