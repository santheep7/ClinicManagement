import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import authRoutes from "./Routes/authRoutes";
import patientRoutes from "./Routes/patientRoutes";
import clinicRoutes from "./Routes/clinicRoutes";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/clinics", clinicRoutes);

// Error handling middleware (Fixed explicit type imports)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// Mock/Placeholder function for DB connection
// Replace this logic with your actual DB connection (e.g., mongoose.connect or prisma.$connect)
async function connectDatabase() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log("🚀 Database connected successfully!");
      resolve();
    }, 500); 
  });
}

async function startServer() {
  // 1. Connect to the database first
  await connectDatabase();

  // 2. Start the Express server only if DB connection succeeds
  app.listen(PORT, () => {
    console.log(`💻 Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Unable to start server:", error);
  process.exit(1);
});