import React, { useRef } from 'react';
import { useOnboarding } from '../../../context/OnboardingContext';
import CheckBox from '../../ui/CheckBox';

const WelcomeStep = () => {
  const { formData, updateFormData, errors, setStepErrors, registerStepValidator } = useOnboarding();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const validateStep = () => {
    if (!formDataRef.current.account_agree) {
      setStepErrors({ account_agree: 'Please agree to the Terms & Conditions to continue' });
      return false;
    }
    setStepErrors({});
    return true;
  };

  React.useEffect(() => {
    return registerStepValidator(validateStep);
  }, []);

  return (
    <div className="space-y-4">
      <CheckBox
        checked={formData.account_agree}
        onChange={(checked) => updateFormData('account_agree', checked)}
        label="I agree to the Terms & Conditions"
        size="md"
      />
      <p className="text-sm text-neutral-500 ml-8">
        Read our{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">
          Terms &amp; Conditions
        </a>{' '}
        and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">
          Privacy Policy
        </a>.
      </p>
      {errors.account_agree && (
        <p className="text-sm text-red-600">{errors.account_agree}</p>
      )}
    </div>
  );
};

export default WelcomeStep;
