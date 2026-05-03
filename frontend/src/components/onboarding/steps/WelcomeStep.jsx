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
        label="I agree to Terms & Conditions"
        size="md"
      />
      {errors.account_agree && (
        <p className="text-sm text-red-600">{errors.account_agree}</p>
      )}
    </div>
  );
};

export default WelcomeStep;
