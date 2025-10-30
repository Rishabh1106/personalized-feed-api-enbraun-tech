# Personalised Feed API

Tech: Node + TypeScript, Express, PostgreSQL (Knex), Redis for cache.

Prerequisites

- Docker & Docker Compose (to run Redis + Postgres)
- nvm (we recommend Node 24)
- npm
- (optional) k6 for load testing

How to run (local)

1. Use Node 24 with nvm:

```bash
nvm install 24
nvm use 24
node -v  # should show v24.x
```

2. Start services (Redis + Postgres):

```bash
docker-compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Seed DB (creates tables and inserts >=5k posts + users):

```bash
npm run seed
```

5. Start server:

```bash
npm start
```

6. Generate demo JSONs (calls /v1/feed for combinations):

```bash
npm run demo
```

Cursor encoding

We encode the pagination cursor as base64url(JSON({ score, ts, id })). Ordering is descending by (personalized_score, ts, id).

Caching

- Cache key: `feed:{userid}:{region}:{segment}:limit={limit}:cursor={cursor}`
- TTL: base 30 seconds with +/-20% jitter
- Stampede control: Redis lock with `SET NX PX` (10s). If lock not acquired, poll for cache up to 2s then fallback to compute.

Seeding

- Seeds 5000 posts across regions and categories and 5 users with preference weights.
- Materializes `user_feed_view` table (columns in snake_case) with a precomputed `personalized_score` per (user,item).

Quick curl / Postman examples

```bash
# Personalized feed
curl -s "http://localhost:3000/v1/feed?userid=u1&region=us&segment=personalized&limit=10" | jq

# Sports segment
curl -s "http://localhost:3000/v1/feed?userid=u2&region=eu&segment=sports&limit=10" | jq

# Hot segment
curl -s "http://localhost:3000/v1/feed?userid=u3&region=in&segment=hot&limit=10" | jq

# Paginate using cursor (replace {cursor} with nextCursor from previous response)
curl -s "http://localhost:3000/v1/feed?userid=u1&region=us&segment=personalized&limit=10&cursor={cursor}" | jq
```

Load testing with k6

1. Install k6: https://k6.io/docs/getting-started/installation

2. Run the provided script (targets 1500 RPS):

```bash
k6 run k6/script.js
```

The script is configured to assert:

- p95 latency < 50ms
- p99 latency < 120ms
- error rate < 0.5%

Notes & assumptions

- The project uses Postgres + Knex for easier local setup and better concurrency compared to SQLite.
- The seeder uses upserts for users to avoid duplicate-key errors on repeated seed runs.
- Personalized score formula: `0.5*recency + 0.35*popularity_norm + 0.15*user_pref`.
