import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// POST /exit user
router.post("/", async (req, res) => {
  const { user_id, reason, admin } = req.body;

  const exitLogQuery = `
    INSERT INTO exit_log (user_id, reason, biometric_id, phone_number, handled_by_admin)
    VALUES ($1, $2,
      (SELECT biometric_id FROM users WHERE user_id = $1),
      (SELECT phone_number FROM sim_inventory WHERE sim_id = (
         SELECT sim_id FROM sim_assignment WHERE user_id = $1 AND active = TRUE LIMIT 1
      )),
      $3
    )
    RETURNING *;
  `;

  const deactivateUserQuery = `
    UPDATE users SET status = 'inactive' WHERE user_id = $1;
  `;

  const freeSimQuery = `
    UPDATE sim_inventory
    SET status = 'inactive'
    WHERE sim_id = (
      SELECT sim_id FROM sim_assignment WHERE user_id = $1 AND active = TRUE LIMIT 1
    );
  `;

  const deleteSimQuery = `
    DELETE FROM sim_inventory
    WHERE sim_id = (
      SELECT sim_id FROM sim_assignment WHERE user_id = $1 AND active = FALSE LIMIT 1
    )
    AND status IN ('inactive','out_of_service');
  `;

  try {
    await pool.query("BEGIN");
    const exitLog = await pool.query(exitLogQuery, [user_id, reason, admin]);
    await pool.query(deactivateUserQuery, [user_id]);
    await pool.query(freeSimQuery, [user_id]);
    await pool.query(deleteSimQuery, [user_id]);
    await pool.query("COMMIT");
    res.json(exitLog.rows[0]);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Error processing exit");
  }
});

export default router;
