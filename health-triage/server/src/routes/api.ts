import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { hashPatientId, anonymizeSession, redactSymptoms } from '../privacy.js';
import { assessMalaria, assessOtherDisease, MalariaInput, OtherDiseaseInput } from '../triage/whoEngine.js';
import { notifyClinician } from '../notifications.js';

const router = Router();

interface AuthRequest extends Request {
  admin?: { id: string; username: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = header.slice(7);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    req.admin = jwt.verify(token, secret) as { id: string; username: string };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as
    | { id: string; username: string; password_hash: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' }
  );

  res.json({ token, username: user.username });
});

router.post('/triage', async (req, res) => {
  try {
    const {
      patientToken,
      ageGroup,
      language,
      malariaInput,
      otherDiseaseInput,
      recommendation,
    } = req.body as {
      patientToken: string;
      ageGroup: string;
      language: string;
      malariaInput: MalariaInput;
      otherDiseaseInput?: OtherDiseaseInput;
      recommendation?: string;
    };

    if (!patientToken || !ageGroup || !malariaInput) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const malariaAssessment = assessMalaria(malariaInput);
    let otherAssessment = null;

    if (otherDiseaseInput && malariaAssessment.result === 'negative') {
      otherAssessment = assessOtherDisease(otherDiseaseInput);
    }

    const id = uuidv4();
    const patientHash = hashPatientId(patientToken);

    const rec =
      recommendation ||
      malariaAssessment.recommendationKey +
        (otherAssessment ? ` | ${otherAssessment.recommendationKey}` : '');

    db.prepare(
      `INSERT INTO triage_sessions
       (id, patient_hash, age_group, language, malaria_result, malaria_risk_level,
        other_disease, other_disease_result, symptoms_summary, recommendation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      patientHash,
      ageGroup,
      language || 'en',
      malariaAssessment.result,
      malariaAssessment.riskLevel,
      otherDiseaseInput?.disease || null,
      otherAssessment?.result || null,
      JSON.stringify({ malaria: malariaInput.supportingSymptoms }),
      rec
    );

    let notification = null;
    if (malariaAssessment.notifyClinician) {
      const recipientType =
        malariaAssessment.riskLevel === 'critical' ? 'doctor' : 'pharmacist';
      notification = await notifyClinician({
        sessionId: id,
        recipientType,
        patientRef: `P-${patientHash.slice(0, 8).toUpperCase()}`,
        malariaResult: malariaAssessment.result,
        riskLevel: malariaAssessment.riskLevel,
        recommendation: rec,
        language: language || 'en',
      });
    }

    res.status(201).json({
      sessionId: id,
      malaria: malariaAssessment,
      other: otherAssessment,
      notification,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Triage processing failed' });
  }
});

router.post('/sync', async (req, res) => {
  const { sessions } = req.body as { sessions: Array<Record<string, unknown>> };
  if (!Array.isArray(sessions)) {
    return res.status(400).json({ error: 'sessions array required' });
  }

  const synced: string[] = [];
  for (const s of sessions) {
    try {
      const existing = db.prepare('SELECT id FROM triage_sessions WHERE id = ?').get(s.id);
      if (existing) {
        synced.push(String(s.id));
        continue;
      }

      db.prepare(
        `INSERT INTO triage_sessions
         (id, patient_hash, age_group, language, malaria_result, malaria_risk_level,
          other_disease, other_disease_result, symptoms_summary, recommendation, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        s.id,
        s.patient_hash,
        s.age_group,
        s.language,
        s.malaria_result,
        s.malaria_risk_level,
        s.other_disease || null,
        s.other_disease_result || null,
        s.symptoms_summary || '',
        s.recommendation,
      );

      if (s.malaria_result === 'positive' && !s.notified) {
        await notifyClinician({
          sessionId: String(s.id),
          recipientType: 'pharmacist',
          patientRef: `P-${String(s.patient_hash).slice(0, 8).toUpperCase()}`,
          malariaResult: String(s.malaria_result),
          riskLevel: String(s.malaria_risk_level),
          recommendation: String(s.recommendation),
          language: String(s.language),
        });
      }

      synced.push(String(s.id));
    } catch (e) {
      console.error('Sync item failed:', e);
    }
  }

  res.json({ synced, count: synced.length });
});

router.get('/admin/stats', authMiddleware, (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM triage_sessions').get() as { c: number };
  const positive = db
    .prepare("SELECT COUNT(*) as c FROM triage_sessions WHERE malaria_result = 'positive'")
    .get() as { c: number };
  const critical = db
    .prepare("SELECT COUNT(*) as c FROM triage_sessions WHERE malaria_risk_level = 'critical'")
    .get() as { c: number };
  const notified = db
    .prepare('SELECT COUNT(*) as c FROM triage_sessions WHERE notified = 1')
    .get() as { c: number };

  const byLanguage = db
    .prepare('SELECT language, COUNT(*) as count FROM triage_sessions GROUP BY language')
    .all();

  res.json({
    total: total.c,
    malariaPositive: positive.c,
    criticalCases: critical.c,
    notificationsSent: notified.c,
    byLanguage,
  });
});

router.get('/admin/sessions', authMiddleware, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const rows = db
    .prepare(
      `SELECT id, patient_hash, age_group, language, malaria_result, malaria_risk_level,
              other_disease, other_disease_result, symptoms_summary, recommendation,
              created_at, notified
       FROM triage_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Record<string, unknown>[];

  res.json({
    sessions: rows.map((r) => ({
      ...anonymizeSession(r),
      symptoms_summary: redactSymptoms(String(r.symptoms_summary || '')),
    })),
    limit,
    offset,
  });
});

router.get('/admin/notifications', authMiddleware, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, session_id, recipient_type, status, message_preview, created_at, sent_at
       FROM notifications ORDER BY created_at DESC LIMIT 50`
    )
    .all();
  res.json({ notifications: rows });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'health-triage-api' });
});

export default router;
