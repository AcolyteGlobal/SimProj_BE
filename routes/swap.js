import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// POST /assign → assign a SIM to a user
router.post('/', async (req, res) => {

  const { user_id, old_sim_id, new_sim_id, admin } = req.body;

  const logSwapQuery = `
    INSERT INTO swap_log (old_sim_id, new_sim_id, user_id, done_by_admin)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const deactivateOldQuery = `
    UPDATE sim_assignment
    SET active = FALSE, unassigned_at = NOW()
    WHERE user_id = $1 AND sim_id = $2;
  `;

  const assignNewQuery = `
    INSERT INTO sim_assignment (user_id, sim_id)
    VALUES ($1, $2)
    RETURNING *;
  `;

  try {
    await pool.query("BEGIN");
    await pool.query(deactivateOldQuery, [user_id, old_sim_id]);
    const newAssign = await pool.query(assignNewQuery, [user_id, new_sim_id]);
    const swapLog = await pool.query(logSwapQuery, [old_sim_id, new_sim_id, user_id, admin]);
    await pool.query("COMMIT");
    res.json({ newAssign: newAssign.rows[0], swapLog: swapLog.rows[0] });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error swapping SIM");
  }
});

export default router;
