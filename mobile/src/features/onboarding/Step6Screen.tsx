import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Input from '../../components/ui/Input';
import PickerSheet from '../../components/ui/PickerSheet';
import Switch from '../../components/ui/Switch';
import Text from '../../components/ui/Text';
import { tapSize } from '../../utils/elderTheme';
import OnboardingLayout, { OnboardingSelectField, flushField, useOnboardingControls } from './OnboardingLayout';
import { useOnboarding, type JourneyProfilePatch } from './OnboardingContext';

const INDIA_CITIES = [
  'Chandigarh', 'Mohali', 'Panchkula', 'Ambala', 'Ludhiana', 'Amritsar',
  'Jalandhar', 'Patiala', 'Bathinda', 'Rohtak', 'Hisar', 'Gurugram',
  'Faridabad', 'Delhi', 'Noida', 'Ghaziabad', 'Mumbai', 'Pune', 'Bengaluru',
  'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Other',
];

const COUNTRIES = [
  'Canada', 'United States', 'United Kingdom', 'Australia', 'Germany',
  'Singapore', 'UAE / Dubai', 'New Zealand', 'Netherlands', 'Other',
];

const VISA_STATUSES = [
  'Student Visa', 'Work Visa / H1B', 'Permanent Resident (PR)', 'Citizen',
  'Dependent Visa', 'Other',
];

const STATE_BY_CITY: Record<string, string> = {
  Chandigarh: 'Chandigarh (UT)', Mohali: 'Punjab', Panchkula: 'Haryana',
  Ludhiana: 'Punjab', Amritsar: 'Punjab', Jalandhar: 'Punjab',
  Patiala: 'Punjab', Ambala: 'Haryana', Rohtak: 'Haryana', Hisar: 'Haryana',
  Gurugram: 'Haryana', Faridabad: 'Haryana', Delhi: 'Delhi',
  Noida: 'Uttar Pradesh', Ghaziabad: 'Uttar Pradesh',
};

export default function Step6Screen() {
  const { elder } = useTheme();
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();
  const controls = useOnboardingControls();

  const [city, setCity] = useState(data.city);
  const [state, setState] = useState(data.state);
  const [isNRI, setIsNRI] = useState(data.isNRI);
  const [country, setCountry] = useState(data.country);
  const [visaStatus, setVisaStatus] = useState(data.visaStatus);
  const [citySheet, setCitySheet] = useState(false);
  const [countrySheet, setCountrySheet] = useState(false);
  const [visaSheet, setVisaSheet] = useState(false);

  const isValid = !!(city && (!isNRI || country));

  const handleCitySelect = (picked: string) => {
    setCity(picked);
    setState(STATE_BY_CITY[picked] ?? '');
  };

  const handleContinue = async () => {
    const abroad = isNRI;
    // The NRI declaration was collected and then never sent, so NRI members were
    // never flagged (and never offered the NRI plan). The backend stores it as
    // isNri / residenceCountry / residenceStatus; '' clears a free-text column.
    const profilePatch: JourneyProfilePatch = {
      city,
      state: state.trim(),
      isNri: abroad,
      residenceCountry: abroad ? country : '',
      residenceStatus: abroad ? visaStatus : '',
    };
    await saveAndNext(
      { city, state: state.trim(), isNRI: abroad, country: abroad ? country : '', visaStatus: abroad ? visaStatus : '' },
      profilePatch,
    );
  };

  return (
    <OnboardingLayout
      step={6}
      title={t('onboarding.step6.title')}
      subtitle={t('onboarding.step6.subtitle')}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      {/* Current city */}
      <OnboardingSelectField
        label={t('onboarding.step6.city')}
        value={city}
        placeholder={t('onboarding.placeholders.city', 'Select city')}
        onPress={() => setCitySheet(true)}
        open={citySheet}
        testID="select-city"
      />

      {/* State (auto-filled) */}
      <Input
        {...controls.inputProps}
        label={t('onboarding.step6.state')}
        value={state}
        onChangeText={setState}
        containerStyle={flushField}
        placeholder={t('onboarding.placeholders.state', 'State')}
        autoCapitalize="words"
        maxLength={100}
        testID="input-state"
        accessibilityLabel={t('onboarding.step6.state')}
      />

      {/* NRI toggle: the whole row is the control (the switch alone is 31pt tall and
          its label was not tappable); the shared Switch is only the visual, so its
          own press is switched off and the row carries the one haptic. */}
      <PressableScale
        scaleTo={0.985}
        haptic
        style={[styles.toggleRow, { minHeight: tapSize(elder) }]}
        onPress={() => setIsNRI((v) => !v)}
        testID="toggle-nri"
        accessibilityRole="switch"
        accessibilityLabel={t('onboarding.step6.nriToggle')}
        accessibilityState={{ checked: isNRI }}
        pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text variant="subhead" color="textPrimary" style={styles.toggleLabel}>{t('onboarding.step6.nriToggle')}</Text>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Switch value={isNRI} onValueChange={setIsNRI} />
        </View>
      </PressableScale>

      {/* NRI fields */}
      {isNRI && (
        <>
          <OnboardingSelectField
            label={t('onboarding.step6.country')}
            value={country}
            placeholder={t('onboarding.placeholders.country', 'Select country')}
            onPress={() => setCountrySheet(true)}
            open={countrySheet}
            testID="select-country"
          />
          <OnboardingSelectField
            label={t('onboarding.step6.visaStatus')}
            optional
            value={visaStatus}
            placeholder={t('onboarding.placeholders.visaStatus', 'Select visa / PR status')}
            onPress={() => setVisaSheet(true)}
            open={visaSheet}
            testID="select-visa"
          />
        </>
      )}

      <PickerSheet
        visible={citySheet}
        title={t('onboarding.step6.city')}
        options={INDIA_CITIES}
        selected={city}
        onSelect={handleCitySelect}
        onClose={() => setCitySheet(false)}
      />
      <PickerSheet
        visible={countrySheet}
        title={t('onboarding.step6.country')}
        options={COUNTRIES}
        selected={country}
        onSelect={setCountry}
        onClose={() => setCountrySheet(false)}
      />
      <PickerSheet
        visible={visaSheet}
        title={t('onboarding.step6.visaStatus')}
        options={VISA_STATUSES}
        selected={visaStatus}
        onSelect={setVisaStatus}
        onClose={() => setVisaSheet(false)}
      />
    </OnboardingLayout>
  );
}

// Layout only: no colour lives in a module-scope stylesheet (doctrine 10.5).
const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { flex: 1 },
});
