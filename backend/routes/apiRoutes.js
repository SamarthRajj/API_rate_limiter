import express from "express";

const router = express.Router();

/**
 * @swagger
 * /api/data:
 *   get:
 *     summary: Test endpoint protected by rate limiter
 *     tags: [API]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Client API key
 *     responses:
 *       200:
 *         description: Successful request
 *       429:
 *         description: Rate limit exceeded
 *       401:
 *         description: Invalid or missing API key
 */
router.get("/data", (req, res) => {
  res.json({ 
    success: true,
    message: "Request successful!",
    timestamp: new Date().toISOString()
  });
});

export default router;
