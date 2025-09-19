// routes/users.js
import express from 'express';
import pool from '../db/db.js'; // ✅ MySQL connection pool

const router = express.Router();

// ✅ GET /users/max-bio
router.get("/max-bio", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT MAX(CAST(biometric_id AS UNSIGNED)) AS maxBio
      FROM users1
      WHERE biometric_id REGEXP '^[0-9]+$'
    `);

    const maxBio = rows[0]?.maxBio || 0;
    res.json({ maxBiometricId: maxBio, nextBiometricId: maxBio + 1 });
  } catch (err) {
    console.error("Fetch max biometric_id error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ POST /users (auto-generate biometric_id)
router.post("/", async (req, res) => {
  const { name, branch, office_number, department, official_email } = req.body;
  const adminName = req.user?.username || "system";

  if (!name || !official_email) {
    return res.status(400).json({ error: "Name and Official Email are required" });
  }

  try {
    // get next biometric_id
    const [rows] = await pool.query(`
      SELECT MAX(CAST(biometric_id AS UNSIGNED)) AS maxBio
      FROM users1
      WHERE biometric_id REGEXP '^[0-9]+$'
    `);
    const nextBioId = (rows[0]?.maxBio || 0) + 1;

    const [result] = await pool.query(
      `INSERT INTO users1 
        (name, branch, office_number, department, biometric_id, official_email, status, handled_by_admin) 
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      [name, branch || null, office_number || null, department || null, nextBioId, official_email, adminName]
    );

    res.status(201).json({
      user_id: result.insertId,
      name,
      branch,
      office_number,
      department,
      biometric_id: nextBioId,
      official_email,
      status: "active",
      handled_by_admin: adminName
    });
  } catch (err) {
    console.error("Add user error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Error adding user" });
  }
});

// ✅ POST /users/bulk (auto-generate biometric_id for each user)
router.post("/bulk", async (req, res) => {
  const { users } = req.body;
  const adminName = req.user?.username || "system";

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: "No users provided" });
  }

  try {
    // get starting point for biometric sequence
    const [rows] = await pool.query(`
      SELECT MAX(CAST(biometric_id AS UNSIGNED)) AS maxBio
      FROM users1
      WHERE biometric_id REGEXP '^[0-9]+$'
    `);
    let nextBioId = (rows[0]?.maxBio || 0) + 1;

    const values = users.map(u => [
      u.name,
      u.branch || null,
      u.office_number || null,
      u.department || null,
      nextBioId++,   // auto increment biometric_id
      u.official_email,
      "active",
      adminName
    ]);

    const sql = `
      INSERT INTO users1
      (name, branch, office_number, department, biometric_id, official_email, status, handled_by_admin)
      VALUES ?
    `;
    const [result] = await pool.query(sql, [values]);

    res.status(201).json({
      insertedCount: result.affectedRows,
      handled_by_admin: adminName
    });
  } catch (err) {
    console.error("Bulk add users error:", err);
    res.status(500).json({ error: "Failed to add users" });
  }
});



// ✅ GET /users/paginated?page=1&limit=10
// Fetch users with optional SIM assignment details



///

/**
 * GET /users
 * Returns paginated users with optional search, active filter, and department filter
 * Includes latest assigned SIM (if any)
 * Query Params:
 *  - page: page number (default 1)
 *  - limit: rows per page (default 10)
 *  - search: string to search across all columns
 *  - active: "true" for only active users
 *  - department: filter by department
 */
// GET /users
// Fetch users with pagination, search, status filter, department filter, and SIM numbers
router.get("/", async (req, res) => {
  try {
    // --- Parse query params ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let search = (req.query.search || "").trim();
    const active = req.query.active === "true";
    let department = (req.query.department || "").trim().toLowerCase();

    // Map department alias
    if (department === "finance") department = "accounts";

    // --- Base query: filter users first, then join SIMs ---
    let query = `
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
        WHERE 1
        ${active ? "AND status = 'active'" : ""}
        ${department ? "AND LOWER(department) = ?" : ""}
        ${search ? "AND (" +
          ["user_id","name","branch","office_number","department","biometric_id","official_email","status","handled_by_admin"]
            .map(col => `${col} LIKE ?`).join(" OR ") +
          ")" : ""}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) u
      LEFT JOIN sim_assignment sa ON u.user_id = sa.user_id AND sa.active = 1
      LEFT JOIN sim_inventory s ON sa.sim_id = s.sim_id
    `;

    // --- Build values for prepared statement ---
    const values = [];
    if (department) values.push(department);
    if (search) {
      const pattern = `${search}%`; // prefix search, can use index
      for (let i = 0; i < 9; i++) values.push(pattern);
    }
    values.push(limit, offset);

    // --- Execute query ---
    const [users] = await pool.query(query, values);

    // --- Count total users for pagination ---
    let countQuery = `SELECT COUNT(*) AS total FROM users1 WHERE 1`;
    const countValues = [];
    if (active) countQuery += ` AND status = 'active'`;
    if (department) {
      countQuery += ` AND LOWER(department) = ?`;
      countValues.push(department);
    }
    if (search) {
      countQuery += " AND (" +
        ["user_id","name","branch","office_number","department","biometric_id","official_email","status","handled_by_admin"]
          .map(col => `${col} LIKE ?`).join(" OR ") + ")";
      const pattern = `${search}%`;
      for (let i = 0; i < 9; i++) countValues.push(pattern);
    }

    const [countRows] = await pool.query(countQuery, countValues);
    const total = countRows[0].total;

    res.json({ users, total, page, limit });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});




export default router;



