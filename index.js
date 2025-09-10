// index.js
import express from "express";
import dotenv from "dotenv";

// Import routes
import usersRoute from "./routes/users.js";
import simsRoute from "./routes/sims.js";
import assignRoute from "./routes/assign.js";
import swapRoute from "./routes/swap.js";
import exitRoute from "./routes/exit.js";
import allUsers from "./routes/allUsers.js";

// import reports
import activeUsers from "./reports/activeUsers.js";

dotenv.config();

const app = express();

// PORT value fallback to 4000
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Mount routes
app.use("/users", usersRoute); 
app.use("/sims", simsRoute);     
app.use("/assign", assignRoute); 
app.use("/swap", swapRoute);     
app.use("/exit", exitRoute);    
app.use("/allUsers", allUsers); 

// mount reports user the endpoints
app.use("/activeUsers", activeUsers);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
