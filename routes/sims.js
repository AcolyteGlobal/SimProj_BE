// routes/sims.js
import express from "express";
import pool from "../db/db.js"; // MySQL pool

const router = express.Router();

/**
 * GET /sims
 * Returns all SIMs with:
 * - sim_id
 * - phone_number
 * - provider
 * - status (assigned/available)
 * - latest assigned_user
 * - latest assigned date
 * - handled_by_admin
 */
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        si.sim_id,
        si.phone_number,
        si.provider,
        -- if there's an active assignment, mark as assigned, else use DB status
        IF(sa.active = 1, 'assigned', si.status) AS status,
        u.name AS assigned_user,
        sa.assigned_at AS latest_assigned_date,
        si.added_date,
        si.updated_at,
        si.handled_by_admin
      FROM sim_inventory si
      LEFT JOIN (
        SELECT sa1.sim_id, sa1.user_id, sa1.assigned_at, sa1.active
        FROM sim_assignment sa1
        INNER JOIN (
          -- get latest assignment per SIM
          SELECT sim_id, MAX(assigned_at) AS latest
          FROM sim_assignment
          GROUP BY sim_id
        ) sa2 ON sa1.sim_id = sa2.sim_id AND sa1.assigned_at = sa2.latest
      ) sa ON si.sim_id = sa.sim_id
      LEFT JOIN users1 u ON sa.user_id = u.user_id
      ORDER BY si.sim_id ASC
    `;

    const [rows] = await pool.query(query);

    const sims = rows.map(r => ({
      sim_id: r.sim_id,
      phone_number: r.phone_number,
      provider: r.provider || "Unknown",
      status: r.status || "available",
      assigned_user: r.assigned_user || null,
      latest_assigned_date: r.latest_assigned_date
        ? new Date(r.latest_assigned_date).toISOString()
        : null,
      added_date: r.added_date ? new Date(r.added_date).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      handled_by_admin: r.handled_by_admin || null
    }));

    res.json(sims);
  } catch (err) {
    console.error("Fetch sims error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ POST /sims (add new SIM)
router.post("/", async (req, res) => {
  const { phone_number, provider } = req.body;

  // Admin name comes from JWT payload (set by authorizeRole in index.js)
  const adminName = req.user?.username || "system";

  if (!phone_number) {
    return res.status(400).json({ error: "phone_number is required" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO sim_inventory (phone_number, provider, status, handled_by_admin) 
       VALUES (?, ?, 'available', ?)`,
      [phone_number, provider || "Unknown", adminName]
    );

    res.status(201).json({
      sim_id: result.insertId,
      phone_number,
      provider: provider || "Unknown",
      status: "available",
      handled_by_admin: adminName
    });
  } catch (err) {
    console.error("Add SIM error:", err);
    res.status(500).json({ error: "Error adding SIM" });
  }
});



// POST /sims/bulk
router.post("/bulk", async (req, res) => {
  const { sims } = req.body; // sims = [{phone_number, provider}, ...]
  const adminName = req.user?.username || "system";

  if (!Array.isArray(sims) || sims.length === 0) {
    return res.status(400).json({ error: "No SIMs provided" });
  }

  try {
    const values = sims.map(s => [s.phone_number, s.provider || "Unknown", "available", adminName]);
    const sql = `
      INSERT INTO sim_inventory (phone_number, provider, status, handled_by_admin)
      VALUES ?
    `;
    const [result] = await pool.query(sql, [values]);

    res.status(201).json({
      insertedCount: result.affectedRows,
      handled_by_admin: adminName
    });
  } catch (err) {
    console.error("Bulk Add SIMs Error:", err);
    res.status(500).json({ error: "Failed to add SIMs" });
  }
});




export default router;
