import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379
  }
});

client.on("error", (err) => console.error("Redis Error:", err));

await client.connect();
console.log("✅ Redis connected successfully");

export default client;
