import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Fallback URL satisfies Prisma 7 validation during `prisma generate` at
    // Docker build time (no env_file available). At runtime, env_file injects
    // the real DATABASE_URL which overrides the fallback via process.env.
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/library_dev",
  },
});
