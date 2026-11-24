import { ATTEMPT_RESERVE_MICROS, MONTHLY_BUDGET_MICROS } from "./cost.mjs";

export const LIMITS = Object.freeze({
  perVisitorDaily: 5,
  daily: 50,
  monthly: 1_000,
  concurrent: 4,
});
const LEASE_MS = 30_000;

function endOfMonth(now) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export class BudgetLedger {
  constructor(storage) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS counts (
      key TEXT PRIMARY KEY, expires INTEGER NOT NULL, used INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leases (
      id TEXT PRIMARY KEY, expires INTEGER NOT NULL
    )`);
  }

  reserve(visitor, now) {
    const current = new Date(now);
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth();
    const tomorrow = Date.UTC(year, month, current.getUTCDate() + 1);
    const nextMonth = endOfMonth(now);
    const windows = [
      [`visitor:${visitor}`, tomorrow, LIMITS.perVisitorDaily, 1],
      ["daily", tomorrow, LIMITS.daily, 1],
      ["monthly", nextMonth, LIMITS.monthly, 1],
      ["monthly-spend", nextMonth, MONTHLY_BUDGET_MICROS, ATTEMPT_RESERVE_MICROS],
    ];

    // All quota checks and reservations share one SQLite transaction, including concurrency.
    return this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM counts WHERE expires <= ?", now);
      this.sql.exec("DELETE FROM leases WHERE expires <= ?", now);

      if (this.sql.exec("SELECT 1 FROM counts WHERE key = 'paused'").toArray().length) {
        return { retryAfter: Math.ceil((nextMonth - now) / 1_000) };
      }

      for (const [key, expires, limit, amount] of windows) {
        const currentCount = this.sql.exec("SELECT used FROM counts WHERE key = ?", key).toArray()[0]?.used ?? 0;
        if (currentCount + amount > limit) {
          return { retryAfter: Math.ceil((expires - now) / 1_000) };
        }
      }

      const inFlight = this.sql.exec("SELECT COUNT(*) AS count FROM leases").one().count;
      if (inFlight >= LIMITS.concurrent) return { retryAfter: 15 };

      for (const [key, expires, , amount] of windows) {
        this.sql.exec(
          "INSERT INTO counts (key, expires, used) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET used = used + excluded.used",
          key, expires, amount,
        );
      }

      const lease = crypto.randomUUID();
      this.sql.exec("INSERT INTO leases (id, expires) VALUES (?, ?)", lease, now + LEASE_MS);
      return { lease };
    });
  }

  release(lease, pause, now) {
    this.storage.transactionSync(() => {
      if (pause) {
        this.sql.exec(
          "INSERT INTO counts (key, expires, used) VALUES ('paused', ?, 1) ON CONFLICT (key) DO UPDATE SET expires = excluded.expires",
          endOfMonth(now),
        );
      }
      this.sql.exec("DELETE FROM leases WHERE id = ?", lease);
    });
  }
}
