// routes/exit.js
import express from 'express';
import pool from '../db/db.js';

const router = express.Router();

// ✅ GET all exit logs
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM exit_log");
    res.json(rows);
  } catch (err) {
    console.error("Fetch exit logs error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ POST /exit user
router.post("/", async (req, res) => {
  const { user_id, reason, admin } = req.body;

  // 🔒 Basic validations
  if (!user_id || !reason) {
    return res.status(400).json({ error: "Missing required fields: user_id and reason are required" });
  }

  if (isNaN(user_id)) {
    return res.status(400).json({ error: "user_id must be a number" });
  }

  try {
    await pool.query("START TRANSACTION");

    // Insert exit log and auto-fetch biometric_id & phone_number from related tables
    const insertExitQuery = `
      INSERT INTO exit_log (user_id, reason, biometric_id, phone_number, handled_by_admin)
      SELECT 
        u.user_id,
        ?,                    -- reason
        u.biometric_id,        -- auto fetch from users1
        si.phone_number,       -- auto fetch from assigned active SIM
        ?                      -- handled_by_admin
      FROM users1 u
      LEFT JOIN sim_assignment sa ON sa.user_id = u.user_id AND sa.active = TRUE
      LEFT JOIN sim_inventory si ON si.sim_id = sa.sim_id
      WHERE u.user_id = ?;
    `;

    await pool.query(insertExitQuery, [reason, admin, user_id]);

    // Deactivate user
    await pool.query("UPDATE users1 SET status = 'inactive' WHERE user_id = ?", [user_id]);

    // Free active SIM
    await pool.query(`
      UPDATE sim_inventory
      SET status = 'inactive'
      WHERE sim_id = (
        SELECT sim_id FROM sim_assignment WHERE user_id = ? AND active = TRUE LIMIT 1
      )
    `, [user_id]);

    // Delete inactive/out-of-service SIM
    await pool.query(`
      DELETE FROM sim_inventory
      WHERE sim_id = (
        SELECT sim_id FROM sim_assignment WHERE user_id = ? AND active = FALSE LIMIT 1
      )
      AND status IN ('inactive','out_of_service')
    `, [user_id]);

    await pool.query("COMMIT");

    // Return the inserted exit log
    const [newLog] = await pool.query("SELECT * FROM exit_log ORDER BY exit_id DESC LIMIT 1");
    res.status(201).json(newLog[0]);

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Exit user error:", err);
    res.status(500).send("Error processing exit");
  }
});

export default router;
