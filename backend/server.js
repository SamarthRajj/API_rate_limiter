import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import logger from "./utils/logger.js";

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => logger.info("MongoDB connected"))
  .catch((err) => logger.error("MongoDB connection error:", err));

const { httpServer } = createApp();
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
