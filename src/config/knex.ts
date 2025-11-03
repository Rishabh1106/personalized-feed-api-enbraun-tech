import knexLib, { type Knex } from "knex";
import dotenv from "dotenv";

// Load .env into process.env (minimal, safe for local dev)
dotenv.config();

// Minimal Knex configuration file. Keeps DB connection details centralized.
const knexConfig: Knex.Config = {
  client: "pg",
  connection: {
    host: process.env.PG_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "feeddb",
  },
  pool: { min: 10, max: 50 },
};

// Export a single configured knex instance for the app to import.
export const knex = knexLib(knexConfig);
export default knex;
