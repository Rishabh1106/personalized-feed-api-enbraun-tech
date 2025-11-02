import { Request, Response } from "express";
import { FeedService } from "../services/feed.service";

// Minimal controller for feed endpoints with cursor-based pagination
const service = new FeedService();

export const getFeed = async (req: Request, res: Response) => {
  const start = Date.now(); // For response time tracking
  console.log("req query : ", req.query);
  const userId = Number(req.query.userid);
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 100); // Cap at 100
  const region = req.query.region ? String(req.query.region) : undefined;
  const segment = req.query.segment === "global" ? "global" : "personalized";

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const result = await service.getFeed(userId, {
      cursor,
      limit,
      region,
      segment,
    });

    // Add response time metric
    const duration = Date.now() - start;
    res.setHeader("X-Response-Time", `${duration}ms`);

    res.json({
      data: result.items,
      pagination: {
        nextCursor: result.nextCursor,
        limit,
      },
      meta: {
        responseTime: duration,
      },
    });
  } catch (err) {
    console.error("Feed fetch error:", err);
    res.status(500).json({ error: "failed to fetch feed" });
  }
};
