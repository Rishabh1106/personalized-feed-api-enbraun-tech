import { Request, Response } from "express";
import { FeedService } from "../services/feed.service";

const service = new FeedService();

/**
 * Controller: Handles fetching feed items with cursor-based pagination.
 * Includes validation, structured logs, and response time metrics.
 */
export const getFeed = async (req: Request, res: Response) => {
  const startTime = Date.now();

  console.log(`[FeedController] Incoming request`, {
    query: req.query,
    timestamp: new Date().toISOString(),
  });

  try {
    // ---- Query Param Parsing & Validation ----
    const userId = Number(req.query.userid);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const region = req.query.region ? String(req.query.region) : undefined;
    const segment = req.query.segment ? String(req.query.segment) : undefined;
    const category = req.query.category === "global" ? "global" : "personalized";

    if (Number.isNaN(userId) || userId <= 0) {
      console.warn(`[FeedController] Invalid or missing userId`, {
        userId: req.query.userid,
      });
      return res.status(400).json({ error: "Valid userId is required" });
    }

    if (Number.isNaN(limit) || limit <= 0) {
      console.warn(`[FeedController] Invalid limit value`, {
        limit: req.query.limit,
      });
      return res.status(400).json({ error: "Limit must be a positive number" });
    }

    const finalLimit = Math.min(limit, 100);

    // ---- Feed Service Invocation ----
    const result = await service.getFeed(userId, {
      cursor,
      limit: finalLimit,
      region,
      segment,
      category,
    });

    // ---- Response Construction ----
    const responseTime = Date.now() - startTime;
    res.setHeader("X-Response-Time", `${responseTime}ms`);

    console.log(`[FeedController] Feed fetched successfully`, {
      userId,
      region,
      segment,
      category,
      itemsFetched: result.items.length,
      nextCursor: result.nextCursor,
      responseTime: `${responseTime}ms`,
    });

    return res.json({
      data: result.items,
      pagination: {
        nextCursor: result.nextCursor,
        limit: finalLimit,
      },
      meta: { responseTime },
    });
  } catch (err: any) {
    console.error(`[FeedController] Feed fetch error`, {
      message: err?.message,
      stack: err?.stack,
      query: req.query,
    });

    return res.status(500).json({
      error: "Failed to fetch feed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
