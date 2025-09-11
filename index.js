import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import usersRoute from "./routes/users.js";
import simsRoute from "./routes/sims.js";
import assignRoute from "./routes/assign.js";
import swapRoute from "./routes/swap.js";
import exitRoute from "./routes/exit.js";
import allUsers from "./routes/allUsers.js";
import activeUsers from "./reports/activeUsers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve static files

// Mount routes
app.use("/users", usersRoute); 
app.use("/sims", simsRoute);     
app.use("/assign", assignRoute); 
app.use("/swap", swapRoute);     
app.use("/exit", exitRoute);    
app.use("/allUsers", allUsers); 
app.use("/activeUsers", activeUsers);

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
