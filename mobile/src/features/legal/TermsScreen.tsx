import React from 'react';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';

// Mirrors frontend/src/pages/Terms.jsx (Last updated: July 2026).
export default function TermsScreen() {
  return (
    <LegalLayout title="Terms of Service" subtitle="Last updated: July 2026">
      <Section>
        <Para>
          Welcome to TricityShadi — a matrimonial platform for the Tricity region (Chandigarh,
          Mohali, and Panchkula) and beyond. These Terms of Service ("Terms") are an agreement
          between you and TricityShadi. By creating an account or using the platform, you accept
          these Terms.
        </Para>
      </Section>

      <Section heading="1. Acceptance of Terms">
        <Para>By accessing or using TricityShadi ("the Service"), you agree to be bound by these Terms. If you do not agree, please do not use the Service.</Para>
      </Section>

      <Section heading="2. Eligibility">
        <Para>You must be at least 18 years of age and legally competent to marry under the laws applicable to you, and you must be creating a profile for a genuine matrimonial purpose — for yourself, or, where our guardian feature is used, on behalf of a consenting family member.</Para>
      </Section>

      <Section heading="3. Account Registration & Guardian Profiles">
        <Para>Provide accurate, current, and complete information, and keep it updated. You are responsible for your login credentials and all activity under your account. If you create or manage a profile for a family member (a "guardian" profile), you confirm you have that person's consent.</Para>
      </Section>

      <Section heading="4. Verification">
        <Para>We offer optional photo verification, in which you capture a live selfie that our team compares against your profile photos to confirm you are a real person. Verification builds trust but is not a background check, and a verified badge is not a guarantee of any user's identity, character, intentions, or the accuracy of their information. Always exercise your own judgement.</Para>
      </Section>

      <Section heading="5. Acceptable Use">
        <Para>You agree not to use the Service to:</Para>
        <Bullet>Post false, misleading, or fraudulent information, or impersonate any person</Bullet>
        <Bullet>Harass, abuse, threaten, stalk, or harm other users</Bullet>
        <Bullet>Solicit money, gifts, or financial or commercial favours from other users</Bullet>
        <Bullet>Send spam, advertising, or unsolicited promotional content</Bullet>
        <Bullet>Upload obscene, unlawful, or infringing content</Bullet>
        <Bullet>Collect or misuse other users' data, or contact them off-platform without consent</Bullet>
        <Bullet>Violate any applicable law, or circumvent the platform's security or payment features</Bullet>
        <Para>Contact details of other members are unlocked only through your plan's allowance and must be used solely for genuine matrimonial communication.</Para>
      </Section>

      <Section heading="6. Your Content">
        <Para>You retain ownership of the content you upload. By uploading it, you grant TricityShadi a limited licence to host, display, and process that content to operate the Service (for example, showing your profile to other members according to your privacy settings). You are responsible for having the rights to any content you upload.</Para>
      </Section>

      <Section heading="7. Subscriptions & Payments">
        <Para>Some features require a paid plan, billed in advance for a fixed term. Plans do not auto-renew — they expire at the end of the term unless you purchase again. Fees are non-refundable except where required by law. On Android, payments are processed by Razorpay or Google Play; on iPhone, subscriptions are purchased on our website. We do not store your card details.</Para>
      </Section>

      <Section heading="8. No Guarantee of Outcome">
        <Para>TricityShadi helps you discover and connect with prospective matches. We do not guarantee that you will find a match, a response, or a marriage, and we are not a party to any relationship that results from using the Service.</Para>
      </Section>

      <Section heading="9. Privacy">
        <Para>Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</Para>
      </Section>

      <Section heading="10. Suspension & Termination">
        <Para>We may suspend or terminate your account if you breach these Terms, misuse the platform, or put other members at risk. You may delete your account at any time from Settings. Some information may be retained after deletion as described in the Privacy Policy.</Para>
      </Section>

      <Section heading="11. Disclaimer of Warranties">
        <Para>The Service is provided "as is" and "as available" without warranties of any kind. We do not verify the accuracy of user-provided information beyond the optional verification described above, and we are not responsible for the conduct of any user, online or offline.</Para>
      </Section>

      <Section heading="12. Limitation of Liability">
        <Para>To the maximum extent permitted by law, TricityShadi shall not be liable for any indirect, incidental, special, or consequential damages, or for the acts or omissions of any user, arising from your use of the Service.</Para>
      </Section>

      <Section heading="13. Governing Law">
        <Para>These Terms are governed by the laws of India. Subject to applicable law, the courts at Chandigarh shall have jurisdiction over any dispute arising from these Terms or your use of the Service.</Para>
      </Section>

      <Section heading="14. Changes to These Terms">
        <Para>We may update these Terms from time to time. When we do, we will revise the "Last updated" date above. Your continued use of the Service after changes take effect means you accept the updated Terms.</Para>
      </Section>

      <Section heading="15. Grievances & Contact">
        <Para>For questions about these Terms, or to report content or conduct, contact us at support@tricityshadi.com. In line with applicable Indian law, complaints regarding content or data may be addressed to our Grievance Officer at grievance@tricityshadi.com, and we will acknowledge and endeavour to resolve them within the timelines prescribed by law.</Para>
      </Section>
    </LegalLayout>
  );
}
