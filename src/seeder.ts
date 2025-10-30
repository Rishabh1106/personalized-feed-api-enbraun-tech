import { v4 as uuidv4 } from "uuid";
import knex, { initSchema } from "./db";
import { User, FeedItem } from "./types";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nowMs() {
  return Date.now();
}

async function seed() {
  await initSchema();
  console.log("Initialized DB schema (ensured tables)");
  const regions = ["us", "eu", "in", "asia", "latam"];
  const categories = [
    "sports",
    "current_affairs",
    "technology",
    "entertainment",
    "top10",
    "general",
  ];

  const total = 5000;
  console.log("Seeding", total, "posts...");
  const now = nowMs();
  const batchSize = 500;
  for (let i = 0; i < total; i += batchSize) {
    const batch: any[] = [];
    for (let j = i; j < Math.min(i + batchSize, total); j++) {
      const id = uuidv4();
      const region = pick(regions);
      const category = pick(categories);
      const ts = now - randInt(0, 60 * 24 * 60 * 60 * 1000);
      const popularity = randInt(0, 10000);
      const title = `${category.toUpperCase()} Post ${j}`;
      const meta = JSON.stringify({ tags: [category, region], source: "seeder" });
      batch.push({ id, title, ts, popularity, category, region, meta });
    }
    await knex("feed_items").insert(batch);
  }

  console.log("Seeding users...");
  const users: User[] = [
    { id: "u1", region: "us", prefWeights: { sports: 0.6, technology: 0.2, current_affairs: 0.2 } },
    { id: "u2", region: "eu", prefWeights: { sports: 0.1, technology: 0.7, current_affairs: 0.2 } },
    { id: "u3", region: "in", prefWeights: { sports: 0.2, technology: 0.1, current_affairs: 0.7 } },
    {
      id: "u4",
      region: "asia",
      prefWeights: { sports: 0.4, technology: 0.4, current_affairs: 0.2 },
    },
    {
      id: "u5",
      region: "latam",
      prefWeights: { sports: 0.7, technology: 0.1, current_affairs: 0.2 },
    },
  ];

  for (const u of users) {
    await knex("users")
      .insert({ id: u.id, region: u.region, pref_weights: JSON.stringify(u.prefWeights) })
      .onConflict("id")
      .merge();
  }

  console.log("Materializing user_feed_view for users...");
  const items = await knex("feed_items").select("*");
  const maxPop = items.reduce((m: any, it: any) => Math.max(m, it.popularity), 0) || 1;

  // insert per user in batches
  for (const u of users) {
    const rows: any[] = [];
    const pref = u.prefWeights;
    for (const it of items) {
      const ageDays = Math.max(0, (now - it.ts) / (1000 * 60 * 60 * 24));
      const recencyScore = Math.exp(-ageDays / 7);
      const popScore = it.popularity / maxPop;
      const prefWeight = pref[it.category] ?? 0.1;
      const personalized_score = 0.5 * recencyScore + 0.35 * popScore + 0.15 * prefWeight;
      rows.push({
        user_id: u.id,
        item_id: it.id,
        personalized_score,
        ts: it.ts,
        title: it.title,
        category: it.category,
        region: it.region,
        popularity: it.popularity,
        meta: it.meta,
      });
      if (rows.length >= 1000) {
        await knex("user_feed_view").insert(rows).onConflict(["user_id", "item_id"]).merge();
        rows.length = 0;
      }
    }
    if (rows.length)
      await knex("user_feed_view").insert(rows).onConflict(["userId", "itemId"]).merge();
  }

  console.log("Seed complete.");
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
