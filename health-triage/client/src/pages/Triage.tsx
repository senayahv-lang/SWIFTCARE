import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  assessMalaria,
  assessOtherDisease,
  hashPatientToken,
  OTHER_DISEASES,
  type AgeGroup,
  type MalariaInput,
  type OtherDiseaseInput,
} from '../lib/triageEngine';
import { isOnline, queueSession, submitTriage, syncPendingSessions } from '../lib/api';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, Send } from 'lucide-react';

// Simple uuid without server dependency
function genId() {
  return crypto.randomUUID();
}

type Tab = 'malaria' | 'other';

const SEVERE_KEYS = [
  'alteredConsciousness',
  'convulsions',
  'unableToDrink',
  'persistentVomiting',
  'chestIndrawing',
  'severeAnemia',
  'jaundice',
] as const;

const MALARIA_SYMPTOM_KEYS = ['chills', 'headache', 'bodyAches', 'nausea'] as const;

const DISEASE_SYMPTOM_MAP: Record<string, string[]> = {
  dengue: ['rash', 'eyePain', 'jointPain', 'bleeding', 'abdominalPain'],
  typhoid: ['abdominalPain', 'constipationOrDiarrhea', 'headache'],
  influenza: ['cough', 'soreThroat', 'bodyAches', 'runnyNose'],
  uti: ['painfulUrination', 'frequentUrination', 'flankPain', 'fever'],
  pneumonia: ['cough', 'fastBreathing', 'chestPain', 'wheezing', 'chestIndrawing'],
};

function boolMap(keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, false]));
}

