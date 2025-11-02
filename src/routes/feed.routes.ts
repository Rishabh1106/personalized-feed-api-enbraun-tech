import { Router } from "express";
import { getFeed } from "../controllers/feed.controller";

// Router that exposes /feed endpoints. Keep path mounting responsibility to the app.
const router = Router();

// GET /feed?userId=123
router.get("/feed", getFeed);

export default router;
