import pg from "pg";
import { env } from "../config/env";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});
