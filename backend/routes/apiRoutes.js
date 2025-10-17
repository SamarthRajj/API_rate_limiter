import express from "express";

const router = express.Router();

router.get("/data", (req, res) => {
  res.json({ message: "Request successful!" });
});

export default router;
