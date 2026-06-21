import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import clientRoutes from "./routes/clientRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import defaultRedisClient from "./utils/redisClient.js";
import rateLimiter from "./middlewares/rateLimiter.js";
import errorHandler from "./middlewares/errorHandler.js";
import logger from "./utils/logger.js";
import setupSwagger from "./swagger.js";

const benchmarkMode = process.env.BENCHMARK_MODE === "true";

export function createApp(options = {}) {
  const redis = options.redisClient ?? defaultRedisClient;
  const app = express();

  if (!benchmarkMode) {
    setupSwagger(app);
  }

  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(cors());

  const httpServer = createServer(app);
  let io = null;

  if (!benchmarkMode) {
    io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    app.set("io", io);

    io.on("connection", (socket) => {
      logger.info(`Client connected to WebSocket: ${socket.id}`);
      socket.on("disconnect", () => logger.info(`Client disconnected: ${socket.id}`));
    });
  } else {
    app.set("io", { emit: () => {} });
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/clients", clientRoutes);
  app.use("/api/usage", usageRoutes);
  app.use("/api", rateLimiter(redis));
  app.use("/api", apiRoutes);

  if (!benchmarkMode) {
    app.get("/test-redis", async (req, res) => {
      await redis.set("foo", "bar");
      const value = await redis.get("foo");
      res.send(`Redis test value: ${value}`);
    });
  }

  app.use(errorHandler);

  return { app, httpServer, io, redis };
}

export { benchmarkMode };
