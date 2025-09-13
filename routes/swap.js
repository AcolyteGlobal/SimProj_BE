// routes/swap.js
import express from "express";
import pool from "../db/db.js";

const router = express.Router();

// ✅ Get all SIM swaps (assignments with user name + SIM phone)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.assignment_id,
        u.name AS user_name,
        u.biometric_id,
        s.phone_number AS sim_phone,
        s.provider,
        a.sim_id,
        a.assigned_at,
        a.active
      FROM sim_assignment a
      JOIN users1 u ON a.user_id = u.user_id
      JOIN sim_inventory s ON a.sim_id = s.sim_id
      ORDER BY a.assignment_id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Fetch swaps error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Swap SIM for a user (by biometric_id)
router.post("/", async (req, res) => {
  let { biometric_id, new_sim_id } = req.body;

  // 🔒 Validations
  if (!biometric_id || !new_sim_id) {
    return res
      .status(400)
      .json({ error: "Missing required fields: biometric_id and new_sim_id" });
  }

  biometric_id = biometric_id.toUpperCase();
  if (!/^BIO\d+$/.test(biometric_id)) {
    return res
      .status(400)
      .json({ error: "Invalid biometric_id format. Example: BIO003" });
  }

  const findUserQuery = `SELECT user_id FROM users1 WHERE biometric_id = ?`;
  const deactivateOldSimQuery = `
    UPDATE sim_assignment SET active = 0
    WHERE user_id = ? AND active = 1
  `;
  const insertNewAssignmentQuery = `
    INSERT INTO sim_assignment (user_id, sim_id, active)
    VALUES (?, ?, 1)
  `;
  const updateSimStatusQuery = `
    UPDATE sim_inventory SET status = 'assigned' WHERE sim_id = ?
  `;

  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 🔍 Find user_id from biometric_id
      const [userRows] = await connection.query(findUserQuery, [biometric_id]);
      if (userRows.length === 0) {
        throw new Error("User not found for biometric_id: " + biometric_id);
      }
      const user_id = userRows[0].user_id;

      // Deactivate old SIM assignment(s)
      await connection.query(deactivateOldSimQuery, [user_id]);

      // Insert new assignment
      const [assignResult] = await connection.query(insertNewAssignmentQuery, [
        user_id,
        new_sim_id,
      ]);

      // Update SIM status
      await connection.query(updateSimStatusQuery, [new_sim_id]);

      // Fetch inserted row with JOINs
      const [rows] = await connection.query(
        `
        SELECT 
          a.assignment_id,
          u.name AS user_name,
          u.biometric_id,
          s.phone_number AS sim_phone,
          s.provider,
          a.sim_id,
          a.assigned_at,
          a.active
        FROM sim_assignment a
        JOIN users1 u ON a.user_id = u.user_id
        JOIN sim_inventory s ON a.sim_id = s.sim_id
        WHERE a.assignment_id = ?
      `,
        [assignResult.insertId]
      );

      await connection.commit();
      res.status(201).json(rows[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Swap SIM error:", err);
      res.status(500).send({ error: err.message || "Error swapping SIM" });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).send("Database error");
  }
});

export default router;
