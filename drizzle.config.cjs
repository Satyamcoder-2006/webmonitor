require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

module.exports = {
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
}; 