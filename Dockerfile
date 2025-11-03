# Dockerfile for personalised-feed-api
FROM node:20-alpine
# install bash and curl
RUN apk add --no-cache bash curl \
    && curl -LO https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz \
    && tar -xzf k6-v0.45.0-linux-amd64.tar.gz \
    && mv k6-v0.45.0-linux-amd64/k6 /usr/local/bin/ \
    && rm -rf k6-v0.45.0-linux-amd64.tar.gz k6-v0.45.0-linux-amd64
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
