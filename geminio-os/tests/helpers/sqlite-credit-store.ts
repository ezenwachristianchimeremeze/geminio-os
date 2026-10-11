import { DatabaseSync } from "./sqlite";
import type { Account, CreditStore, CreditTx, LedgerEntry, Reservation } from "../../server/credits/ledger";

/** TEST-ONLY SQLite adapter (real BEGIN/COMMIT/ROLLBACK). A mutex stands in for SELECT ... FOR UPDATE. Not the production adapter. */
export class SqliteCreditStore implements CreditStore {
  readonly db = new DatabaseSync(":memory:");
  private queue: Promise<unknown> = Promise.resolve();
  failOnLedgerInsert = false;
  constructor() {
    this.db.exec(`
      CREATE TABLE accounts (userId INTEGER PRIMARY KEY, balance INTEGER NOT NULL CHECK (balance >= 0), reserved INTEGER NOT NULL CHECK (reserved >= 0));
      CREATE TABLE reservations (id TEXT PRIMARY KEY, userId INTEGER NOT NULL, requestId TEXT NOT NULL, capability TEXT NOT NULL, amount INTEGER NOT NULL, charged INTEGER NOT NULL, status TEXT NOT NULL, UNIQUE (userId, requestId));
      CREATE TABLE ledger (seq INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, balanceAfter INTEGER NOT NULL, capability TEXT, referenceId TEXT NOT NULL);
    `);
  }
  seed(userId: number, balanceMicro: number) { this.db.prepare("INSERT OR REPLACE INTO accounts VALUES (?,?,0)").run(userId, balanceMicro); }
  account(userId: number) { return this.db.prepare("SELECT * FROM accounts WHERE userId=?").get(userId) as unknown as Account | undefined; }
  ledger(userId: number) { return this.db.prepare("SELECT * FROM ledger WHERE userId=? ORDER BY seq").all(userId) as unknown as LedgerEntry[]; }

  transaction<T>(fn: (tx: CreditTx) => Promise<T>): Promise<T> {
    const run = async () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const out = await fn(this.tx());
        this.db.exec("COMMIT");
        return out;
      } catch (e) { this.db.exec("ROLLBACK"); throw e; }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
  private tx(): CreditTx {
    const db = this.db;
    const row = (r: any): Reservation | null => (r ? { id: r.id, userId: r.userId, requestId: r.requestId, capability: r.capability, amount: r.amount, charged: r.charged, status: r.status } : null);
    return {
      lockAccount: async (userId) => {
        let a = db.prepare("SELECT * FROM accounts WHERE userId=?").get(userId) as any;
        if (!a) { db.prepare("INSERT INTO accounts VALUES (?,0,0)").run(userId); a = { userId, balance: 0, reserved: 0 }; }
        return { userId: a.userId, balance: a.balance, reserved: a.reserved };
      },
      saveAccount: async (a) => { db.prepare("UPDATE accounts SET balance=?, reserved=? WHERE userId=?").run(a.balance, a.reserved, a.userId); },
      getReservationByRequest: async (u, r) => row(db.prepare("SELECT * FROM reservations WHERE userId=? AND requestId=?").get(u, r)),
      getReservation: async (id) => row(db.prepare("SELECT * FROM reservations WHERE id=?").get(id)),
      insertReservation: async (r) => { db.prepare("INSERT INTO reservations VALUES (?,?,?,?,?,?,?)").run(r.id, r.userId, r.requestId, r.capability, r.amount, r.charged, r.status); },
      updateReservation: async (r) => { db.prepare("UPDATE reservations SET charged=?, status=? WHERE id=?").run(r.charged, r.status, r.id); },
      insertLedger: async (e: LedgerEntry) => {
        if (this.failOnLedgerInsert) throw new Error("ledger write failed");
        db.prepare("INSERT INTO ledger (userId,kind,amount,balanceAfter,capability,referenceId) VALUES (?,?,?,?,?,?)").run(e.userId, e.kind, e.amount, e.balanceAfter, e.capability, e.referenceId);
      },
    };
  }
}
