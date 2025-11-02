import knex from "../db";
import { withCache, jitteredTTL } from "../cache";

// Minimal feed service: contains business logic for fetching a user's feed.
// Uses cursor-based pagination and Redis caching for performance.
export class FeedService {
  /**
   * Fetch feed items for a user with cursor-based pagination and caching.
   * If a `user_feed_view` exists, prefer it (pre-computed scores).
   */
  async getFeed(
    userId: number,
    options: {
      cursor?: string;
      limit?: number;
      region?: string;
      segment?: string;
      category?: string;
    }
  ) {
    console.log("check1");
    console.log("userId : ", userId);
    console.log("options : ", options);
    const { cursor, limit = 20, region, segment, category = "personalized" } = options;

    // Decode cursor (format: "timestamp|id" or "score|id")
    const [cursorValue, lastId] = cursor ? cursor.split("|") : [null, null];

    // Cache key includes all parameters that affect the results
    const cacheKey = `feed:${userId}:${limit}:${region || "*"}:${category}_${segment}:${
      cursor || "init"
    }`;
    console.log("check2");
    return withCache(cacheKey, 300, async () => {
      console.log("cache miss, computing feed from db");
      // 5 min cache with jitter
      // const hasView = await knex.schema.hasTable("user_feed_view");
      console.log("segment : ", segment);
      if (category === "personalized") {
        // Query materialized view with cursor-based pagination
        const query = knex("user_feed_view")
          .select(
            "item_id as id",
            "title",
            "segment",
            "region",
            "personalized_score as score",
            "ts"
          )
          .where("user_id", userId)
          .orderBy("personalized_score", "desc")
          .orderBy("item_id", "desc") // Secondary sort for stable pagination
          .limit(limit + 1); // Get one extra to determine if there's more

        if (region) {
          query.where("region", region);
        }
        if (segment) {
          query.where("segment", segment);
        }
        console.log("check4");
        if (cursorValue && lastId) {
          query.where(function () {
            this.where("personalized_score", "<", parseFloat(cursorValue)).orWhere(function () {
              this.where("personalized_score", "=", parseFloat(cursorValue)).andWhere(
                "item_id",
                "<",
                lastId
              );
            });
          });
        }
        console.log("final query : ", query);
        const rows = await query;
        console.log("rows : ", rows);
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit);

        // Generate next cursor if there are more items
        const nextCursor = hasMore
          ? `${items[items.length - 1].score}|${items[items.length - 1].id}`
          : null;

        return { items, nextCursor };
      }

      // Fallback or explicit global feed for the segment with timestamp-based cursor
      const query = knex("feed_items")
        .select("id", "title", "segment", "region", "popularity", "ts")
        .orderBy("ts", "desc")
        .orderBy("id", "desc") // Secondary sort for stable pagination
        .limit(limit + 1);

      if (region) {
        query.where("region", region);
      }

      if (cursorValue && lastId) {
        query.where(function () {
          this.where("ts", "<", new Date(cursorValue)).orWhere(function () {
            this.where("ts", "=", new Date(cursorValue)).andWhere("id", "<", lastId);
          });
        });
      }

      const rows = await query;
      console.log(rows);
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit);

      // Generate next cursor if there are more items
      const nextCursor = hasMore
        ? `${items[items.length - 1].ts.toISOString()}|${items[items.length - 1].id}`
        : null;

      return { items, nextCursor };
    });
  }
}
