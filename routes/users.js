// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // import the MySQL pool

const router = express.Router();

// ✅ Get all users (with phone number if assigned)
router.get('/', async (req, res) => {
  const query = `
    SELECT 
      u.user_id,
      u.name,
      u.branch,
      u.department,
      u.office_number,
      u.official_email,
      u.biometric_id,
      u.status,
      u.created_at,
      u.updated_at,
      s.phone_number,
      sa.assigned_at
    FROM users1 u
    LEFT JOIN sim_assignment sa 
      ON u.user_id = sa.user_id
      AND sa.active = 1
      AND sa.assigned_at = (
        SELECT MAX(sa2.assigned_at)
        FROM sim_assignment sa2
        WHERE sa2.user_id = u.user_id AND sa2.active = 1
      )
    LEFT JOIN sim_inventory s 
      ON sa.sim_id = s.sim_id;
  `;

  try {
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Add user (onboarding)
router.post('/', async (req, res) => {
  const { name, branch, office_number, department, biometric_id, official_email } = req.body;

  // 🔒 Basic validations
  if (!name || !branch) {
    return res.status(400).json({ error: "Missing required fields: name and branch are required" });
  }

  const insertUserQuery = `
    INSERT INTO users1 (name, branch, office_number, department, biometric_id, official_email)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  try {
    // Execute insert
    const [result] = await pool.query(insertUserQuery, [
      name,
      branch,
      office_number,
      department,
      biometric_id,
      official_email,
    ]);

    // Fetch the inserted user by user_id
    const [rows] = await pool.query("SELECT * FROM users1 WHERE user_id = ?", [result.insertId]);

    res.status(201).json(rows[0]); // return the new row
  } catch (err) {
    console.error("Insert user error:", err);
    res.status(500).send("Error inserting user");
  }
});

export default router;
