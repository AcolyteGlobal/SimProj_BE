


import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

router.get('/', async (req, res) => {

    
  const query = `
    SELECT u.user_id, u.name, u.branch, u.department, u.office_number,
           u.official_email, u.biometric_id,
           s.phone_number, sa.assigned_at
    FROM acolyte.users1 u
    LEFT JOIN sim_assignment sa ON u.user_id = sa.user_id AND sa.active = TRUE
    LEFT JOIN sim_inventory s ON sa.sim_id = s.sim_id
    WHERE u.status = 'active';
  `;
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching active users");
  }
});



export default router;


