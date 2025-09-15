// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // import the MySQL pool

const router = express.Router();


// Example call: /users?page=1&limit=50
// ✅ Get all users (with phone number if assigned)
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const query = `
    SELECT 
      u.user_id, u.name, u.branch, u.department, u.office_number,
      u.official_email, u.biometric_id, u.status,
      u.created_at, u.updated_at,
      s.phone_number, sa.assigned_at
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
      ON sa.sim_id = s.sim_id
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?;
  `;

  const countQuery = `SELECT COUNT(*) AS total FROM users1`;

  try {
    const [rows] = await pool.query(query, [limit, offset]);
    const [countResult] = await pool.query(countQuery);

    res.json({
      users: rows,
      total: countResult[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult[0].total / limit),
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).send("Server Error");
  }
});

// Get max biometric_id from the users1 table
router.get("/max-bio", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT MAX(biometric_id) AS max FROM users1");
    const maxBio = rows[0].max || 0; // fallback to 0 if table is empty
    res.json({ max: maxBio });
  } catch (err) {
    console.error("Error fetching max biometric_id:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// ✅ Add user (onboarding)
// POST /users
router.post("/", async (req, res) => {
  try {
    const { name, branch, office_number, department, official_email } = req.body;

    // Generate next biometric_id in DB safely
    const [rows] = await pool.query("SELECT MAX(biometric_id) AS max FROM users1");
    const nextBio = (rows[0].max || 0) + 1;

      // 🔒 Basic validations
    if (nextBio > 9999) {
      return res.status(400).json({ error: "Biometric ID limit reached (9999)" });
    }

    
  if (!name || !branch) {

    return res.status(400).json({ error: "Missing required fields: name and branch are required" });

  }

    

    const insertQuery = `
      INSERT INTO users1 (name, branch, office_number, department, biometric_id, official_email)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(insertQuery, [
      name, branch, office_number, department, nextBio, official_email
    ]);

    res.json({ 
      user_id: result.insertId, 
      biometric_id: nextBio, 
      name, branch, office_number, department, official_email 
    });

  } catch (err) {
    console.error("Insert user error:", err);
    res.status(500).json({ error: "Failed to insert user" });
  }
});


export default router;
