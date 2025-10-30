import knexLib, { type Knex } from "knex";
import dotenv from "dotenv";

dotenv.config();

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

export const knex = knexLib(knexConfig);

export async function initSchema() {
  // create feed_items
  if (!(await knex.schema.hasTable("feed_items"))) {
    await knex.schema.createTable("feed_items", t => {
      t.string("id").primary();
      t.string("title").notNullable();
      t.bigInteger("ts").notNullable();
      t.integer("popularity").notNullable();
      t.string("category").notNullable();
      t.string("region").notNullable();
      t.text("meta");
    });
  }

  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", t => {
      t.string("id").primary();
      t.string("region").notNullable();
      t.text("pref_weights").notNullable();
    });
  }

  if (!(await knex.schema.hasTable("user_feed_view"))) {
    await knex.schema.createTable("user_feed_view", t => {
      t.string("user_id").notNullable();
      t.string("item_id").notNullable();
      t.float("personalized_score").notNullable();
      t.bigInteger("ts").notNullable();
      t.string("title").notNullable();
      t.string("category").notNullable();
      t.string("region").notNullable();
      t.integer("popularity").notNullable();
      t.text("meta");
      t.primary(["user_id", "item_id"]);
    });
  }

  // If an older version of the table exists with camelCase columns (userId/itemId),
  // rename them to snake_case so the rest of the code can assume snake_case.
  if (await knex.schema.hasTable("user_feed_view")) {
    const hasUserIdCamel = await knex.schema.hasColumn("user_feed_view", "userId");
    const hasItemIdCamel = await knex.schema.hasColumn("user_feed_view", "itemId");
    if (hasUserIdCamel || hasItemIdCamel) {
      await knex.schema.alterTable("user_feed_view", t => {
        if (hasUserIdCamel) t.renameColumn("userId", "user_id");
        if (hasItemIdCamel) t.renameColumn("itemId", "item_id");
      });
    }
  }
}

export default knex;
