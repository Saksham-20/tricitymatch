import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colours, typography, spacing, borderRadius } from '@shared/constants/theme';
import { apiClient } from '../../api/client';

// Public contact form → POST /contact (mirrors frontend/src/pages/Contact.jsx).
export default function ContactScreen() {
  const navigation = useNavigation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      Alert.alert('Missing details', 'Please fill in your name, email and message.');
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
      Alert.alert('Message sent', 'Thanks for reaching out — we’ll get back to you soon.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      navigation.goBack();
    } catch {
      Alert.alert('Could not send', 'Something went wrong. Please try again or email support@tricityshadi.com.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.wrapper}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colours.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Contact Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Get in touch</Text>
          <Text style={s.subtitle}>Questions, feedback, or need help? Send us a message.</Text>

          <Field label="Name" value={form.name} onChange={set('name')} placeholder="Your name" />
          <Field label="Email" value={form.email} onChange={set('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone (optional)" value={form.phone} onChange={set('phone')} placeholder="Mobile number" keyboardType="phone-pad" />
          <Field label="Subject (optional)" value={form.subject} onChange={set('subject')} placeholder="What's this about?" />
          <Field label="Message" value={form.message} onChange={set('message')} placeholder="How can we help?" multiline />

          <TouchableOpacity style={[s.cta, sending && s.ctaDisabled]} onPress={submit} disabled={sending} testID="contact-submit">
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Send message</Text>}
          </TouchableOpacity>

          <Text style={s.altContact}>Or email us at support@tricityshadi.com</Text>
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
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colours.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:     { flex: 1, backgroundColor: colours.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colours.border },
  back:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary },
  content:     { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  title:       { fontSize: typography.fontSize['2xl'], fontFamily: typography.fontFamily.bold, color: colours.textPrimary },
  subtitle:    { fontSize: typography.fontSize.sm, color: colours.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  field:       { marginBottom: spacing.md },
  label:       { fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily.semiBold, color: colours.textPrimary, marginBottom: spacing.xs },
  input:       { borderWidth: 1, borderColor: colours.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, color: colours.textPrimary, backgroundColor: colours.surfaceCard },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  cta:         { backgroundColor: colours.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  ctaDisabled: { opacity: 0.6 },
  ctaText:     { color: '#fff', fontSize: typography.fontSize.base, fontFamily: typography.fontFamily.bold },
  altContact:  { fontSize: typography.fontSize.sm, color: colours.textMuted, textAlign: 'center', marginTop: spacing.lg },
});
