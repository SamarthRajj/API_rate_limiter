import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const client = createClient(
  process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, database: 0 }
    : {
        socket: {
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: process.env.REDIS_PORT || 6379,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error("Redis: Max reconnection attempts reached");
              return new Error("Redis connection failed");
            }
            // Exponential backoff: 50ms, 100ms, 200ms, etc.
            return Math.min(retries * 50, 3000);
          },
        },
        database: 0,
      },
);

client.on("error", (err) => console.error("Redis Error:", err));
client.on("connect", () => console.log("Redis connecting..."));
client.on("ready", () => console.log("✅ Redis ready"));
client.on("reconnecting", () => console.log("Redis reconnecting..."));

await client.connect();

export default client;
