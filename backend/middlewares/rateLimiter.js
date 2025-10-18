// middlewares/rateLimiter.js
import redisClient from "../utils/redisClient.js";
import Client from "../models/Client.js";
import logger from "../utils/logger.js";

export default function rateLimiter(redisClient) {
  return async (req, res, next) => {
    const io = req.app.get("io");
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({ message: "API key required" });
    }

    try {
      // Get client config from MongoDB
      const client = await Client.findOne({ apiKey });
      if (!client) {
        return res.status(401).json({ message: "Invalid API key" });
      }

      // Check if client is enabled
      if (!client.enabled) {
        return res.status(403).json({ message: "API key is disabled" });
      }

      const now = new Date();
      const minuteWindow = Math.floor(Date.now() / 60000); // Proper minute window
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD format

      // Use consistent Redis key patterns with usage routes
      const minuteKey = `count:${apiKey}:m:${minuteWindow}`;
      const dayKey = `count:${apiKey}:d:${today}`;
      const blockedKey = `blocked:${apiKey}:d:${today}`;

      // Read current counters first (blocked should NOT count towards totals)
      const [minuteRaw, dayRaw] = await redisClient.mGet(minuteKey, dayKey);
      const currentMinute = parseInt(minuteRaw || "0", 10);
      const currentDay = parseInt(dayRaw || "0", 10);

      const nextMinute = currentMinute + 1;
      const nextDay = currentDay + 1;

      const wouldExceed = nextMinute > client.perMinuteLimit || nextDay > client.perDayLimit;

      if (wouldExceed) {
        // Do NOT increment totals; only track blocked
        const blockedCountRaw = await redisClient.incr(blockedKey);
        await redisClient.expire(blockedKey, 86400);

        io.emit("blockedRequest", {
          apiKey,
          clientName: client.name,
          timestamp: now,
          minuteCount: currentMinute,
          dayCount: currentDay,
          blockedCount: parseInt(blockedCountRaw || "0", 10),
          perMinuteLimit: client.perMinuteLimit,
          perDayLimit: client.perDayLimit
        });

        return res.status(429).json({ message: "Rate limit exceeded" });
      }

      // Allowed: increment totals atomically and set expirations
      await redisClient
        .multi()
        .incr(minuteKey)
        .expire(minuteKey, 60)
        .incr(dayKey)
        .expire(dayKey, 86400)
        .exec();

      // Get current blocked count for complete data
      const blockedCountRaw = await redisClient.get(blockedKey);

      io.emit("usageUpdate", {
        apiKey,
        clientName: client.name,
        minuteCount: nextMinute,
        dayCount: nextDay,
        blockedCount: parseInt(blockedCountRaw || "0", 10),
        limits: {
          perMinute: client.perMinuteLimit,
          perDay: client.perDayLimit
        },
        timestamp: now,
      });

      next();
    } catch (error) {
      logger.error("Rate limiter error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}
  
