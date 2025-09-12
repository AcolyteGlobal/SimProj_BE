// routes/assign.js
import express from 'express';
import pool from '../db/db.js'; // MySQL pool

const router = express.Router();

// ✅ GET all SIMs
// router.get('/', async (req, res) => {
//   try {
//     const [rows] = await pool.query("SELECT * FROM sim_inventory");
//     res.json(rows);
//   } catch (err) {
//     console.error("Fetch SIMs error:", err);
//     res.status(500).send("Server Error");
//   }
// });
// routes/sims.js


// ✅ Get all sims (with provider + assigned user name via join)
router.get("/", async (req, res) => {

  try {

    const query = `

      SELECT 

        si.sim_id,

        si.phone_number,

        

        si.status AS sim_status,

        si.added_date,

        si.updated_at,

        u.name AS assigned_user

      FROM sim_inventory si

      LEFT JOIN sim_assignment sa 

        ON si.sim_id = sa.sim_id AND sa.active = 1   -- only active assignment

      LEFT JOIN users1 u 

        ON sa.user_id = u.user_id

      ORDER BY si.sim_id ASC

    `;



    const [rows] = await pool.query(query);



    // Shape the result

    const sims = rows.map(r => ({

      sim_id: r.sim_id,

      phone_number: r.phone_number,

      // provider: r.provider || null,

      // if user assigned, show "assigned", otherwise keep DB status

      status: r.assigned_user ? "assigned" : (r.sim_status || "unknown"),

      assigned_user: r.assigned_user || null,

      added_date: r.added_date ? new Date(r.added_date).toISOString() : null,

      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,

    }));



    res.json(sims);

  } catch (err) {

    console.error("Fetch sims error:", err);

    res.status(500).send("Server Error");

  }

});



// ✅ POST /assign → assign/add a SIM to inventory
router.post('/', async (req, res) => {
  const { phone_number } = req.body;

  // 🔒 Validation
  if (!phone_number) {
    return res.status(400).json({ error: "Missing required field: phone_number" });
  }
  if (!/^\d+$/.test(phone_number)) {
    return res.status(400).json({ error: "Invalid phone number: must contain only digits" });
  }

  const insertSimQuery = `
    INSERT INTO sim_inventory (phone_number)
    VALUES (?);
  `;

  try {
    // Insert SIM into inventory
    const [result] = await pool.query(insertSimQuery, [phone_number]);

    // Fetch full inserted row
    const [rows] = await pool.query("SELECT * FROM sim_inventory WHERE sim_id = ?", [result.insertId]);

    res.status(201).json(rows[0]); // return inserted SIM
  } catch (err) {
    console.error("Insert SIM error:", err);
    res.status(500).send("Error inserting SIM");
  }
});

export default router;
