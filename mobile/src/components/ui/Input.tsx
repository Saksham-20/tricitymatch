import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colours, spacing, typography } from '@shared/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  /** Renders an eye icon that toggles secureTextEntry */
  secureToggle?: boolean;
  /** testID for the eye-toggle button — defaults to `${testID}-toggle` */
  toggleTestID?: string;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helper, secureToggle, toggleTestID, secureTextEntry, style, containerStyle, testID, ...rest },
  ref
) {
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={[styles.group, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldRow}>
        <TextInput
          ref={ref}
          style={[styles.input, secureToggle && styles.inputWithIcon, !!error && styles.inputError, style]}
          placeholderTextColor={colours.textMuted}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          testID={testID}
          {...rest}
        />
        {secureToggle ? (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setHidden((v) => !v)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            testID={toggleTestID ?? (testID ? `${testID}-toggle` : undefined)}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colours.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colours.textPrimary,
    marginBottom: spacing.sm,
  },
  fieldRow: { position: 'relative' },
  input: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colours.textPrimary,
    backgroundColor: colours.surfaceCard,
    minHeight: 52,
  },
  inputWithIcon: { paddingRight: 52 },
  inputError: { borderColor: colours.error },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colours.error,
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colours.textMuted,
    marginTop: spacing.xs,
  },
});
