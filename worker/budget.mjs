export const LIMITS = Object.freeze({
  perVisitorDaily: 5,
  daily: 50,
  monthly: 1_000,
  concurrent: 4,
});
const LEASE_MS = 30_000;

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
    const nextMonth = Date.UTC(year, month + 1, 1);
    const windows = [
      [`visitor:${visitor}`, tomorrow, LIMITS.perVisitorDaily],
      ["daily", tomorrow, LIMITS.daily],
      ["monthly", nextMonth, LIMITS.monthly],
    ];

    // All quota checks and reservations share one SQLite transaction, including concurrency.
    return this.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM counts WHERE expires <= ?", now);
      this.sql.exec("DELETE FROM leases WHERE expires <= ?", now);

      for (const [key, expires, limit] of windows) {
        const currentCount = this.sql.exec("SELECT used FROM counts WHERE key = ?", key).toArray()[0]?.used ?? 0;
        if (currentCount >= limit) {
          return { retryAfter: Math.ceil((expires - now) / 1_000) };
        }
      }

      const inFlight = this.sql.exec("SELECT COUNT(*) AS count FROM leases").one().count;
      if (inFlight >= LIMITS.concurrent) return { retryAfter: 15 };

      for (const [key, expires] of windows) {
        this.sql.exec(
          "INSERT INTO counts (key, expires, used) VALUES (?, ?, 1) ON CONFLICT (key) DO UPDATE SET used = used + 1",
          key, expires,
        );
      }

      const lease = crypto.randomUUID();
      this.sql.exec("INSERT INTO leases (id, expires) VALUES (?, ?)", lease, now + LEASE_MS);
      return { lease };
    });
  }

  release(lease) {
    this.sql.exec("DELETE FROM leases WHERE id = ?", lease);
  }
}
