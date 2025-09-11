import express from 'express';
import pool from '../db/db.js'; // import the pool


const router = express.Router();

// GET all users
// router.get("/", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT * FROM acolyte.users");
//     res.json(result.rows); // send all users as JSON
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send("Server Error");
//   }
// });

// GET all users
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users1"); 
    res.json(rows); // send rows only for MySQL
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});


export default router;