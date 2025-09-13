import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// ✅ Serve static assets (CSS/JS/images)
app.use("/public", express.static(path.join(__dirname, "public")));

// ---------------- MIDDLEWARE ----------------
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };
}

// ---------------- ROUTES ----------------

// ✅ Serve ONE page only (index.html)
// This contains login + dashboard UI toggled by JS
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Login API (AJAX POST from frontend)
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign(
      { user: username, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({ token });
  }

  res.status(401).json({ error: "Invalid username or password" });
});

// ✅ Protected API for dashboard data
app.get("/api/dashboard", authorizeRole(["admin"]), (req, res) => {
  res.json({ message: "Welcome to the protected dashboard data!" });
});

// ---------------- MOUNT YOUR ROUTES ----------------
import usersRoute from "./routes/users.js";
import simsRoute from "./routes/sims.js";
import assignRoute from "./routes/assign.js";
import swapRoute from "./routes/swap.js";
import exitRoute from "./routes/exit.js";
import allUsers from "./routes/allUsers.js";
import activeUsers from "./reports/activeUsers.js";
import toggleActive from "./routes/toggleActive.js";

// app.use("/users", usersRoute);
// app.use("/sims", simsRoute);
// app.use("/assign", assignRoute);
// app.use("/swap", swapRoute);
// app.use("/exit", exitRoute);
// app.use("/allUsers", allUsers);
// app.use("/activeUsers", activeUsers);
// app.use("/toggleActive", toggleActive);

// Protect routes that need login
app.use("/users", authorizeRole(["admin"]), usersRoute);
app.use("/sims", authorizeRole(["admin"]), simsRoute);
app.use("/assign", authorizeRole(["admin"]), assignRoute);
app.use("/swap", authorizeRole(["admin"]), swapRoute);
app.use("/exit", authorizeRole(["admin"]), exitRoute);
app.use("/allUsers", authorizeRole(["admin"]), allUsers);
app.use("/activeUsers", authorizeRole(["admin"]), activeUsers);
app.use("/toggleActive", authorizeRole(["admin"]), toggleActive);


// ---------------- SERVER ----------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