export default function Triage() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<Tab>('malaria');
  const [patientToken, setPatientToken] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('15plus');
  const [feverDays, setFeverDays] = useState(1);
  const [temp, setTemp] = useState('');
  const [endemic, setEndemic] = useState(true);
  const [rdt, setRdt] = useState<'positive' | 'negative' | 'not_available'>('not_available');
  const [severeSigns, setSevereSigns] = useState(boolMap(SEVERE_KEYS));
  const [malariaSymptoms, setMalariaSymptoms] = useState(boolMap(MALARIA_SYMPTOM_KEYS));
  const [selectedDisease, setSelectedDisease] = useState<(typeof OTHER_DISEASES)[number]>('dengue');
  const [otherSymptoms, setOtherSymptoms] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{
    malaria: ReturnType<typeof assessMalaria>;
    other: ReturnType<typeof assessOtherDisease> | null;
    sessionId: string;
    notified: boolean;
    queued: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const malariaInput: MalariaInput = {
    ageGroup,
    feverDurationDays: feverDays,
    temperatureC: temp ? Number(temp) : undefined,
    inMalariaEndemicArea: endemic,
    rdtResult: rdt === 'not_available' ? undefined : rdt,
    severeSigns,
    supportingSymptoms: malariaSymptoms,
  };

  const malariaNegative = rdt === 'negative';
  const otherUnlocked = malariaNegative;

  const toggle = (obj: Record<string, boolean>, key: string, setter: (v: Record<string, boolean>) => void) => {
    setter({ ...obj, [key]: !obj[key] });
  };

  const runAssessment = async () => {
    setLoading(true);
    const malaria = assessMalaria(malariaInput);
    let other = null;
    let otherInput: OtherDiseaseInput | undefined;

    if (malaria.result === 'negative' && tab === 'other') {
      const symptoms = otherSymptoms;
      otherInput = { disease: selectedDisease, ageGroup, feverDurationDays: feverDays, symptoms };
      other = assessOtherDisease(otherInput);
    }

    const id = genId();
    const patientHash = await hashPatientToken(patientToken || id);
    const recommendation = [
      t(`rec.${malaria.recommendationKey}`),
      other ? t(`rec.${other.recommendationKey}`) : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const payload = {
      patientToken: patientToken || id,
      ageGroup,
      language: i18n.language,
      malariaInput,
      otherDiseaseInput: otherInput,
      recommendation,
    };

    const sessionRecord = {
      id,
      patient_hash: patientHash,
      age_group: ageGroup,
      language: i18n.language,
      malaria_result: malaria.result,
      malaria_risk_level: malaria.riskLevel,
      other_disease: otherInput?.disease,
      other_disease_result: other?.result,
      symptoms_summary: JSON.stringify({ malaria: malariaSymptoms }),
      recommendation,
      notified: 0,
      created_at: new Date().toISOString(),
      payload,
    };

    let notified = false;
    let queued = false;

    try {
      if (isOnline()) {
        const res = await submitTriage(payload);
        notified = Boolean(res.notification?.sent);
      } else {
        await queueSession(sessionRecord);
        queued = true;
      }
    } catch {
      await queueSession(sessionRecord);
      queued = true;
    }

    setResult({ malaria, other, sessionId: id, notified, queued });
    setLoading(false);
  };

  const riskColor = (level: string) => {
    if (level === 'critical') return 'text-red-400 bg-red-500/15 border-red-500/30';
    if (level === 'high') return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    if (level === 'moderate') return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl glass p-8">
          <h2 className="font-display text-2xl font-bold">{t('triage.result')}</h2>

          <div className={`mt-6 rounded-xl border p-4 ${riskColor(result.malaria.riskLevel)}`}>
            <p className="text-sm font-medium uppercase opacity-80">{t('triage.malariaTab')}</p>
            <p className="mt-1 text-xl font-bold">
              {t(`result.${result.malaria.result}`)} · {t(`risk.${result.malaria.riskLevel}`)}
            </p>
            <p className="mt-2 text-sm opacity-90">{t(`rec.${result.malaria.recommendationKey}`)}</p>
            {result.malaria.urgentReferral && (
              <p className="mt-3 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-5 w-5" />
                {t('result.urgentReferral')}
              </p>
            )}
          </div>

          {result.other && (
            <div className={`mt-4 rounded-xl border p-4 ${riskColor(result.other.riskLevel)}`}>
              <p className="text-sm font-medium uppercase opacity-80">{t(`diseases.${selectedDisease}`)}</p>
              <p className="mt-1 text-xl font-bold">
                {t(`result.${result.other.result}`)} · {t(`risk.${result.other.riskLevel}`)}
              </p>
              <p className="mt-2 text-sm opacity-90">{t(`rec.${result.other.recommendationKey}`)}</p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-xl bg-white/5 p-4 text-sm text-slate-300">
            {result.malaria.notifyClinician ? (
              result.notified ? (
                <>
                  <Send className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  {t('triage.notifySent')}
                </>
              ) : result.queued ? (
                <>
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  {t('triage.notifyPending')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {t('triage.notifySent')}
                </>
              )
            ) : (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Session {result.sessionId.slice(0, 8)}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => { setResult(null); setStep(0); }}>
              {t('triage.newAssessment')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => syncPendingSessions()}>
              {t('triage.syncNow')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex gap-2 rounded-xl bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab('malaria')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
            tab === 'malaria' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('triage.malariaTab')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (otherUnlocked) {
              setTab('other');
              setStep(0);
              setOtherSymptoms(boolMap(DISEASE_SYMPTOM_MAP[selectedDisease]));
            }
          }}
          disabled={!otherUnlocked}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition ${
            tab === 'other'
              ? 'bg-brand-600 text-white'
              : otherUnlocked
                ? 'text-slate-400 hover:text-slate-200'
                : 'cursor-not-allowed text-slate-600'
          }`}
        >
          {!otherUnlocked && <Lock className="h-3.5 w-3.5" />}
          {t('triage.otherTab')}
        </button>
      </div>

      {!otherUnlocked && tab === 'malaria' && step >= 2 && rdt !== 'negative' && (
        <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {t('triage.otherLocked')}
        </p>
      )}

      <div className="rounded-2xl glass p-6 md:p-8">
        <p className="text-sm text-slate-400">{t('triage.step', { current: step + 1, total: tab === 'other' ? 2 : 3 })}</p>

        {step === 0 && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label-text">{t('triage.patientId')}</label>
              <input
                className="input-field"
                value={patientToken}
                onChange={(e) => setPatientToken(e.target.value)}
                placeholder="e.g. AK-042"
              />
              <p className="mt-1 text-xs text-slate-500">{t('triage.patientIdHint')}</p>
            </div>
            <div>
              <label className="label-text">{t('triage.ageGroup')}</label>
              <select className="input-field" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
                <option value="under5">{t('triage.under5')}</option>
                <option value="5to14">{t('triage.age5to14')}</option>
                <option value="15plus">{t('triage.age15plus')}</option>
                <option value="pregnant">{t('triage.pregnant')}</option>
              </select>
            </div>
            <button type="button" className="btn-primary w-full" onClick={() => setStep(1)}>
              {t('triage.start')}
            </button>
          </div>
        )}

        {tab === 'malaria' && step === 1 && (
          <div className="mt-4 space-y-4">
            <h3 className="font-semibold">{t('triage.fever')}</h3>
            <div>
              <label className="label-text">{t('triage.feverDuration')}</label>
              <input
                type="number"
                min={0}
                max={30}
                className="input-field"
                value={feverDays}
                onChange={(e) => setFeverDays(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label-text">{t('triage.temperature')}</label>
              <input className="input-field" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="38.5" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={endemic} onChange={(e) => setEndemic(e.target.checked)} className="rounded" />
              <span className="text-sm">{t('triage.endemic')}</span>
            </label>
            <div>
              <label className="label-text">{t('triage.rdt')}</label>
              <div className="flex flex-wrap gap-2">
                {(['positive', 'negative', 'not_available'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRdt(v)}
                    className={`rounded-lg px-4 py-2 text-sm ${
                      rdt === v ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {t(`triage.rdt${v === 'not_available' ? 'NotAvailable' : v === 'positive' ? 'Positive' : 'Negative'}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep(0)}>Back</button>
              <button type="button" className="btn-primary flex-1" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {tab === 'malaria' && step === 2 && (
          <div className="mt-4 space-y-4">
            <h3 className="font-semibold">{t('triage.symptoms')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {MALARIA_SYMPTOM_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={malariaSymptoms[key]}
                    onChange={() => toggle(malariaSymptoms, key, setMalariaSymptoms)}
                  />
                  {t(`triage.${key}`)}
                </label>
              ))}
            </div>
            <h3 className="pt-2 font-semibold text-red-300">{t('triage.severe')}</h3>
            <div className="grid gap-2">
              {SEVERE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-lg bg-red-500/5 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={severeSigns[key]}
                    onChange={() => toggle(severeSigns, key, setSevereSigns)}
                  />
                  {t(`triage.${key}`)}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn-primary flex-1" disabled={loading} onClick={runAssessment}>
                {t('triage.submit')}
              </button>
            </div>
          </div>
        )}

        {tab === 'other' && otherUnlocked && step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="label-text">{t('triage.selectDisease')}</label>
              <select
                className="input-field"
                value={selectedDisease}
                onChange={(e) => {
                  const d = e.target.value as (typeof OTHER_DISEASES)[number];
                  setSelectedDisease(d);
                  setOtherSymptoms(boolMap(DISEASE_SYMPTOM_MAP[d]));
                }}
              >
                {OTHER_DISEASES.map((d) => (
                  <option key={d} value={d}>{t(`diseases.${d}`)}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              {(DISEASE_SYMPTOM_MAP[selectedDisease] || []).map((key) => {
                const ns =
                  selectedDisease === 'dengue'
                    ? 'dengueSymptoms'
                    : selectedDisease === 'typhoid'
                      ? 'typhoidSymptoms'
                      : selectedDisease === 'influenza'
                        ? 'fluSymptoms'
                        : selectedDisease === 'uti'
                          ? 'utiSymptoms'
                          : 'pneumoniaSymptoms';
                return (
                  <label key={key} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={otherSymptoms[key] || false}
                      onChange={() => toggle(otherSymptoms, key, setOtherSymptoms)}
                    />
                    {t(`${ns}.${key}`)}
                  </label>
                );
              })}
            </div>
            <button type="button" className="btn-primary w-full" disabled={loading} onClick={runAssessment}>
              {t('triage.submit')}
            </button>
          </div>
        )}

        {tab === 'other' && otherUnlocked && step === 0 && (
          <div className="mt-4">
            <p className="text-slate-400">Malaria RDT negative — screen for other common febrile illnesses (WHO IMCI).</p>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => {
              setOtherSymptoms(boolMap(DISEASE_SYMPTOM_MAP[selectedDisease]));
              setStep(1);
            }}>
              {t('triage.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
