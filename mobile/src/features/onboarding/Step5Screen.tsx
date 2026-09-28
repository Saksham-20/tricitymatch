import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PickerSheet from '../../components/ui/PickerSheet';
import OnboardingLayout, { OnboardingSelectField } from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

const PROFESSIONS = [
  'Doctor / Physician', 'Dentist', 'Engineer (Software)', 'Engineer (Other)',
  'Teacher / Professor', 'Lawyer', 'CA / Accountant', 'Business Owner',
  'Government Employee', 'Armed Forces', 'Police / IPS', 'Banker / Finance',
  'Scientist / Researcher', 'Architect', 'Nurse / Paramedic', 'Artist / Designer',
  'Journalist / Media', 'Pilot / Aviation', 'Chef / Hospitality', 'Other',
];

const INCOME_RANGES: { label: string; value: number }[] = [
  { label: 'Below ₹3 Lakhs', value: 200000 },
  { label: '₹3 – 5 Lakhs', value: 400000 },
  { label: '₹5 – 10 Lakhs', value: 750000 },
  { label: '₹10 – 20 Lakhs', value: 1500000 },
  { label: '₹20 – 50 Lakhs', value: 3500000 },
  { label: 'Above ₹50 Lakhs', value: 6000000 },
  { label: 'Prefer not to say', value: 0 },
];

/**
 * Label for a stored income. The web stores each bucket's UPPER bound (300000 =
 * "0 - 3 Lac") where this list stores midpoints, so a value set on the web is
 * usually not one of these and cannot be mapped to a bucket without guessing:
 * any rule puts it in a neighbour's range and shows a sensitive figure the
 * member never declared. Exact match gets its label; anything else is shown as
 * the number itself, in the format the profile screen uses.
 */
const labelForIncome = (income: number | null): string => {
  if (income === null || !Number.isFinite(income) || income < 0) return '';
  const exact = INCOME_RANGES.find((r) => r.value === income);
  if (exact) return exact.label;
  return `₹${(income / 100000).toFixed(1)}L/yr`;
};

export default function Step5Screen() {
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [profession, setProfession] = useState(data.profession);
  const [income, setIncome] = useState<number | null>(data.income);
  const [profSheet, setProfSheet] = useState(false);
  const [incomeSheet, setIncomeSheet] = useState(false);

  const isValid = !!profession;

  const handleContinue = async () => {
    const answers = { profession, income };
    await saveAndNext(answers, answers);
  };

  // No "employer" input: the backend has no column for it (the web form never
  // asked either), so the old field collected an answer and silently threw it away.
  return (
    <OnboardingLayout
      step={5}
      title={t('onboarding.step5.title')}
      subtitle={t('onboarding.step5.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Profession */}
      <OnboardingSelectField
        label={t('onboarding.step5.profession')}
        value={profession}
        placeholder={t('onboarding.placeholders.profession', 'Select profession')}
        onPress={() => setProfSheet(true)}
        open={profSheet}
        testID="select-profession"
      />

      {/* Income reveals after profession is chosen */}
      {!!profession && (
        <OnboardingSelectField
          label={t('onboarding.step5.income')}
          optional
          value={labelForIncome(income)}
          placeholder={t('onboarding.placeholders.income', 'Select annual income')}
          onPress={() => setIncomeSheet(true)}
          open={incomeSheet}
          testID="select-income"
        />
      )}

      <PickerSheet
        visible={profSheet}
        title={t('onboarding.step5.profession')}
        options={PROFESSIONS}
        selected={profession || null}
        onSelect={setProfession}
        onClose={() => setProfSheet(false)}
      />
      <PickerSheet
        visible={incomeSheet}
        title={t('onboarding.step5.income')}
        options={INCOME_RANGES}
        selected={income}
        onSelect={(v) => setIncome(v as number)}
        onClose={() => setIncomeSheet(false)}
      />
    </OnboardingLayout>
  );
}
