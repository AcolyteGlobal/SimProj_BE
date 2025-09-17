// routes/users.js
import express from "express";
import pool from "../db/db.js"; // MySQL pool

const router = express.Router();

// GET all users with handled_by_admin (if present)
router.get("/", async (req, res) => {
  try {
    // Select all user fields + handled_by_admin if exists
    const query = `
      SELECT 
        user_id,
        name,
        branch,
        office_number,
        department,
        biometric_id,
        official_email,
        status,
        created_at,
        updated_at,
        handled_by_admin   -- new column to track which admin added/updated
      FROM users1
      ORDER BY user_id ASC
    `;

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
