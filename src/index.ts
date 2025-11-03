import express from "express";
import { initSchema } from "./db";
import feedRouter from "./routes/feed.routes";

const app = express();
app.use(express.json());

// Initialize DB schema (safe to call on startup)
initSchema().catch(err => {
  console.error("Failed to initialize schema", err);
  process.exit(1);
});

// Mount routes
app.use("/v1", feedRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Feed API listening ${port}`));
