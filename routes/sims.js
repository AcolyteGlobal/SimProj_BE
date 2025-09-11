// routes/assign.js
import express from 'express';
import pool from '../db/db.js'; // MySQL pool

const router = express.Router();

// ✅ GET all SIMs
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM sim_inventory");
    res.json(rows);
  } catch (err) {
    console.error("Fetch SIMs error:", err);
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
