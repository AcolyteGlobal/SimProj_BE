import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// Add user (onboarding)
router.post('/', async (req, res) => {

  const { name, branch, office_number, department, biometric_id, official_email } = req.body;

  const insertUserQuery = `
    INSERT INTO users (name, branch, office_number, department, biometric_id, official_email)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  try {
    const result = await pool.query(insertUserQuery, [
      name,
      branch,
      office_number,
      department,
      biometric_id,
      official_email,
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error inserting user");
  }
});


export default router;