import React, { useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Screen from '../../components/layout/Screen';
import { showToast } from '../../utils/toast';
import { useNavigation } from '@react-navigation/native';
import { spacing } from '@shared/constants/theme';
import { apiClient } from '../../api/client';
import { CONFIG } from '../../constants/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Field limits mirror the server's contactValidation (backend/validators/index.js):
// name 2-100, message 10-2000, phone <= 20, subject <= 150. A client that only
// checks "not empty" lets "Help" through and gets a 400 no retry can clear.
const LIMITS = { name: 100, phone: 20, subject: 150, message: 2000 } as const;
const MIN_NAME = 2;
const MIN_MESSAGE = 10;

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

const fieldProblem = {
  name: (v: string): string | undefined =>
    v.trim().length < MIN_NAME ? 'Enter your full name.' : undefined,
  email: (v: string): string | undefined =>
    !v.trim()
      ? 'Enter your email so we can reply.'
      : !EMAIL_RE.test(v.trim())
        ? 'Enter a valid email address.'
        : undefined,
  message: (v: string): string | undefined =>
    v.trim().length < MIN_MESSAGE ? `Tell us a little more (at least ${MIN_MESSAGE} characters).` : undefined,
};

/** Names the real reason a send failed instead of a blanket "please try again". */
const sendFailureMessage = (err: unknown): string => {
  const e = err as {
    retryAfter?: number;
    response?: { data?: { error?: { message?: string }; message?: string } };
  };
  // api/client rewrites a 429 into a plain Error carrying `retryAfter` (no `response`).
  if (e?.retryAfter) return `Too many messages from this connection. Try again later, or email ${CONFIG.SUPPORT_EMAIL}.`;
  if (!e?.response) return 'Could not reach the server. Check your connection and try again.';
  const message = e.response.data?.error?.message ?? e.response.data?.message;
  // Production sends only "Validation failed" for a bad field; that says nothing.
  if (message && message !== 'Validation failed') return message;
  return `Check your details and try again, or email ${CONFIG.SUPPORT_EMAIL}.`;
};

// Public contact form → POST /contact (mirrors frontend/src/pages/Contact.jsx).
export default function ContactScreen() {
  const navigation = useNavigation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Validate on blur as well as on submit, and only once something is typed:
  // an empty field on blur is "not there yet", not "wrong".
  const blur = (k: keyof FormErrors) => () => {
    if (form[k].trim()) setErrors((e) => ({ ...e, [k]: fieldProblem[k](form[k]) }));
  };

  const submit = async () => {
    const next: FormErrors = {
      name: fieldProblem.name(form.name),
      email: fieldProblem.email(form.email),
      message: fieldProblem.message(form.message),
    };
    setErrors(next);
    const first = Object.values(next).find(Boolean);
    if (first) {
      AccessibilityInfo.announceForAccessibility(first);
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
      showToast.success('Message sent', 'Thanks for reaching out. We’ll get back to you soon.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      navigation.goBack();
    } catch (err) {
      showToast.error('Could not send', sendFailureMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard testID="ContactScreen">
      <ScreenHeader title="Contact us" testID="contact-header" />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text variant="title2" color="textPrimary" accessibilityRole="header">Get in touch</Text>
        <Text variant="subhead" color="textSecondary" style={s.subtitle}>Questions, feedback, or need help? Send us a message.</Text>

        <Input
          label="Name"
          value={form.name}
          onChangeText={set('name')}
          onBlur={blur('name')}
          placeholder="Your name"
          textContentType="name"
          maxLength={LIMITS.name}
          error={errors.name}
          testID="contact-name"
          accessibilityLabel="Name"
        />
        <Input
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          onBlur={blur('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          error={errors.email}
          testID="contact-email"
          accessibilityLabel="Email"
        />
        <Input
          label="Phone (optional)"
          value={form.phone}
          onChangeText={set('phone')}
          placeholder="Mobile number"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          maxLength={LIMITS.phone}
          testID="contact-phone"
          accessibilityLabel="Phone (optional)"
        />
        <Input
          label="Subject (optional)"
          value={form.subject}
          onChangeText={set('subject')}
          placeholder="What's this about?"
          maxLength={LIMITS.subject}
          testID="contact-subject"
          accessibilityLabel="Subject (optional)"
        />
        <Input
          label="Message"
          value={form.message}
          onChangeText={set('message')}
          onBlur={blur('message')}
          placeholder="How can we help?"
          multiline
          numberOfLines={5}
          maxLength={LIMITS.message}
          containerStyle={s.messageGroup}
          style={s.inputMultiline}
          error={errors.message}
          testID="contact-message"
          accessibilityLabel="Message"
        />
        <Text variant="footnote" color="textSecondary" style={s.counter}>{form.message.length}/{LIMITS.message}</Text>

        <Button
          title="Send message"
          onPress={submit}
          loading={sending}
          // The success toast fires its own haptic; one per committed action.
          haptic={false}
          testID="contact-submit"
          accessibilityLabel="Send message"
          style={s.cta}
        />

        <Text variant="subhead" color="textSecondary" style={s.altContact} selectable>Or email us at {CONFIG.SUPPORT_EMAIL}</Text>
        <Text variant="footnote" color="textSecondary" style={s.altContact} selectable>
          Grievance Officer{CONFIG.GRIEVANCE_OFFICER ? ` (${CONFIG.GRIEVANCE_OFFICER})` : ''}: {CONFIG.GRIEVANCE_EMAIL}. Complaints are acknowledged within 24 hours and decided within 15 days.
        </Text>
      </ScrollView>
    </Screen>
  );
}

// Layout only, no colour: the Text/Input/Button primitives own theming.
const s = StyleSheet.create({
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  subtitle:    { marginTop: 2, marginBottom: spacing.lg },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  messageGroup: { marginBottom: spacing.xs },
  counter:     { textAlign: 'right', marginBottom: spacing.md },
  cta:         { marginTop: spacing.sm },
  altContact:  { textAlign: 'center', marginTop: spacing.lg },
});
