import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import FormField from '../components/ui/FormField';
import ContactNumberVerify from '../components/common/ContactNumberVerify';
import DobField from '../components/ui/DobField';
import Seo from '../components/common/Seo';
import { validateName, validateAge } from '../utils/validators';
import { minAgeFor, pickerMinAge, minAgeMessage } from '../utils/marriageableAge';
import apiErrorMessage from '../utils/apiError';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * The basics every member needs before they can be shown to anyone: name,
 * gender and date of birth (the age rule depends on both). A Google sign-up
 * arrives with only a name, so it lands here; so does any older account that
 * never finished. Same rules as the signup form's Basic Info step.
 *
 * Step 2 verifies a mobile number when the account has none (every Google
 * sign-up): it is the number members call after unlocking the profile. It used
 * to appear only as a blocking pop-up on the next page.
 */
export default function CompleteBasics() {
  const { user, refreshUser, updateUser, logout } = useAuth();
  // Held locally: saving the basics flips onboardingComplete, which would
  // otherwise redirect away before the phone step shows.
  const [stage, setStage] = useState('basics'); // basics | phone
  const [phone, setPhone] = useState(user?.phone || '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = user?.Profile || {};
  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    gender: profile.gender || '',
    dateOfBirth: dateOnly(profile.dateOfBirth),
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  const raw = searchParams.get('returnTo') || '';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/welcome') ? raw : '/dashboard';

  if (stage === 'basics' && user && (user.role !== 'user' || user.onboardingComplete !== false)) {
    return <Navigate to={returnTo} replace />;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!validateName(form.firstName)) e.firstName = 'Please enter your first name (letters only)';
    if (!validateName(form.lastName)) e.lastName = 'Please enter your last name (letters only)';
    if (!form.gender) e.gender = 'Please choose your gender';
    if (!form.dateOfBirth) e.dateOfBirth = 'Please enter your date of birth';
    else if (form.gender && !validateAge(form.dateOfBirth, minAgeFor(form.gender), 100)) e.dateOfBirth = minAgeMessage(form.gender);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (ev) => {
    ev.preventDefault();
    setSaveError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('firstName', form.firstName.trim());
      fd.append('lastName', form.lastName.trim());
      fd.append('gender', form.gender);
      fd.append('dateOfBirth', form.dateOfBirth);
      await api.put('/profile/me', fd);
      if (user?.phoneVerified === false) {
        setStage('phone');
        refreshUser();
      } else {
        await refreshUser();
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (stage === 'phone') {
    return (
      <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50 dark:bg-surface-dark-1 px-4 py-10">
        <Seo title="Verify your mobile number" noindex />
        <div className="mx-auto max-w-lg rounded-2xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Step 2 of 2</p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">Verify your mobile number</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              When a member unlocks your contact, this is the number they call, so every member needs a verified one. You choose who can unlock it in Settings → Privacy.
            </p>
          </div>
          <ContactNumberVerify
            flow="account"
            value={phone}
            verified={false}
            onChange={setPhone}
            onVerified={(d) => {
              updateUser({ phone: d, phoneVerified: true });
              navigate(returnTo, { replace: true });
            }}
          />
          <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-4 text-sm text-neutral-600 dark:text-neutral-400">
            <p className="font-medium text-neutral-800 dark:text-neutral-200">Already joined with this number?</p>
            <p className="mt-1">
              Then you have two accounts. Sign out and sign in with your mobile number instead. You can delete this new account from{' '}
              <a href="/settings" className="font-medium text-primary-600 dark:text-primary-300 underline underline-offset-2">Settings</a>.
            </p>
            <button type="button" onClick={() => logout()} className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 underline underline-offset-2">
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50 dark:bg-surface-dark-1 px-4 py-10">
      <Seo title="Finish your basics" noindex />
      <form onSubmit={save} noValidate className="mx-auto max-w-lg rounded-2xl bg-white dark:bg-surface-dark-3 border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 space-y-6">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-50 focus:outline-none">
            A few basics first
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Your name, gender and date of birth decide who sees your profile and who you are shown. It takes a moment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="First name" autoComplete="given-name" value={form.firstName} onChange={(v) => set('firstName', v)} error={errors.firstName} required />
          <FormField label="Last name" autoComplete="family-name" value={form.lastName} onChange={(v) => set('lastName', v)} error={errors.lastName} required />
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            Gender <span className="text-destructive ml-1">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2.5">
            {GENDERS.map((g) => (
              <label key={g.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  checked={form.gender === g.value}
                  onChange={() => set('gender', g.value)}
                  className="sr-only peer"
                />
                <span className="flex items-center justify-center min-h-[2.75rem] py-3 rounded-xl border-2 text-sm font-semibold transition-colors duration-[160ms] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-300 peer-checked:border-primary-600 peer-checked:bg-primary-50 peer-checked:text-primary-700 dark:peer-checked:bg-primary-900/30 dark:peer-checked:text-primary-300 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2">
                  {g.label}
                </span>
              </label>
            ))}
          </div>
          {errors.gender && <p className="text-sm text-destructive dark:text-red-300 mt-1.5">{errors.gender}</p>}
        </fieldset>

        <DobField
          minAge={pickerMinAge(form.gender)}
          value={form.dateOfBirth}
          onChange={(v) => set('dateOfBirth', v)}
          error={errors.dateOfBirth}
          required
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-3">
          Gender and date of birth cannot be changed later. If one is ever wrong, contact support.
        </p>

        {saveError && <p role="alert" className="text-sm text-destructive dark:text-red-300">{saveError}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
