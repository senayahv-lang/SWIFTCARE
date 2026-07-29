import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Shield } from 'lucide-react';
import {
  adminLogin,
  fetchAdminNotifications,
  fetchAdminSessions,
  fetchAdminStats,
} from '../lib/api';

export default function Admin() {
  const { t } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [notifications, setNotifications] = useState<Array<Record<string, unknown>>>([]);

  const load = async (tok: string) => {
    const [s, sess, notif] = await Promise.all([
      fetchAdminStats(tok),
      fetchAdminSessions(tok),
      fetchAdminNotifications(tok),
    ]);
    setStats(s);
    setSessions(sess.sessions || []);
    setNotifications(notif.notifications || []);
  };

  useEffect(() => {
    if (token) load(token).catch(() => setToken(''));
  }, [token]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await adminLogin(username, password);
      localStorage.setItem('adminToken', res.token);
      setToken(res.token);
    } catch {
      setError('Invalid credentials');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    setToken('');
    setStats(null);
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl glass p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20">
              <Shield className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">{t('admin.title')}</h1>
              <p className="text-sm text-slate-400">{t('admin.login')}</p>
            </div>
          </div>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="label-text">{t('admin.username')}</label>
              <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="label-text">{t('admin.password')}</label>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" className="btn-primary w-full">{t('admin.login')}</button>
          </form>

          <p className="mt-6 flex items-start gap-2 rounded-xl bg-brand-600/10 p-3 text-xs text-slate-400">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {t('admin.privacyNote')}
          </p>
        </div>
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: t('admin.total'), value: stats.total },
        { label: t('admin.malariaPositive'), value: stats.malariaPositive },
        { label: t('admin.critical'), value: stats.criticalCases },
        { label: t('admin.notifications'), value: stats.notificationsSent },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t('admin.title')}</h1>
        <button type="button" className="btn-secondary text-sm" onClick={logout}>{t('admin.logout')}</button>
      </div>

      <p className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-slate-300">
        <Lock className="h-4 w-4 text-brand-400" />
        {t('admin.privacyNote')}
      </p>

      <section>
        <h2 className="mb-4 font-semibold">{t('admin.stats')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value }) => (
            <div key={label} className="rounded-2xl glass p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-brand-300">{String(value)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-semibold">{t('admin.sessions')}</h2>
        <div className="overflow-x-auto rounded-2xl glass">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3">{t('admin.patientRef')}</th>
                <th className="px-4 py-3">{t('admin.date')}</th>
                <th className="px-4 py-3">{t('admin.malaria')}</th>
                <th className="px-4 py-3">{t('admin.risk')}</th>
                <th className="px-4 py-3">{t('admin.other')}</th>
                <th className="px-4 py-3">{t('admin.notified')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={String(s.id)} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-brand-300">{String(s.patient_ref)}</td>
                  <td className="px-4 py-3 text-slate-400">{String(s.created_at).slice(0, 16)}</td>
                  <td className="px-4 py-3">{String(s.malaria_result)}</td>
                  <td className="px-4 py-3">{String(s.malaria_risk_level)}</td>
                  <td className="px-4 py-3">{String(s.other_disease || '—')}</td>
                  <td className="px-4 py-3">{s.notified ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {notifications.length > 0 && (
        <section>
          <h2 className="mb-4 font-semibold">{t('admin.notifications')}</h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={String(n.id)} className="rounded-xl glass px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-300">{String(n.recipient_type)}</span>
                  <span className={n.status === 'sent' ? 'text-emerald-400' : 'text-amber-400'}>{String(n.status)}</span>
                </div>
                <p className="mt-1 text-slate-400">{String(n.message_preview)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
