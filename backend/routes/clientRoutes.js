import express from "express";
import { body, param, validationResult } from "express-validator";
import crypto from "crypto";
import Client from "../models/Client.js";
import authMiddleware from "../middlewares/auth.js";
import cacheMiddleware from "../middlewares/cache.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import redisClient from "../utils/redisClient.js";

const router = express.Router();

// Helper to clear cache
const clearClientsCache = async () => {
  try {
    const keys = await redisClient.keys("cache:/api/clients*");
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    logger.error(`Cache clear error: ${err.message}`);
  }
};

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Get all clients
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: List of clients
 */
router.get("/", cacheMiddleware(30), async (req, res, next) => {
  try {
    const clients = await Client.find().select("-__v");
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client details
 *       404:
 *         description: Client not found
 */
router.get("/:id", async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).select("-__v");
    if (!client) {
      return next(new ApiError(404, "Client not found"));
    }
    res.json(client);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - perMinuteLimit
 *               - perDayLimit
 *             properties:
 *               name:
 *                 type: string
 *               perMinuteLimit:
 *                 type: number
 *               perDayLimit:
 *                 type: number
 *     responses:
 *       201:
 *         description: Client created successfully
 */
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("perMinuteLimit")
      .isInt({ min: 1 })
      .withMessage("Per minute limit must be at least 1"),
    body("perDayLimit")
      .isInt({ min: 1 })
      .withMessage("Per day limit must be at least 1"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const { name, perMinuteLimit, perDayLimit } = req.body;
      const apiKey = crypto.randomBytes(16).toString("hex");
      
      const newClient = await Client.create({ 
        name, 
        apiKey, 
        perMinuteLimit, 
        perDayLimit 
      });
      
      await clearClientsCache();
      logger.info(`New client created: ${name} (${apiKey})`);

      res.status(201).json(newClient);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     summary: Update client limits
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               perMinuteLimit:
 *                 type: number
 *               perDayLimit:
 *                 type: number
 *     responses:
 *       200:
 *         description: Client updated successfully
 */
router.put(
  "/:id",
  authMiddleware,
  [
    param("id").isMongoId().withMessage("Invalid client ID"),
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("perMinuteLimit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Per minute limit must be at least 1"),
    body("perDayLimit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Per day limit must be at least 1"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const { name, perMinuteLimit, perDayLimit } = req.body;
      const updateData = {};
      
      if (name !== undefined) updateData.name = name;
      if (perMinuteLimit !== undefined) updateData.perMinuteLimit = perMinuteLimit;
      if (perDayLimit !== undefined) updateData.perDayLimit = perDayLimit;
      updateData.updatedAt = new Date();

      const client = await Client.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!client) {
        return next(new ApiError(404, "Client not found"));
      }

      await clearClientsCache();
      logger.info(`Client updated: ${client.name} (${client.apiKey})`);

      res.json(client);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Delete a client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client deleted successfully
 */
router.delete(
  "/:id",
  authMiddleware,
  [param("id").isMongoId().withMessage("Invalid client ID")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const client = await Client.findByIdAndDelete(req.params.id);

      if (!client) {
        return next(new ApiError(404, "Client not found"));
      }

      await clearClientsCache();
      logger.info(`Client deleted: ${client.name} (${client.apiKey})`);

      res.json({ 
        success: true,
        message: "Client deleted successfully",
        data: client
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/clients/{id}/regenerate:
 *   post:
 *     summary: Regenerate API key for a client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 */
router.post(
  "/:id/regenerate",
  authMiddleware,
  [param("id").isMongoId().withMessage("Invalid client ID")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const newApiKey = crypto.randomBytes(16).toString("hex");
      const client = await Client.findByIdAndUpdate(
        req.params.id,
        { apiKey: newApiKey, updatedAt: new Date() },
        { new: true }
      );

      if (!client) {
        return next(new ApiError(404, "Client not found"));
      }

      await clearClientsCache();
      logger.info(`API key regenerated for client: ${client.name}`);

      res.json({
        success: true,
        message: "API key regenerated successfully",
        data: client
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/clients/{id}/toggle:
 *   patch:
 *     summary: Enable/disable a client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client status toggled successfully
 */
router.patch(
  "/:id/toggle",
  authMiddleware,
  [param("id").isMongoId().withMessage("Invalid client ID")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const client = await Client.findById(req.params.id);
      if (!client) {
        return next(new ApiError(404, "Client not found"));
      }

      client.enabled = !client.enabled;
      client.updatedAt = new Date();
      await client.save();

      await clearClientsCache();
      logger.info(`Client ${client.enabled ? "enabled" : "disabled"}: ${client.name}`);

      res.json({
        success: true,
        message: `Client ${client.enabled ? "enabled" : "disabled"} successfully`,
        data: client
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
