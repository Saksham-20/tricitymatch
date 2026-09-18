import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { View, StyleSheet, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { PressableScale } from '../../components/motion';
import Input from '../../components/ui/Input';
import PickerSheet from '../../components/ui/PickerSheet';
import Text from '../../components/ui/Text';
import OnboardingLayout from './OnboardingLayout';
import { useOnboarding } from './OnboardingContext';

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
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const { data, saveAndNext } = useOnboarding();

  const [city, setCity] = useState(data.city);
  const [state, setState] = useState(data.state);
  const [isNRI, setIsNRI] = useState(data.isNRI);
  const [country, setCountry] = useState(data.country);
  const [visaStatus, setVisaStatus] = useState(data.visaStatus);
  const [citySheet, setCitySheet] = useState(false);
  const [countrySheet, setCountrySheet] = useState(false);
  const [visaSheet, setVisaSheet] = useState(false);

  const isValid = !!(city && (!isNRI || country));

  const handleCitySelect = (c: string) => {
    setCity(c);
    setState(STATE_BY_CITY[c] ?? '');
  };

  const handleContinue = async () => {
    await saveAndNext(
      { city, state, isNRI, country, visaStatus },
      { city, state } as any,
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
      <View>
        <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step6.city')}</Text>
        <PressableScale
          style={styles.selectBtn}
          onPress={() => setCitySheet(true)}
          testID="select-city"
          accessibilityLabel={t('onboarding.step6.city')}
          accessibilityRole="button"
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text variant="callout" color={city ? 'textPrimary' : 'textMuted'}>
            {city || 'Select city'}
          </Text>
        </PressableScale>
      </View>

      {/* State (auto-filled) */}
      <Input
        label={t('onboarding.step6.state')}
        value={state}
        onChangeText={setState}
        placeholder="State"
        autoCapitalize="words"
        testID="input-state"
        accessibilityLabel={t('onboarding.step6.state')}
      />

      {/* NRI toggle */}
      <View style={styles.toggleRow}>
        <Text variant="subhead" color="textPrimary" style={styles.toggleLabel}>{t('onboarding.step6.nriToggle')}</Text>
        <Switch
          value={isNRI}
          onValueChange={setIsNRI}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor="#fff"
          testID="toggle-nri"
          accessibilityLabel={t('onboarding.step6.nriToggle')}
        />
      </View>

      {/* NRI fields */}
      {isNRI && (
        <>
          <View>
            <Text variant="subhead" color="textPrimary" style={styles.label}>{t('onboarding.step6.country')}</Text>
            <PressableScale
              style={styles.selectBtn}
              onPress={() => setCountrySheet(true)}
              testID="select-country"
              accessibilityLabel={t('onboarding.step6.country')}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="callout" color={country ? 'textPrimary' : 'textMuted'}>
                {country || 'Select country'}
              </Text>
            </PressableScale>
          </View>

          <View>
            <Text variant="subhead" color="textPrimary" style={styles.label}>
              {t('onboarding.step6.visaStatus')}
              <Text variant="footnote" color="textMuted"> ({t('common.optional')})</Text>
            </Text>
            <PressableScale
              style={styles.selectBtn}
              onPress={() => setVisaSheet(true)}
              testID="select-visa"
              accessibilityLabel={t('onboarding.step6.visaStatus')}
              accessibilityRole="button"
              pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text variant="callout" color={visaStatus ? 'textPrimary' : 'textMuted'}>
                {visaStatus || 'Select visa / PR status'}
              </Text>
            </PressableScale>
          </View>
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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {},
});
