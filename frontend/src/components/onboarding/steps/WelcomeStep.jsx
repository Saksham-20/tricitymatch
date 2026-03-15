import React from 'react';
import { useOnboarding } from '../../../context/OnboardingContext';
import CheckBox from '../../ui/CheckBox';

const WelcomeStep = () => {
  const { formData, updateFormData } = useOnboarding();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Welcome</h2>
        <p className="text-sm text-neutral-600">Create your matrimony profile</p>
      </div>

      <CheckBox
        checked={formData.account_agree}
        onChange={(checked) => updateFormData('account_agree', checked)}
        label="I agree to Terms & Conditions"
        size="md"
      />
    </div>
  );
};

export default WelcomeStep;
