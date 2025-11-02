import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
  scenarios: {
    constant_load: {
      executor: "constant-arrival-rate",
      rate: 1500, // 1500 RPS
      timeUnit: "1s", // 1500 iterations per second
      duration: "30s", // test duration
      preAllocatedVUs: 100, // initial pool
      maxVUs: 200, // max pool size
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<50", "p(99)<120"],
    http_req_failed: ["rate<0.005"],
  },
};

const users = ["u1", "u2", "u3", "u4", "u5"];
const regions = ["us", "eu", "in", "asia", "latam"];
const segments = ["personalized", "hot", "popular", "sports", "current_affairs"];

export default function () {
  const u = users[Math.floor(Math.random() * users.length)];
  const r = regions[Math.floor(Math.random() * regions.length)];
  const s = segments[Math.floor(Math.random() * segments.length)];
  const url = `http://127.0.0.1:3000/v1/feed?userid=${u}&region=${r}&segment=${s}&limit10`;
  const res = http.get(url);
  check(res, { "status 200": r => r.status === 200 });
  sleep(0.02);
}
