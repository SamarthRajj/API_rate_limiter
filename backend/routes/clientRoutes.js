import express from "express";
import Client from "../models/Client.js";
import crypto from "crypto";

const router = express.Router();

router.post("/", async (req, res) => {
  const { name, perMinuteLimit, perDayLimit } = req.body;
  const apiKey = crypto.randomBytes(16).toString("hex");
  const newClient = await Client.create({ name, apiKey, perMinuteLimit, perDayLimit });
  res.json(newClient);
});

router.get("/", async (req, res) => {
  const clients = await Client.find();
  res.json(clients);
});

export default router;
