import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // FIXED: Prisma 7 migration CLI searches specifically for datasource.url here
  datasource: {
    url: process.env.DIRECT_URL,
  },
});