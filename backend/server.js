import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import clientRoutes from "./routes/clientRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import redisClient from "./utils/redisClient.js";
import rateLimiter from "./middlewares/rateLimiter.js";
import errorHandler from "./middlewares/errorHandler.js";
import logger from "./utils/logger.js";
import setupSwagger from "./swagger.js";

dotenv.config();
const app = express();

// Setup Swagger documentation
setupSwagger(app);

// Security middleware
app.use(helmet());
app.use(compression());

// Body parser and CORS
app.use(express.json());
app.use(cors());

// MongoDB connection with pooling
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => logger.info("MongoDB connected"))
  .catch(err => logger.error("MongoDB connection error:", err));

// Create HTTP + WebSocket server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Make Socket.IO globally accessible
app.set("io", io);

// Listen to Redis Pub/Sub or app events for updates (optional)
io.on("connection", (socket) => {
  logger.info(`Client connected to WebSocket: ${socket.id}`);
  socket.on("disconnect", () => logger.info(`Client disconnected: ${socket.id}`));
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/usage", usageRoutes);

// Apply rate limiting to remaining API routes
app.use("/api", rateLimiter(redisClient));

// Protected API routes
app.use("/api", apiRoutes);

// Redis test route
app.get("/test-redis", async (req, res) => {
  await redisClient.set("foo", "bar");
  const value = await redisClient.get("foo");
  res.send(`Redis test value: ${value}`);
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
