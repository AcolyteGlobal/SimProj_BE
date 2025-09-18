// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // ✅ MySQL connection pool

const router = express.Router();

//// FOR POST USERS
/* ---------------- AUTH MIDDLEWARE ---------------- */
// ✅ Decodes JWT and attaches user to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // ✅ attach decoded user
    next();
  });
}
////

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
    u.handled_by_admin,        -- ✅ Include this
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

    // Admin username from JWT payload
    const adminName = req.user?.username || "system";

    // 1️⃣ Validate required fields
    if (!name || !branch) {
      return res.status(400).json({ error: "Missing required fields: name and branch are required" });
    }

    // 2️⃣ Get current max biometric_id and increment by 1
    const [rows] = await pool.query("SELECT MAX(biometric_id) AS max FROM users1");
    const nextBio = (rows[0].max || 0) + 1;

    // 3️⃣ Validate biometric_id limit
    if (nextBio > 9999) {
      return res.status(400).json({ error: "Biometric ID limit reached (9999)" });
    }

    // 4️⃣ Insert new user record (include handled_by_admin)
    const insertQuery = `
      INSERT INTO users1 
        (name, branch, office_number, department, biometric_id, official_email, handled_by_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(insertQuery, [
      name, branch, office_number, department, nextBio, official_email, adminName
    ]);

    // 5️⃣ Respond with newly created user details (HTTP 201)
    return res.status(201).json({ 
      user_id: result.insertId, 
      biometric_id: nextBio, 
      name, 
      branch, 
      office_number, 
      department, 
      official_email,
      handled_by_admin: adminName
    });

  } catch (err) {
    console.error("Insert user error:", err);

    // ✅ Handle duplicate entry (email or biometric_id)
    if (err.code === "ER_DUP_ENTRY") {
      let field = "";
      if (err.sqlMessage.includes("official_email")) field = "Email";
      else if (err.sqlMessage.includes("biometric_id")) field = "Biometric ID";
      return res.status(400).json({ error: `${field} already exists!` });
    }

    // Other errors
    return res.status(500).json({ error: "Failed to insert user", details: err.message });
  }
});



export default router;


