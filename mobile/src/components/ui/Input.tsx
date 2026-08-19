import React, { forwardRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
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
import { borderRadius, colours, type, type ThemeColours } from '@shared/constants/theme';

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
  { label, error, helper, secureToggle, toggleTestID, secureTextEntry, style, containerStyle, testID, onFocus, onBlur, ...rest },
  ref
) {
  const { c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.group, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldRow}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            secureToggle && styles.inputWithIcon,
            focused && styles.inputFocused,
            !!error && styles.inputError,
            style,
          ]}
          placeholderTextColor={c.n400}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          testID={testID}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {secureToggle ? (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setHidden((v) => !v)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            testID={toggleTestID ?? (testID ? `${testID}-toggle` : undefined)}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textMuted} />
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

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  group: { marginBottom: 15 },
  label: {
    ...type.footnote,
    fontFamily: 'Inter-SemiBold',
    color: c.textPrimary,
    marginBottom: 6,
  },
  fieldRow: { position: 'relative' },
  input: {
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...type.body,
    color: c.fgStrong,
    backgroundColor: c.surfaceCard,
    minHeight: 50,
  },
  inputWithIcon: { paddingRight: 52 },
  inputFocused: {
    borderColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  inputError: { borderColor: c.error },
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
    ...type.caption,
    fontFamily: 'Inter-Medium',
    color: c.error,
    marginTop: 5,
  },
  helperText: {
    ...type.caption,
    color: c.textMuted,
    marginTop: 5,
  },
});
