import express from 'express';
import pool from '../db/db.js'; // MySQL pool

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
        si.updated_at
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
      latest_assigned_date: r.latest_assigned_date ? new Date(r.latest_assigned_date).toISOString() : null,
      added_date: r.added_date ? new Date(r.added_date).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null
    }));

    res.json(sims);
  } catch (err) {
    console.error("Fetch sims error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
