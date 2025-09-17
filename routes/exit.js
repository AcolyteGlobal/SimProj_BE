// routes/exit.js
import express from "express";
import pool from "../db/db.js";

const router = express.Router();

// ✅ GET all exit logs (protected by authorizeRole in index.js)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM exit_log ORDER BY exit_id DESC");
    res.json(rows);
  } catch (err) {
    console.error("Fetch exit logs error:", err);
    res.status(500).send("Server Error");
  }
});



/////////
// GET /exit/logs?page=1&limit=10
router.get("/logs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Count total logs
    const [countRows] = await pool.query("SELECT COUNT(*) as count FROM acolyte.exit_log");
    const total = countRows[0].count;

    // Fetch logs with user name
    const [rows] = await pool.query(
      `SELECT e.exit_id, e.user_id, u.name as user_name, e.exit_date, e.reason,
              e.biometric_id, e.phone_number, e.handled_by_admin
       FROM acolyte.exit_log e
       JOIN acolyte.users1 u ON e.user_id = u.user_id
       ORDER BY e.exit_id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows
    });
  } catch (err) {
    console.error("Fetch exit logs error:", err);
    res.status(500).json({ message: "Server Error while fetching exit logs" });
  }
});



// ✅ POST /exit user by biometric_id
router.post("/", async (req, res) => {
  const { biometric_id, reason } = req.body;

  // Logged-in admin name comes from JWT (set by authorizeRole)
  const adminName = req.user?.username || "system";

  // 🔒 Basic validations
  if (!biometric_id || !reason) {
    return res.status(400).json({
      error: "Missing required fields: biometric_id and reason are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1️⃣ Insert exit log
    const insertExitQuery = `
      INSERT INTO exit_log (user_id, reason, biometric_id, phone_number, handled_by_admin)
      SELECT 
        u.user_id,
        ?,                      -- reason
        u.biometric_id,
        si.phone_number,        -- active SIM number
        ?                       -- handled_by_admin (from JWT)
      FROM users1 u
      LEFT JOIN sim_assignment sa ON sa.user_id = u.user_id AND sa.active = TRUE
      LEFT JOIN sim_inventory si ON si.sim_id = sa.sim_id
      WHERE u.biometric_id = ?;
    `;
    await connection.query(insertExitQuery, [reason, adminName, biometric_id]);

    // 2️⃣ Deactivate user
    await connection.query(
      "UPDATE users1 SET status = 'inactive' WHERE biometric_id = ?",
      [biometric_id]
    );

    // 3️⃣ Free active SIM (mark as available)
    await connection.query(
      `UPDATE sim_inventory
       SET status = 'available', handled_by_admin = ?
       WHERE sim_id = (
         SELECT sim_id FROM sim_assignment sa
         JOIN users1 u ON sa.user_id = u.user_id
         WHERE u.biometric_id = ? AND sa.active = TRUE LIMIT 1
       )`,
      [adminName, biometric_id]
    );

    // 4️⃣ Delete SIM if inactive/out_of_service
    await connection.query(
      `DELETE FROM sim_inventory
       WHERE sim_id = (
         SELECT sim_id FROM sim_assignment sa
         JOIN users1 u ON sa.user_id = u.user_id
         WHERE u.biometric_id = ? AND sa.active = FALSE LIMIT 1
       )
       AND status IN ('inactive','out_of_service')`,
      [biometric_id]
    );

    await connection.commit();

    // Return new exit log
    const [newLog] = await connection.query(
      "SELECT * FROM exit_log ORDER BY exit_id DESC LIMIT 1"
    );
    res.status(201).json(newLog[0]);
  } catch (err) {
    await connection.rollback();
    console.error("Exit user error:", err);
    res.status(500).send("Error processing exit");
  } finally {
    connection.release();
  }
});

export default router;
