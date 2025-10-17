import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import clientRoutes from "./routes/clientRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import usageRoutes from "./routes/usageRoutes.js";
import redisClient from "./utils/redisClient.js";
import rateLimiter from "./middlewares/rateLimiter.js"; // 🆕 Import rate limiter middleware

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Create HTTP + WebSocket server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// Make Socket.IO globally accessible
app.set("io", io);

// Listen to Redis Pub/Sub or app events for updates (optional)
io.on("connection", (socket) => {
  console.log("Client connected to WebSocket");
  socket.on("disconnect", () => console.log("Client disconnected"));
});

// Routes (client routes before rate limiter to avoid requiring API key for client creation)
app.use("/api/clients", clientRoutes);
app.use("/api/usage", usageRoutes);

// 🧠 Middleware: Apply rate limiting to remaining API routes
app.use("/api", rateLimiter(redisClient));

// Protected API routes
app.use("/api", apiRoutes);

// Redis test route
app.get("/test-redis", async (req, res) => {
  await redisClient.set("foo", "bar");
  const value = await redisClient.get("foo");
  res.send(`Redis test value: ${value}`);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on ${PORT}`));
