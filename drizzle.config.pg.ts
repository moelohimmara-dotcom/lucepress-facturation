import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "./drizzle/schema.pg.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
