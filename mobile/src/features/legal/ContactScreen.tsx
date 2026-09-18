import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Text from '../../components/ui/Text';
import { PressableScale } from '../../components/motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../../utils/toast';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius, type ThemeColours } from '@shared/constants/theme';
import { apiClient } from '../../api/client';

// Public contact form → POST /contact (mirrors frontend/src/pages/Contact.jsx).
export default function ContactScreen() {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  const navigation = useNavigation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      showToast.error('Missing details', 'Please fill in your name, email and message.');
      return;
    }
    setSending(true);
    try {
      await apiClient.post('/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      showToast.success('Message sent', 'Thanks for reaching out — we’ll get back to you soon.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      navigation.goBack();
    } catch {
      showToast.error('Could not send', 'Please try again or email support@tricitymatch.com.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.wrapper}>
      <View style={s.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={c.textPrimary} />
        </PressableScale>
        <Text variant="headline" color="textPrimary" style={s.headerTitle}>Contact Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text variant="title2" color="textPrimary">Get in touch</Text>
          <Text variant="subhead" color="textSecondary" style={s.subtitle}>Questions, feedback, or need help? Send us a message.</Text>

          <Field label="Name" value={form.name} onChange={set('name')} placeholder="Your name" />
          <Field label="Email" value={form.email} onChange={set('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone (optional)" value={form.phone} onChange={set('phone')} placeholder="Mobile number" keyboardType="phone-pad" />
          <Field label="Subject (optional)" value={form.subject} onChange={set('subject')} placeholder="What's this about?" />
          <Field label="Message" value={form.message} onChange={set('message')} placeholder="How can we help?" multiline />

          <PressableScale
            style={[s.cta, sending && s.ctaDisabled]}
            onPress={submit}
            disabled={sending}
            testID="contact-submit"
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: sending }}
            pressRetentionOffset={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text variant="headline" style={s.ctaText}>Send message</Text>}
          </PressableScale>

          <Text variant="subhead" color="textMuted" style={s.altContact}>Or email us at support@tricitymatch.com</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const { c } = useTheme();
  const s = React.useMemo(() => makeS(c), [c]);
  return (
    <View style={s.field}>
      <Text variant="subhead" color="textPrimary" style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const makeS = (c: ThemeColours) => StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  back:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  subtitle:    { marginTop: 2, marginBottom: spacing.lg },
  field:       { marginBottom: spacing.md },
  label:       { marginBottom: spacing.xs },
  input:       { borderWidth: 1, borderColor: c.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, color: c.textPrimary, backgroundColor: c.surfaceCard },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  cta:         { backgroundColor: c.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  ctaDisabled: { opacity: 0.6 },
  ctaText:     { color: '#fff' },
  altContact:  { textAlign: 'center', marginTop: spacing.lg },
});
