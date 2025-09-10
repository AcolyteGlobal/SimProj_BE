import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// POST /assign → assign a SIM to a user
router.post('/', async (req, res) => {
  const { user_id, sim_id } = req.body;

  const assignQuery = `
    INSERT INTO sim_assignment (user_id, sim_id)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const updateSimStatusQuery = `
    UPDATE sim_inventory SET status = 'assigned' WHERE sim_id = $1;
  `;

  try {
    await pool.query('BEGIN'); // start transaction

    const result = await pool.query(assignQuery, [user_id, sim_id]); // insert assignment
    await pool.query(updateSimStatusQuery, [sim_id]); // update SIM status

    await pool.query('COMMIT'); // commit transaction
    res.json(result.rows[0]); // return inserted row
  } catch (err) {
    await pool.query('ROLLBACK'); // rollback if error
    console.error(err.message);
    res.status(500).send('Error assigning SIM');
  }
});

export default router;
