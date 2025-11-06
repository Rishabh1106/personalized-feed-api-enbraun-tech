import knex from "../db";
import { withCache, jitteredTTL } from "../cache";

/**
 * FeedService
 * Responsible for fetching user feed with cursor-based pagination and caching.
 */
export class FeedService {
  /**
   * Fetch feed items for a user.
   * Supports both personalized and global feeds, uses Redis caching via `withCache`.
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
    const startTime = Date.now();

    console.log(`[FeedService] Fetching feed`, {
      userId,
      options,
      timestamp: new Date().toISOString(),
    });

    try {
      const { cursor, limit = 20, region, segment, category = "personalized" } = options;

      // ---- Validation ----
      if (!userId || userId <= 0) {
        console.warn(`[FeedService] Invalid userId`, { userId });
        throw new Error("Invalid userId");
      }

      if (Number.isNaN(limit) || limit <= 0) {
        console.warn(`[FeedService] Invalid limit`, { limit });
        throw new Error("Limit must be a positive number");
      }

      // ---- Cursor Decode ----
      let cursorValue: string | null = null;
      let lastId: string | null = null;
      if (cursor) {
        const parts = cursor.split("|");
        if (parts.length === 2) {
          [cursorValue, lastId] = parts;
        } else {
          console.warn(`[FeedService] Invalid cursor format`, { cursor });
          throw new Error("Invalid cursor format. Expected 'value|id'");
        }
      }

      // ---- Cache Key ----
      const cacheKey = `feed:${userId}:${limit}:${region || "*"}:${category}_${segment || "none"}:${
        cursor || "init"
      }`;

      // ---- Main Logic with Caching ----
      return await withCache(cacheKey, jitteredTTL(300), async () => {
        console.log(`[FeedService] Cache miss, fetching from DB`, {
          cacheKey,
        });

        if (category === "personalized") {
          // Personalized feed: Query precomputed user_feed_view
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
            .modify(qb => {
              if (region) qb.where("region", region);
              if (segment) qb.where("segment", segment);
            })
            .orderBy("personalized_score", "desc")
            .orderBy("item_id", "desc")
            .limit(limit + 1);

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

          console.log(`[FeedService] Executing personalized feed query`, {
            userId,
            region,
            segment,
            cursor,
          });

          const rows = await query;
          const hasMore = rows.length > limit;
          const items = rows.slice(0, limit);
          const nextCursor = hasMore
            ? `${items[items.length - 1].score}|${items[items.length - 1].id}`
            : null;

          console.log(`[FeedService] Personalized feed fetched`, {
            userId,
            itemsFetched: items.length,
            nextCursor,
          });

          return { items, nextCursor };
        }

        // ---- Global Feed Fallback ----
        const query = knex("feed_items")
          .select("id", "title", "segment", "region", "popularity", "ts")
          .modify(qb => {
            if (region) qb.where("region", region);
            if (segment) qb.where("segment", segment);
          })
          .orderBy("ts", "desc")
          .orderBy("id", "desc")
          .limit(limit + 1);

        if (cursorValue && lastId) {
          const cursorTs = Number(cursorValue);
          query.where(function () {
            this.where("ts", "<", cursorTs).orWhere(function () {
              this.where("ts", "=", cursorTs).andWhere("id", "<", lastId);
            });
          });
        }

        console.log(`[FeedService] Executing global feed query`, {
          userId,
          region,
          cursor,
        });

        const rows = await query;
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit);
        const nextCursor = hasMore
          ? (() => {
              const lastItem = items[items.length - 1];
              const tsRaw = lastItem?.ts;
              // Convert ts to number safely
              const tsNum = Number(tsRaw);
              // Validate timestamp
              if (!tsNum || Number.isNaN(tsNum)) {
                console.error("[FeedService] Invalid ts for cursor:", tsRaw);
                return null;
              }
              return `${tsNum}|${lastItem.id}`;
            })()
          : null;

        console.log(`[FeedService] Global feed fetched`, {
          userId,
          itemsFetched: items.length,
          nextCursor,
        });

        return { items, nextCursor };
      });
    } catch (err: any) {
      console.error(`[FeedService] Feed fetch failed`, {
        userId,
        error: err.message,
        stack: err.stack,
      });
      throw new Error("Failed to fetch feed data");
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[FeedService] Feed request completed`, {
        userId,
        duration: `${duration}ms`,
      });
    }
  }
}
