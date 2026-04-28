import React from 'react';
import { useOnboarding } from '../../../context/OnboardingContext';
import CheckBox from '../../ui/CheckBox';

const WelcomeStep = () => {
  const { formData, updateFormData } = useOnboarding();

  return (
    <div className="space-y-4">
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
