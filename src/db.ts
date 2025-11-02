import knex from "./config/knex";

// db.ts: application-level helpers and schema initialization.
// Uses the shared `knex` instance from `src/config/knex.ts`.
export async function initSchema() {
  // create feed_items
  if (!(await knex.schema.hasTable("feed_items"))) {
    await knex.schema.createTable("feed_items", t => {
      t.increments("id").primary();
      t.string("title").notNullable();
      t.bigInteger("ts").notNullable();
      t.integer("popularity").notNullable().defaultTo(0);
      t.string("category").notNullable();
      t.string("region").notNullable();
      t.jsonb("meta");
    });
  }

  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", t => {
      t.increments("id").primary();
      t.string("region").notNullable();
      t.jsonb("preferences").notNullable().defaultTo("{}");
    });
  }

  if (!(await knex.schema.hasTable("user_feed_view"))) {
    await knex.schema.createTable("user_feed_view", t => {
      t.integer("user_id").notNullable();
      t.integer("item_id").notNullable();
      t.float("personalized_score").notNullable();
      t.bigInteger("ts").notNullable();
      t.string("title").notNullable();
      t.string("category").notNullable();
      t.string("region").notNullable();
      t.integer("popularity").notNullable().defaultTo(0);
      t.jsonb("meta");
      t.primary(["user_id", "item_id"]);
    });
  }

  // Normalize any old camelCase column names if present.
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
