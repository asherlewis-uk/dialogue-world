FROM node:20-slim

WORKDIR /app

# Install native deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/

WORKDIR /app/server
EXPOSE 3847
CMD ["node", "index.js"]
