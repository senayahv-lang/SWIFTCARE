import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HeartPulse, Shield, WifiOff } from 'lucide-react';

export default function Home() {
  const { t } = useTranslation();

  const features = [
    { icon: HeartPulse, title: 'Malaria RDT', desc: 'Test-treat-track per WHO 2023' },
    { icon: Shield, title: 'Privacy first', desc: 'Anonymous patient refs in admin' },
    { icon: WifiOff, title: 'Works offline', desc: 'Sync when connection returns' },
  ];

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl glass p-8 md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-brand-400">
            Hackathon · Fever Triage #2
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
            {t('home.hero')}
          </h1>
          <p className="mt-4 text-lg text-slate-400">{t('home.desc')}</p>
          <p className="mt-2 text-sm text-slate-500">{t('home.who')}</p>
          <Link to="/triage" className="btn-primary mt-8">
            {t('home.cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl glass p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20">
              <Icon className="h-5 w-5 text-brand-400" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
