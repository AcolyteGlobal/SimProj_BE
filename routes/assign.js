// routes/assign.js
import express from 'express';
import pool from '../db/db.js';

const router = express.Router();

// ✅ Get all SIM assignments
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM sim_assignment");
    res.json(rows);
  } catch (err) {
    console.error("Fetch assignments error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Assign a SIM to a user
router.post('/', async (req, res) => {
  const { user_id, sim_id } = req.body;

  // 🔒 Validations
  if (!user_id || !sim_id) {
    return res.status(400).json({ error: "Missing required fields: user_id and sim_id are required" });
  }

  const assignQuery = `
    INSERT INTO sim_assignment (user_id, sim_id)
    VALUES (?, ?)
  `;
  const updateSimStatusQuery = `
    UPDATE sim_inventory SET status = 'assigned' WHERE sim_id = ?
  `;

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert assignment
      const [assignResult] = await connection.query(assignQuery, [user_id, sim_id]);

      // Update SIM status
      await connection.query(updateSimStatusQuery, [sim_id]);

      // Fetch inserted row
      const [rows] = await connection.query(
        "SELECT * FROM sim_assignment WHERE assignment_id = ?",
        [assignResult.insertId]
      );

      await connection.commit();
      res.status(201).json(rows[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Assign SIM error:", err);
      res.status(500).send("Error assigning SIM");
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send("Database error");
  }
});

export default router;
