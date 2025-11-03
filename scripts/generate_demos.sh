#!/usr/bin/env bash
set -euo pipefail

mkdir -p demos

HOST=${HOST:-http://localhost:3000}

declare -a USERS=("1" "2" "3" "4" "5")
declare -a REGIONS=("us" "eu" "in" "asia" "latam")
declare -a SEGMENTS=("hot" "popular" "sports" "current_affairs", "top10")

for u in "${USERS[@]}"; do
  for r in "${REGIONS[@]}"; do
    for s in "${SEGMENTS[@]}"; do
      fname="demos/${u}-${r}-${s}.json"
      curl -s "${HOST}/v1/feed?userid=${u}&region=${r}&SEGMENT=${s}&limit=10" -o "${fname}"
      echo "Saved ${fname}"
    done
  done
done

echo "Demos generated."
