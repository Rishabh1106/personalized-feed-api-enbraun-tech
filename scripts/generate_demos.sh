#!/usr/bin/env bash
set -euo pipefail

mkdir -p demos

HOST=${HOST:-http://localhost:3000}

declare -a USERS=("u1" "u2" "u3" "u4" "u5")
declare -a REGIONS=("us" "eu" "in" "asia" "latam")
declare -a SEGMENTS=("personalized" "hot" "popular" "sports" "current_affairs")

for u in "${USERS[@]}"; do
  for r in "${REGIONS[@]}"; do
    for s in "${SEGMENTS[@]}"; do
      fname="demos/${u}-${r}-${s}.json"
      curl -s "${HOST}/v1/feed?userid=${u}&region=${r}&segment=${s}&limit=10" -o "${fname}"
      echo "Saved ${fname}"
    done
  done
done

echo "Demos generated."
