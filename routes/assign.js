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
             a.assigned_at, a.unassigned_at, a.active,
             s.handled_by_admin
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




// ✅ Assign or Reassign SIM
router.post("/", async (req, res) => {
  const { biometric_id, phone_number, force } = req.body;

  // 🔒 Validations
  if (!biometric_id || !phone_number) {
    return res
      .status(400)
      .json({ error: "Missing required fields: biometric_id and phone_number are required" });
  }

  
  // Logged-in admin name from JWT via authorizeRole

  const adminName = req.user?.username || "system";



  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1️⃣ Get user_id from biometric_id
      const [userRows] = await connection.query(
        "SELECT user_id, name FROM users1 WHERE biometric_id = ?",
        [biometric_id]
      );
      if (userRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "User not found for given biometric_id" });
      }
      const { user_id, name: user_name } = userRows[0];

      // 2️⃣ Get sim_id from phone_number
      const [simRows] = await connection.query(
        "SELECT sim_id, phone_number FROM sim_inventory WHERE phone_number = ?",
        [phone_number]
      );
      if (simRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "SIM not found for given phone number" });
      }
      const { sim_id } = simRows[0];

      
      // 3️⃣ Check if SIM already assigned
const [existing] = await connection.query(
  `SELECT a.assignment_id, u.name AS \`current_user\`, u.biometric_id
   FROM sim_assignment a
   JOIN users1 u ON a.user_id = u.user_id
   WHERE a.sim_id = ? AND a.active = 1
   ORDER BY a.assigned_at DESC
   LIMIT 1`,
  [sim_id]
);


      if (existing.length > 0 && !force) {
        await connection.rollback();
        return res.status(409).json({
          error: "SIM already assigned",
          requireConfirmation: true,
          message: `Phone ${phone_number} is already assigned to ${existing[0].current_user} (Biometric ID: ${existing[0].biometric_id}). Override?`,
        });
      }

      if (existing.length > 0 && force) {
        // Deactivate old assignment
        // Deactivate old assignment (if force)
await connection.query(
  `UPDATE sim_assignment 
   SET active = 0, unassigned_at = NOW() 
   WHERE assignment_id = ?`,
  [existing[0].assignment_id]
);
      }

      // 4️⃣ Insert new assignment
      const [assignResult] = await connection.query(
        `INSERT INTO sim_assignment (user_id, sim_id, active, assigned_at) 
         VALUES (?, ?, 1, NOW())`,
        [user_id, sim_id]
      );

      // 5️⃣ Update SIM status and record admin

      await connection.query(

        `UPDATE sim_inventory 

         SET status = 'assigned', handled_by_admin = ?, updated_at = NOW() 

         WHERE sim_id = ?`,

        [adminName, sim_id]

      );

// Fetch inserted assignment with details
const [rows] = await connection.query(
  `SELECT a.assignment_id, a.user_id, u.name AS user_name, u.biometric_id,
          s.sim_id, s.phone_number, s.provider,
          a.assigned_at, a.unassigned_at, a.active,
          s.handled_by_admin
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

