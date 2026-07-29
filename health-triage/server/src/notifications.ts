import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { db } from './db.js';

export type RecipientType = 'doctor' | 'pharmacist';

export interface NotificationPayload {
  sessionId: string;
  recipientType: RecipientType;
  patientRef: string;
  malariaResult: string;
  riskLevel: string;
  recommendation: string;
  language: string;
}

function buildMessage(payload: NotificationPayload): string {
  return [
    '[Health Triage Alert]',
    `Patient Ref: ${payload.patientRef}`,
    `Malaria: ${payload.malariaResult.toUpperCase()}`,
    `Risk: ${payload.riskLevel}`,
    `Action: ${payload.recommendation}`,
    `Session: ${payload.sessionId.slice(0, 8)}`,
    '— No personal identifiers included (privacy-preserving)',
  ].join('\n');
}

async function sendViaSmtp(to: string, subject: string, body: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[NOTIFY - DEV MODE] To: ${to}\nSubject: ${subject}\n${body}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'triage@health.local',
      to,
      subject,
      text: body,
    });
    return true;
  } catch (err) {
    console.error('SMTP send failed:', err);
    return false;
  }
}

export async function notifyClinician(payload: NotificationPayload): Promise<{ sent: boolean; id: string }> {
  const id = uuidv4();
  const contact =
    payload.recipientType === 'doctor'
      ? process.env.NOTIFY_EMAIL_DOCTOR || 'doctor@clinic.local'
      : process.env.NOTIFY_EMAIL_PHARMACIST || 'pharmacy@clinic.local';

  const message = buildMessage(payload);
  const preview = message.slice(0, 120);

  db.prepare(
    `INSERT INTO notifications (id, session_id, recipient_type, recipient_contact, message_preview, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(id, payload.sessionId, payload.recipientType, contact, preview);

  const sent = await sendViaSmtp(
    contact,
    `Malaria ${payload.malariaResult} — ${payload.patientRef}`,
    message
  );

  db.prepare(
    `UPDATE notifications SET status = ?, sent_at = datetime('now') WHERE id = ?`
  ).run(sent ? 'sent' : 'failed', id);

  if (sent) {
    db.prepare('UPDATE triage_sessions SET notified = 1 WHERE id = ?').run(payload.sessionId);
  }

  return { sent, id };
}
