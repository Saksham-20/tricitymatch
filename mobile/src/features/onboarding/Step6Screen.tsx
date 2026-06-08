import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
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

interface PickerSheetProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function PickerSheet({ visible, title, options, selected, onSelect, onClose }: PickerSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sheetRow, item === selected && styles.sheetRowActive]}
              onPress={() => { onSelect(item); onClose(); }}
              testID={`option-${item}`}
            >
              <Text style={[styles.sheetRowText, item === selected && styles.sheetRowTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const STATE_BY_CITY: Record<string, string> = {
  Chandigarh: 'Chandigarh (UT)', Mohali: 'Punjab', Panchkula: 'Haryana',
  Ludhiana: 'Punjab', Amritsar: 'Punjab', Jalandhar: 'Punjab',
  Patiala: 'Punjab', Ambala: 'Haryana', Rohtak: 'Haryana', Hisar: 'Haryana',
  Gurugram: 'Haryana', Faridabad: 'Haryana', Delhi: 'Delhi',
  Noida: 'Uttar Pradesh', Ghaziabad: 'Uttar Pradesh',
};

export default function Step6Screen() {
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
        <Text style={styles.label}>{t('onboarding.step6.city')}</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setCitySheet(true)}
          testID="select-city"
          accessibilityLabel={t('onboarding.step6.city')}
        >
          <Text style={city ? styles.selectText : styles.placeholderText}>
            {city || 'Select city'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* State (auto-filled) */}
      <View>
        <Text style={styles.label}>{t('onboarding.step6.state')}</Text>
        <TextInput
          style={styles.input}
          value={state}
          onChangeText={setState}
          placeholder="State"
          placeholderTextColor={colours.textMuted}
          autoCapitalize="words"
          testID="input-state"
          accessibilityLabel={t('onboarding.step6.state')}
        />
      </View>

      {/* NRI toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{t('onboarding.step6.nriToggle')}</Text>
        <Switch
          value={isNRI}
          onValueChange={setIsNRI}
          trackColor={{ false: colours.border, true: colours.primary }}
          thumbColor="#fff"
          testID="toggle-nri"
          accessibilityLabel={t('onboarding.step6.nriToggle')}
        />
      </View>

      {/* NRI fields */}
      {isNRI && (
        <>
          <View>
            <Text style={styles.label}>{t('onboarding.step6.country')}</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setCountrySheet(true)}
              testID="select-country"
              accessibilityLabel={t('onboarding.step6.country')}
            >
              <Text style={country ? styles.selectText : styles.placeholderText}>
                {country || 'Select country'}
              </Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text style={styles.label}>
              {t('onboarding.step6.visaStatus')}
              <Text style={styles.optional}> ({t('common.optional')})</Text>
            </Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setVisaSheet(true)}
              testID="select-visa"
              accessibilityLabel={t('onboarding.step6.visaStatus')}
            >
              <Text style={visaStatus ? styles.selectText : styles.placeholderText}>
                {visaStatus || 'Select visa / PR status'}
              </Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  optional: { color: colours.textMuted, fontFamily: typography.fontFamily.regular },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colours.textPrimary,
    minHeight: 48,
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  selectText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  placeholderText: { fontSize: typography.fontSize.base, color: colours.textMuted },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colours.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    paddingTop: spacing.lg,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semiBold,
    color: colours.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetRow: { height: 52, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  sheetRowActive: { backgroundColor: colours.primaryLight },
  sheetRowText: { fontSize: typography.fontSize.base, color: colours.textPrimary },
  sheetRowTextActive: { color: colours.primary, fontFamily: typography.fontFamily.semiBold },
});
