import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ 
  adapter,
  log: ['query', 'error', 'warn'],
});

prisma.$connect().catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

