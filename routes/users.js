// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // ✅ MySQL connection pool

const router = express.Router();



////

// ✅ GET /users
// Example call: /users?page=1&limit=50
// Fetch all users with pagination + phone assignment details (if assigned)

// ✅ GET /users
// Returns paginated users with optional search, active filter, department filter
// Includes latest assigned SIM (if any)
router.get("/", async (req, res) => {
  try {
    // --- Parse query params ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const active = req.query.active === "true";
    let department = (req.query.department || "").trim().toLowerCase();

    // Department alias example
    if (department === "finance") department = "accounts";

    // --- Base WHERE clause ---
    let whereClauses = [];
    let values = [];

    if (active) whereClauses.push("status = 'active'");
    if (department) {
      whereClauses.push("LOWER(department) = ?");
      values.push(department);
    }
    if (search) {
      const like = `${search}%`; // prefix search
      whereClauses.push("(" +
        ["user_id","name","branch","office_number","department","biometric_id","official_email","status","handled_by_admin"]
          .map(col => `${col} LIKE ?`).join(" OR ") +
        ")");
      for (let i = 0; i < 9; i++) values.push(like);
    }

    const whereSQL = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

    // --- Main Query ---
    const query = `
      SELECT 
        u.user_id,
        u.name,
        u.branch,
        u.office_number,
        u.department,
        u.biometric_id,
        u.official_email,
        u.status,
        u.created_at,
        u.updated_at,
        u.handled_by_admin,
        s.phone_number
      FROM (
        SELECT * 
        FROM users1
        ${whereSQL}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) u
      LEFT JOIN sim_assignment sa ON u.user_id = sa.user_id AND sa.active = 1
      LEFT JOIN sim_inventory s ON sa.sim_id = s.sim_id
    `;

    // Push limit+offset
    values.push(limit, offset);

    const [users] = await pool.query(query, values);

    // --- Count Query ---
    let countSQL = `SELECT COUNT(*) AS total FROM users1 ${whereSQL}`;
    const [countRows] = await pool.query(countSQL, values.slice(0, -2)); // exclude limit+offset
    const total = countRows[0].total;

    res.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Server Error" });
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


