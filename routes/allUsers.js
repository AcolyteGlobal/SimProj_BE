import express from 'express';
import pool from '../db/db.js'; // import the pool

const router = express.Router();

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows); // send all users as JSON
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});


export default router;