// routes/assign.js
import express from 'express';
import pool from '../db/db.js';

const router = express.Router();

// ✅ Get SIM Assignment History
router.get('/history', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.assignment_id, a.user_id, u.name AS user_name,
             s.sim_id, s.phone_number, s.provider,
             a.assigned_at, a.unassigned_at, a.active
      FROM sim_assignment a
      JOIN users1 u ON a.user_id = u.user_id
      JOIN sim_inventory s ON a.sim_id = s.sim_id
      ORDER BY a.assigned_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Fetch SIM history error:", err);
    res.status(500).send("Error fetching SIM assignment history");
  }
});




// ✅ Assign or Swap a SIM to a user (one active user per SIM)
router.post('/', async (req, res) => {
  const { user_id, sim_id } = req.body;

  // 🔒 Validations
  if (!user_id || !sim_id) {
    return res.status(400).json({ error: "Missing required fields: user_id and sim_id are required" });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1️⃣ Check if SIM is already assigned
      const [existing] = await connection.query(
        `SELECT assignment_id FROM sim_assignment 
         WHERE sim_id = ? AND active = 1
         ORDER BY assigned_at DESC LIMIT 1`,
        [sim_id]
      );

      if (existing.length > 0) {
        // Deactivate old assignment
        await connection.query(
          `UPDATE sim_assignment 
           SET active = 0, ended_at = NOW() 
           WHERE assignment_id = ?`,
          [existing[0].assignment_id]
        );
      }

      // 2️⃣ Insert new assignment
      const [assignResult] = await connection.query(
        `INSERT INTO sim_assignment (user_id, sim_id, active, assigned_at) 
         VALUES (?, ?, 1, NOW())`,
        [user_id, sim_id]
      );

      // 3️⃣ Update SIM status
      await connection.query(
        `UPDATE sim_inventory SET status = 'assigned', updated_at = NOW() WHERE sim_id = ?`,
        [sim_id]
      );

      // 4️⃣ Fetch inserted assignment with details
      const [rows] = await connection.query(
        `SELECT a.assignment_id, a.user_id, u.name AS user_name,
                s.sim_id, s.phone_number, s.provider,
                a.assigned_at, a.ended_at, a.active
         FROM sim_assignment a
         JOIN users1 u ON a.user_id = u.user_id
         JOIN sim_inventory s ON a.sim_id = s.sim_id
         WHERE a.assignment_id = ?`,
        [assignResult.insertId]
      );

      await connection.commit();
      res.status(201).json(rows[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Assign/Swap SIM error:", err);
      res.status(500).send("Error assigning/swapping SIM");
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send("Database error");
  }
});

export default router;
