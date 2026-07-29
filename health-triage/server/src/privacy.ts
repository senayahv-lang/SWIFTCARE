import crypto from 'crypto';

/** One-way hash — admin sees pseudonymous IDs, never raw patient identifiers */
export function hashPatientId(identifier: string): string {
  return crypto
    .createHash('sha256')
    .update(`health-triage-v1:${identifier.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
}

/** Strip fields that could identify a person from admin API responses */
export function anonymizeSession(session: Record<string, unknown>) {
  const { patient_hash, ...rest } = session;
  return {
    ...rest,
    patient_ref: `P-${String(patient_hash).slice(0, 8).toUpperCase()}`,
  };
}

export function redactSymptoms(summary: string): string {
  if (!summary || summary.length <= 80) return summary || '';
  return summary.slice(0, 77) + '...';
}
