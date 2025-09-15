// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // ✅ MySQL connection pool

const router = express.Router();


// ✅ GET /users
// Example call: /users?page=1&limit=50
// Fetch all users with pagination + phone assignment details (if assigned)
router.get('/', async (req, res) => {
  // Parse pagination params (defaults: page 1, 10 results per page)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // SQL: Fetch user details + latest active SIM assignment (if exists)
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

  // SQL: Count total users for pagination metadata
  const countQuery = `SELECT COUNT(*) AS total FROM users1`;

  try {
    const [rows] = await pool.query(query, [limit, offset]);
    const [countResult] = await pool.query(countQuery);

    res.json({
      users: rows,                             // ✅ List of users
      total: countResult[0].total,             // ✅ Total count of users
      page,                                    // ✅ Current page
      limit,                                   // ✅ Limit per page
      totalPages: Math.ceil(countResult[0].total / limit), // ✅ Total pages
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).send("Server Error");
  }
});


// ✅ GET /users/max-bio
// Fetch maximum biometric_id currently in the table
// Useful to safely generate next biometric ID from backend
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


// ✅ POST /users
// Create a new user (employee onboarding)
// Auto-generates a sequential numeric biometric_id
router.post("/", async (req, res) => {
  try {
    const { name, branch, office_number, department, official_email } = req.body;

    // 1️⃣ Get current max biometric_id and increment by 1
    const [rows] = await pool.query("SELECT MAX(biometric_id) AS max FROM users1");
    const nextBio = (rows[0].max || 0) + 1;

    // 2️⃣ Validate biometric_id limit
    if (nextBio > 9999) {
      return res.status(400).json({ error: "Biometric ID limit reached (9999)" });
    }

    // 3️⃣ Validate required fields
    if (!name || !branch) {
      return res.status(400).json({ error: "Missing required fields: name and branch are required" });
    }

    // 4️⃣ Insert new user record
    const insertQuery = `
      INSERT INTO users1 (name, branch, office_number, department, biometric_id, official_email)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(insertQuery, [
      name, branch, office_number, department, nextBio, official_email
    ]);

    // 5️⃣ Respond with newly created user details
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
