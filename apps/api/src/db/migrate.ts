import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationDir = path.join(__dirname, "sql");

async function run() {
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        id serial primary key,
        filename text unique not null,
        executed_at timestamptz not null default now()
      );
    `);

    const files = (await readdir(migrationDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const alreadyApplied = await client.query("select 1 from schema_migrations where filename = $1", [file]);
      if (alreadyApplied.rowCount) {
        continue;
      }

      const sql = await readFile(path.join(migrationDir, file), "utf8");
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`Applied migration: ${file}`);
    }

    console.log("Migrations complete.");
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
