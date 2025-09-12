import express from "express";
import pool from "../db/db.js";

const router = express.Router();

// Toggle user active status
router.post("/toggleActive", async (req, res) => {
  const { user_id, status } = req.body; // status = 1 or 0

  if (typeof user_id !== "number" || ![0, 1].includes(status)) {
    return res.status(400).json({ error: "Invalid user_id or status" });
  }

  try {
    const query = "UPDATE users1 SET status = ? WHERE user_id = ?";
    await pool.query(query, [status, user_id]);
    res.json({ success: true, user_id, status });
  } catch (err) {
    console.error("Error updating user status:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

export default router;
