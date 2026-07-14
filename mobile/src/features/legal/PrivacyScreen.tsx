import React from 'react';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';

// Mirrors frontend/src/pages/Privacy.jsx (Last updated: July 2026).
export default function PrivacyScreen() {
  return (
    <LegalLayout title="Privacy Policy" subtitle="Last updated: July 2026">
      <Section>
        <Para>
          TricityShadi respects your privacy. This policy explains what personal information we
          collect, how we use and protect it, and the choices you have. We handle your data in line
          with applicable Indian law, including the Digital Personal Data Protection Act, 2023.
        </Para>
      </Section>

      <Section heading="1. Information We Collect">
        <Bullet>Profile information — name, gender, date of birth, photos, education, profession, income range, religion, community, location, lifestyle, partner preferences, and any bio or horoscope details you add.</Bullet>
        <Bullet>Contact details — email address and/or mobile number, used for sign-in, verification, and notifications.</Bullet>
        <Bullet>Verification selfie — if you opt into photo verification, a live selfie captured through your device camera (see Section 5).</Bullet>
        <Bullet>Communications — messages you exchange with other members on the platform.</Bullet>
        <Bullet>Technical data — device and app information, IP address, and usage activity, used for security and to operate the Service.</Bullet>
      </Section>

      <Section heading="2. How We Use Your Information">
        <Bullet>To create your profile and match you with compatible members</Bullet>
        <Bullet>To enable communication between mutually interested members</Bullet>
        <Bullet>To verify accounts and keep the community safe from fraud and abuse</Bullet>
        <Bullet>To process payments and manage subscriptions</Bullet>
        <Bullet>To send account and service-related notifications (email, SMS, or push)</Bullet>
        <Bullet>To improve, personalise, and secure the Service</Bullet>
      </Section>

      <Section heading="3. Information Sharing">
        <Para>We do not sell your personal information. We share data only as needed to run the Service:</Para>
        <Bullet>Other members — your profile information, shown according to your privacy settings. Contact details are revealed only when unlocked as part of a paid plan.</Bullet>
        <Bullet>Service providers — trusted partners who process data on our behalf: Razorpay and Google Play (payments), Cloudinary (image storage), and our email/SMS providers for OTP and notifications.</Bullet>
        <Bullet>Legal authorities — when required by law, or to protect the rights, property, or safety of our users or the public.</Bullet>
      </Section>

      <Section heading="4. Profile Visibility & Your Controls">
        <Para>You control who can see your profile in Settings → Privacy. You can set your profile to be visible to Everyone or to Matches Only, and choose whether to show your online status and last-seen time. You can update or remove your photos and profile details at any time.</Para>
      </Section>

      <Section heading="5. Verification Selfie">
        <Para>Photo verification is optional. If you use it, we capture a live selfie through your device camera and our review team compares it against your profile photos to confirm you are a real person. Your verification selfie is used only for this review — it is never shown to other members and is not used for advertising.</Para>
      </Section>

      <Section heading="6. Data Security">
        <Para>We use industry-standard safeguards, including encryption in transit (HTTPS), secure authentication tokens, and hashed passwords. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</Para>
      </Section>

      <Section heading="7. Data Retention">
        <Para>We keep your data while your account is active. When you delete your account, your profile is removed from public view and permanently purged within a reasonable period, except where limited information must be retained to meet legal, security, or fraud-prevention obligations.</Para>
      </Section>

      <Section heading="8. Your Rights">
        <Para>You have the right to access, correct, update, or delete your personal data, and to withdraw consent for optional processing such as verification. You can manage most of this from your profile and settings, or by contacting us at privacy@tricityshadi.com.</Para>
      </Section>

      <Section heading="9. Cookies & Local Storage">
        <Para>We use secure tokens strictly for authentication. We do not use them for advertising or cross-site tracking. Limited on-device storage is used only to remember your preferences.</Para>
      </Section>

      <Section heading="10. Children's Privacy">
        <Para>TricityShadi is intended only for adults aged 18 and above. We do not knowingly collect information from minors. If you believe a minor has provided us data, please contact us and we will remove it.</Para>
      </Section>

      <Section heading="11. Changes to This Policy">
        <Para>We may update this Privacy Policy from time to time. Material changes will be reflected in the "Last updated" date above and, where appropriate, notified to you.</Para>
      </Section>

      <Section heading="12. Grievances & Contact">
        <Para>For any privacy-related question or request, contact us at privacy@tricityshadi.com. In accordance with applicable Indian law, you may also reach our Grievance Officer at grievance@tricityshadi.com, and we will respond within the timelines prescribed by law.</Para>
      </Section>
    </LegalLayout>
  );
}
