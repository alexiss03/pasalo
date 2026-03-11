import { pool } from "../db/pool";

async function run() {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const reminderRows = await client.query(
      `
      select id, owner_user_id,
        (extract(day from (now() - coalesce(last_confirmed_at, created_at))))::int as age_days
      from listings
      where status in ('live', 'paused')
        and extract(day from (now() - coalesce(last_confirmed_at, created_at))) in (23, 29)
      `,
    );

    for (const row of reminderRows.rows) {
      await client.query(
        `
        insert into notifications (user_id, channel, event_name, payload)
        values ($1, 'in_app', 'listing_reconfirm_reminder', $2::jsonb)
      `,
        [
          row.owner_user_id,
          JSON.stringify({ listingId: row.id, ageDays: row.age_days }),
        ],
      );
    }

    const expiredRows = await client.query(
      `
      update listings
      set status = 'expired', updated_at = now()
      where status in ('live', 'paused')
        and extract(day from (now() - coalesce(last_confirmed_at, created_at))) >= 30
      returning id, owner_user_id
      `,
    );

    for (const row of expiredRows.rows) {
      await client.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by)
        values ($1, 'live', 'expired', null)
      `,
        [row.id],
      );

      await client.query(
        `
        insert into notifications (user_id, channel, event_name, payload)
        values ($1, 'in_app', 'listing_auto_expired', $2::jsonb)
      `,
        [row.owner_user_id, JSON.stringify({ listingId: row.id })],
      );
    }

    await client.query("commit");

    console.log(
      JSON.stringify({
        remindersQueued: reminderRows.rowCount,
        listingsExpired: expiredRows.rowCount,
      }),
    );
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
