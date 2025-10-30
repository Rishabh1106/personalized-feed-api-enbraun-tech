import express from "express";
import knex, { initSchema } from "./db";
import { redis, withCache } from "./cache";
import { FeedItem } from "./types";
import base64url from "base64url";

initSchema();

const app = express();
app.use(express.json());

function encodeCursor(score: number, ts: number, id: string) {
  return base64url.encode(JSON.stringify({ score, ts, id }));
}

function decodeCursor(cursor: string) {
  try {
    return JSON.parse(base64url.decode(cursor));
  } catch (e) {
    return null;
  }
}

// build SQL and params for cursor based pagination on (score DESC, ts DESC, id DESC)
function cursorWhere(cursorObj: any, params: any[]) {
  if (!cursorObj) return ["", ""];
  params.push(cursorObj.score, cursorObj.ts, cursorObj.id);
  const sql = `(
    personalized_score < ? OR
    (personalized_score = ? AND ts < ?) OR
    (personalized_score = ? AND ts = ? AND item_id < ?)
  )`;
  // duplicate parameters appropriately
  // but easier: we'll use placeholders expanded manually below in query
  return [sql, params];
}

app.get("/v1/feed", async (req, res) => {
  const userid = String(req.query.userid || "");
  const region = String(req.query.region || "");
  const segment = String(req.query.segment || "personalized");
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  if (!userid) return res.status(400).json({ error: "userid required" });

  const cacheKey = `feed:${userid}:${region}:${segment}:limit=${limit}:cursor=${cursor || ""}`;
  try {
    const result = await withCache(cacheKey, 30, async () => {
      const cursorObj = cursor ? decodeCursor(cursor) : null;

      // base where (snake_case columns)
      let where = "user_id = ?";
      const params: any[] = [userid];
      if (region) {
        where += " AND region = ?";
        params.push(region);
      }

      // segment filters
      if (segment === "sports" || segment === "current_affairs") {
        where += " AND category = ?";
        params.push(segment);
      }

      // cursor handling
      let cursorClause = "";
      if (cursorObj) {
        // for simplicity use only three params in order matching SQL below
        cursorClause = ` AND (
          personalized_score < ? OR
          (personalized_score = ? AND ts < ?) OR
          (personalized_score = ? AND ts = ? AND item_id < ?)
        )`;
        params.push(
          cursorObj.score,
          cursorObj.score,
          cursorObj.ts,
          cursorObj.score,
          cursorObj.ts,
          cursorObj.id
        );
      }

      // ordering based on segment
      let order = "personalized_score DESC, ts DESC, item_id DESC";
      if (segment === "popular") order = "popularity DESC, ts DESC, item_id DESC";
      if (segment === "hot") order = "ts DESC, personalized_score DESC, item_id DESC";
      if (segment === "top10") order = "popularity DESC, ts DESC, item_id DESC";

      const sql = `SELECT item_id as id, title, ts, personalized_score, category, meta FROM user_feed_view WHERE ${where} ${cursorClause} ORDER BY ${order} LIMIT ?`;
      params.push(limit + 1);
      const raw = await knex.raw(sql, params);
      const rows = raw.rows || raw;
      const items = rows.slice(0, limit).map((r: any) => ({
        id: r.id,
        title: r.title,
        ts: Number(r.ts),
        personalized_score: Number(r.personalized_score),
        category: r.category,
        meta: r.meta ? JSON.parse(r.meta) : null,
      }));
      let nextCursor = null;
      if (rows.length > limit) {
        const last = rows[limit - 1];
        nextCursor = encodeCursor(last.personalized_score, last.ts, last.id);
      }
      return { items, nextCursor };
    });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "internal" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Feed API listening ${port}`));
