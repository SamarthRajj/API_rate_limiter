// routes/authRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import Admin from "../models/Admin.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new admin user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post(
  "/register",
  [
    body("username")
      .trim()
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const { username, password } = req.body;

      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ username });
      if (existingAdmin) {
        return next(new ApiError(400, "Username already exists"));
      }

      // Create new admin
      const admin = await Admin.create({ username, password });
      logger.info(`New admin registered: ${username}`);

      res.status(201).json({
        success: true,
        message: "Admin registered successfully",
        data: {
          id: admin._id,
          username: admin.username,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login admin user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res, next) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new ApiError(400, errors.array()[0].msg));
      }

      const { username, password } = req.body;

      // Find admin
      const admin = await Admin.findOne({ username });
      if (!admin) {
        return next(new ApiError(401, "Invalid credentials"));
      }

      // Check password
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        return next(new ApiError(401, "Invalid credentials"));
      }

      // Generate JWT
      const jwtSecret = process.env.ADMIN_JWT_SECRET || "default_secret_change_in_production";
      const token = jwt.sign(
        { id: admin._id, username: admin.username },
        jwtSecret,
        { expiresIn: "24h" }
      );

      logger.info(`Admin logged in: ${username}`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          admin: {
            id: admin._id,
            username: admin.username,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

