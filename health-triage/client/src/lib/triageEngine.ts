/** Client-side WHO triage engine (mirrors server for offline use) */

export type AgeGroup = 'under5' | '5to14' | '15plus' | 'pregnant';
export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';
export type MalariaResult = 'positive' | 'negative' | 'not_tested' | 'presumptive';

export interface MalariaInput {
  ageGroup: AgeGroup;
  feverDurationDays: number;
  temperatureC?: number;
  inMalariaEndemicArea: boolean;
  rdtResult?: 'positive' | 'negative' | 'not_available';
  severeSigns: Record<string, boolean>;
  supportingSymptoms: Record<string, boolean>;
}

export interface MalariaAssessment {
  result: MalariaResult;
  riskLevel: RiskLevel;
  recommendationKey: string;
  urgentReferral: boolean;
  notifyClinician: boolean;
}

export interface OtherDiseaseInput {
  disease: 'dengue' | 'typhoid' | 'influenza' | 'uti' | 'pneumonia';
  ageGroup: AgeGroup;
  feverDurationDays: number;
  symptoms: Record<string, boolean>;
}

export interface OtherDiseaseAssessment {
  result: 'likely' | 'possible' | 'unlikely';
  riskLevel: RiskLevel;
  recommendationKey: string;
  urgentReferral: boolean;
}

function hasSevere(signs: Record<string, boolean>) {
  return Object.values(signs).some(Boolean);
}

export function assessMalaria(input: MalariaInput): MalariaAssessment {
  const severe = hasSevere(input.severeSigns);

  if (severe) {
    return {
      result: input.rdtResult === 'positive' ? 'positive' : 'presumptive',
      riskLevel: 'critical',
      recommendationKey: 'malaria.severeReferral',
      urgentReferral: true,
      notifyClinician: true,
    };
  }

  if (input.rdtResult === 'positive') {
    const artKey =
      input.ageGroup === 'pregnant'
        ? 'malaria.artPregnant'
        : input.ageGroup === 'under5'
          ? 'malaria.artChild'
          : 'malaria.artAdult';
    return {
      result: 'positive',
      riskLevel: 'high',
      recommendationKey: artKey,
      urgentReferral: false,
      notifyClinician: true,
    };
  }

  if (input.rdtResult === 'negative' && input.feverDurationDays >= 3) {
    return {
      result: 'negative',
      riskLevel: 'moderate',
      recommendationKey: 'malaria.rdtNegativePersistent',
      urgentReferral: input.feverDurationDays >= 7,
      notifyClinician: false,
    };
  }

  if (
    input.inMalariaEndemicArea &&
    input.feverDurationDays <= 2 &&
    (input.supportingSymptoms.chills || input.supportingSymptoms.headache) &&
    input.rdtResult !== 'negative'
  ) {
    return {
      result: 'presumptive',
      riskLevel: 'moderate',
      recommendationKey: 'malaria.presumptiveTest',
      urgentReferral: false,
      notifyClinician: false,
    };
  }

  if (input.rdtResult === 'negative') {
    return {
      result: 'negative',
      riskLevel: 'low',
      recommendationKey: 'malaria.negativeOtherCauses',
      urgentReferral: false,
      notifyClinician: false,
    };
  }

  return {
    result: 'not_tested',
    riskLevel: input.inMalariaEndemicArea ? 'moderate' : 'low',
    recommendationKey: 'malaria.performRdt',
    urgentReferral: false,
    notifyClinician: false,
  };
}

export function assessOtherDisease(input: OtherDiseaseInput): OtherDiseaseAssessment {
  const { disease, symptoms, feverDurationDays, ageGroup } = input;

  switch (disease) {
    case 'dengue': {
      const score =
        (symptoms.rash ? 2 : 0) +
        (symptoms.eyePain ? 2 : 0) +
        (symptoms.jointPain ? 1 : 0) +
        (symptoms.bleeding ? 3 : 0) +
        (symptoms.abdominalPain ? 2 : 0);
      const critical = symptoms.bleeding || symptoms.abdominalPain;
      return {
        result: score >= 4 ? 'likely' : score >= 2 ? 'possible' : 'unlikely',
        riskLevel: critical ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low',
        recommendationKey: critical ? 'dengue.severeReferral' : score >= 2 ? 'dengue.monitoring' : 'dengue.unlikely',
        urgentReferral: Boolean(critical),
      };
    }
    case 'typhoid': {
      const score =
        (feverDurationDays >= 7 ? 2 : feverDurationDays >= 3 ? 1 : 0) +
        (symptoms.abdominalPain ? 1 : 0) +
        (symptoms.constipationOrDiarrhea ? 1 : 0) +
        (symptoms.headache ? 1 : 0);
      return {
        result: score >= 4 ? 'likely' : score >= 2 ? 'possible' : 'unlikely',
        riskLevel: score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low',
        recommendationKey: score >= 2 ? 'typhoid.testAndTreat' : 'typhoid.unlikely',
        urgentReferral: feverDurationDays >= 14,
      };
    }
    case 'influenza': {
      const score =
        (symptoms.cough ? 2 : 0) +
        (symptoms.soreThroat ? 1 : 0) +
        (symptoms.bodyAches ? 1 : 0) +
        (symptoms.runnyNose ? 1 : 0);
      return {
        result: score >= 4 ? 'likely' : score >= 2 ? 'possible' : 'unlikely',
        riskLevel: ageGroup === 'under5' && score >= 2 ? 'moderate' : 'low',
        recommendationKey: score >= 2 ? 'influenza.supportive' : 'influenza.unlikely',
        urgentReferral: false,
      };
    }
    case 'uti': {
      const score =
        (symptoms.painfulUrination ? 3 : 0) +
        (symptoms.frequentUrination ? 2 : 0) +
        (symptoms.flankPain ? 2 : 0) +
        (symptoms.fever ? 1 : 0);
      return {
        result: score >= 4 ? 'likely' : score >= 2 ? 'possible' : 'unlikely',
        riskLevel: symptoms.flankPain ? 'high' : score >= 2 ? 'moderate' : 'low',
        recommendationKey: symptoms.flankPain ? 'uti.referKidney' : score >= 2 ? 'uti.antibiotics' : 'uti.unlikely',
        urgentReferral: Boolean(symptoms.flankPain),
      };
    }
    case 'pneumonia': {
      const score =
        (symptoms.cough ? 2 : 0) +
        (symptoms.fastBreathing ? 3 : 0) +
        (symptoms.chestPain ? 2 : 0) +
        (symptoms.wheezing ? 1 : 0);
      const critical = symptoms.fastBreathing || (ageGroup === 'under5' && symptoms.chestIndrawing);
      return {
        result: score >= 4 ? 'likely' : score >= 2 ? 'possible' : 'unlikely',
        riskLevel: critical ? 'critical' : score >= 4 ? 'high' : 'low',
        recommendationKey: critical ? 'pneumonia.urgent' : score >= 2 ? 'pneumonia.antibiotics' : 'pneumonia.unlikely',
        urgentReferral: Boolean(critical),
      };
    }
    default:
      return {
        result: 'unlikely',
        riskLevel: 'low',
        recommendationKey: 'general.consultProvider',
        urgentReferral: false,
      };
  }
}

export const OTHER_DISEASES = ['dengue', 'typhoid', 'influenza', 'uti', 'pneumonia'] as const;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export async function hashPatientToken(token: string) {
  return sha256(`health-triage-v1:${token.trim().toLowerCase()}`);
}
