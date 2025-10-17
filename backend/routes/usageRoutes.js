// routes/usageRoutes.js
import express from "express";
import Client from "../models/Client.js";
import redisClient from "../utils/redisClient.js";

const router = express.Router();

// GET /api/usage - returns array of { apiKey, name, minuteCount, dayCount, blockedCount, perMinuteLimit, perDayLimit }
router.get("/", async (req, res) => {
  try {
    const clients = await Client.find();
    const results = [];

    const today = new Date().toISOString().slice(0,10);
    const minuteWindow = Math.floor(Date.now() / 60000);

    for (const c of clients) {
      const minuteKey = `count:${c.apiKey}:m:${minuteWindow}`;
      const dayKey = `count:${c.apiKey}:d:${today}`;
      const blockedKey = `blocked:${c.apiKey}:d:${today}`;

      const [minRaw, dayRaw, blockedRaw] = await redisClient.mGet(minuteKey, dayKey, blockedKey);
      results.push({
        apiKey: c.apiKey,
        name: c.name,
        minuteCount: parseInt(minRaw || "0", 10),
        dayCount: parseInt(dayRaw || "0", 10),
        blockedCount: parseInt(blockedRaw || "0", 10),
        perMinuteLimit: c.perMinuteLimit,
        perDayLimit: c.perDayLimit
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Error in /api/usage:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
