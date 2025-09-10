import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// POST /assign → assign a SIM to a user
router.post('/', async (req, res) => {
  const { phone_number } = req.body;

  const insertSimQuery = `
    INSERT INTO sim_inventory (phone_number)
    VALUES ($1)
    RETURNING *;
  `;

  try {
    const result = await db.query(insertSimQuery, [phone_number]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error inserting SIM");
  }
});

export default router; 
