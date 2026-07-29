import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, Globe, Home, Shield, Wifi, WifiOff } from 'lucide-react';
import { syncPendingSessions, isOnline } from '../lib/api';
import type { LangCode } from '../i18n/locales';

const LANGS: LangCode[] = ['en', 'tw', 'fr', 'es'];

export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const on = () => {
      setOnline(true);
      syncPendingSessions();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    syncPendingSessions();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const setLang = (code: LangCode) => {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
  };

  const nav = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/triage', label: t('nav.triage'), icon: Activity },
    { to: '/admin', label: t('nav.admin'), icon: Shield },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold leading-tight">{t('app.title')}</p>
              <p className="text-xs text-slate-400">{t('app.subtitle')}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  location.pathname === to
                    ? 'bg-brand-600/20 text-brand-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:flex ${
                online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? t('app.online') : t('app.offline')}
            </div>

            <div className="relative group">
              <button className="btn-secondary !px-3 !py-2 text-sm" type="button">
                <Globe className="h-4 w-4" />
                {t(`lang.${i18n.language as LangCode}`)}
              </button>
              <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[140px] rounded-xl glass py-1 group-hover:block">
                {LANGS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                  >
                    {t(`lang.${code}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <nav className="sticky bottom-0 flex border-t border-white/10 glass sm:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs ${
              location.pathname === to ? 'text-brand-400' : 'text-slate-500'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>

      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        WHO-aligned triage · Privacy-preserving · Offline-first PWA
      </footer>
    </div>
  );
}
