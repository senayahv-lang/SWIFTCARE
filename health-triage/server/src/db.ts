import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/triage.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS triage_sessions (
      id TEXT PRIMARY KEY,
      patient_hash TEXT NOT NULL,
      age_group TEXT NOT NULL,
      language TEXT NOT NULL,
      malaria_result TEXT NOT NULL,
      malaria_risk_level TEXT,
      other_disease TEXT,
      other_disease_result TEXT,
      symptoms_summary TEXT,
      recommendation TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_contact TEXT NOT NULL,
      message_preview TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      FOREIGN KEY (session_id) REFERENCES triage_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_created ON triage_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_malaria ON triage_sessions(malaria_result);
  `);

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);

  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 12);
    db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)').run(
      crypto.randomUUID(),
      adminUser,
      hash
    );
    console.log(`Admin user created: ${adminUser}`);
  }
}
