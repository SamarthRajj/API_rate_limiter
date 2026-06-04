// routes/usageRoutes.js
import express from "express";
import Client from "../models/Client.js";
import redisClient from "../utils/redisClient.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * @swagger
 * /api/usage:
 *   get:
 *     summary: Get current usage statistics for all clients
 *     tags: [Usage]
 *     responses:
 *       200:
 *         description: Usage statistics for all clients
 */
router.get("/", async (req, res, next) => {
  try {
    const clients = await Client.find();
    const results = [];

    const today = new Date().toISOString().slice(0,10);
    const minuteWindow = Math.floor(Date.now() / 60000);

    // Batch Redis operations for better performance
    const redisOps = [];
    for (const c of clients) {
      const minuteKey = `count:${c.apiKey}:m:${minuteWindow}`;
      const dayKey = `count:${c.apiKey}:d:${today}`;
      const blockedKey = `blocked:${c.apiKey}:d:${today}`;
      redisOps.push(redisClient.mGet(minuteKey, dayKey, blockedKey));
    }

    const redisResults = await Promise.all(redisOps);

    clients.forEach((c, idx) => {
      const [minRaw, dayRaw, blockedRaw] = redisResults[idx];
      results.push({
        apiKey: c.apiKey,
        name: c.name,
        minuteCount: parseInt(minRaw || "0", 10),
        dayCount: parseInt(dayRaw || "0", 10),
        blockedCount: parseInt(blockedRaw || "0", 10),
        perMinuteLimit: c.perMinuteLimit,
        perDayLimit: c.perDayLimit,
        enabled: c.enabled
      });
    });

    res.json(results);
  } catch (err) {
    logger.error("Error in /api/usage:", err);
    next(err);
  }
});

export default router;
