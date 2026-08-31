import React from 'react';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';
import { CONFIG } from '../../constants/config';

// Mirrors frontend/src/pages/Privacy.jsx (rewritten 26 Aug 2026, see
// docs/LEGAL_REVIEW_2026-08-26.md). Written against what
// backend/utils/accountErasure.js actually does — if erasure changes, change
// section 13 here and on the website in the same commit.
export default function PrivacyScreen() {
  const entity = CONFIG.LEGAL_ENTITY;
  const officer = CONFIG.GRIEVANCE_OFFICER ? ` — ${CONFIG.GRIEVANCE_OFFICER}` : '';
  const address = CONFIG.LEGAL_ADDRESS ? ` · ${entity}, ${CONFIG.LEGAL_ADDRESS}` : '';

  return (
    <LegalLayout title="Privacy Policy" subtitle={`Last updated: ${CONFIG.LEGAL_UPDATED}`}>
      <Section>
        <Para>
          A matrimonial profile is one of the most personal things a person publishes about
          themselves — date and place of birth, caste, income, family, photographs. This policy says
          exactly what we collect, why, who else sees it, how long we keep it, and what you can make
          us do about it. It applies to tricitymatch.com and to the TricityMatch mobile applications.
        </Para>
        <Para>
          {entity} is the Data Fiduciary for this information under the Digital Personal Data
          Protection Act, 2023 ("DPDP Act"); you are the Data Principal. We also handle your
          information in line with the Information Technology Act, 2000 and the rules made under it,
          including the Reasonable Security Practices (SPDI) Rules, 2011 to the extent they remain in
          force.
        </Para>
        {CONFIG.LEGAL_ADDRESS ? <Para>Our address: {entity}, {CONFIG.LEGAL_ADDRESS}.</Para> : null}
      </Section>

      <Section heading="1. What we collect">
        <Bullet>Account details — your email address and/or mobile number, a hashed password, and, if you use Google Sign-In, the basic profile Google returns.</Bullet>
        <Bullet>Profile information — name, gender, date of birth, height, weight, marital status and number of children, city and state, NRI/residence status, religion, caste, sub-caste and gotra, mother tongue and languages, diet, smoking and drinking habits, education, profession and income range, family details, photographs, voice and video introductions, bio, prompts, interests, personality answers and your partner preferences.</Bullet>
        <Bullet>Horoscope details — place of birth, time of birth, manglik status, rashi and nakshatra, where you provide them, used for Ashtakoot and numerology matching.</Bullet>
        <Bullet>Verification selfie — if you opt into photo verification, a live selfie captured through your device camera (section 9).</Bullet>
        <Bullet>Activity — interests, shortlists, mutual matches, profiles you viewed and who viewed you, contact details you unlocked, blocks and reports.</Bullet>
        <Bullet>Messages — the text, voice notes and reactions you exchange with other members, and family-group messages.</Bullet>
        <Bullet>Calls — if you use in-app voice or video calling, the fact, time and duration. We do not record calls.</Bullet>
        <Bullet>Payment records — plan, amount, date and the payment and order identifiers our payment provider returns. We never receive or store your card, UPI or bank credentials.</Bullet>
        <Bullet>Guardian and family information — if you invite a guardian, or someone creates a profile for you, the name and contact details needed to link the two accounts.</Bullet>
        <Bullet>Technical data — IP address, device and app information, and server logs, used for security and abuse prevention. If you enable push notifications we store the device push token.</Bullet>
        <Bullet>Counters — a small set of anonymous product counters used to see where people get stuck. They carry no message or profile content.</Bullet>
        <Para>Sensitive categories: religion, caste and community, horoscope details, your photographs and verification selfie, and financial information. We collect them because matrimonial matching in India cannot work without them, only with your consent, and every field beyond the minimum needed to register is optional.</Para>
      </Section>

      <Section heading="2. Why we use it, and on what basis">
        <Para>We process your data on the basis of the consent you give when you register and when you add each optional detail, and for the "legitimate uses" the DPDP Act permits. Specifically:</Para>
        <Bullet>to create and display your profile according to your privacy settings;</Bullet>
        <Bullet>to find and rank matches for you, and show your profile in others' searches;</Bullet>
        <Bullet>to enable interests, messaging and calling between members;</Bullet>
        <Bullet>to verify accounts, detect fraud and fake profiles, and act on reports and blocks;</Bullet>
        <Bullet>to take payment, run memberships and unlocks, and issue invoices;</Bullet>
        <Bullet>to send service messages — passcodes, security alerts, match and message notifications, membership notices;</Bullet>
        <Bullet>to answer support requests and grievances;</Bullet>
        <Bullet>to keep the Service secure and meet our obligations under Indian law.</Bullet>
        <Para>We do not use your data for behavioural advertising, and we do not sell it to anyone.</Para>
      </Section>

      <Section heading="3. Automated matching">
        <Para>Match suggestions, compatibility percentages, Ashtakoot guna scores and numerology readings are generated automatically from what you and other members provide. Search results are ordered by relevance; a profile may rank higher because the member has an active boost, or lower because it has no photograph.</Para>
        <Para>These are suggestions and nothing more. No decision with a legal or similarly significant effect on you is made automatically, and you can change what feeds them by editing your profile and preferences.</Para>
      </Section>

      <Section heading="4. Who can see your profile">
        <Para>Your profile is shown to other logged-in members and to a guardian linked to a member. It is not published on the open internet and is not indexed by search engines. In Settings → Privacy you can:</Para>
        <Bullet>set your profile to Everyone or Matches only;</Bullet>
        <Bullet>turn off your online status and last-seen time;</Bullet>
        <Bullet>blur your photographs until you match;</Bullet>
        <Bullet>hide your phone number and email on your profile;</Bullet>
        <Bullet>turn on incognito browsing, so you do not appear in others' "who viewed me".</Bullet>
        <Para>Your phone number and email are never shown to another member unless they unlock your contact details using a paid allowance, or you share them yourself in chat. Once shared, we cannot take information back out of somebody's phone — please share carefully.</Para>
      </Section>

      <Section heading="5. Who we share it with">
        <Para>We do not sell personal data and do not share it for anyone else's marketing. We share it only with processors who work for us, under contract:</Para>
        <Bullet>Razorpay — payments, refunds and invoices. Google Play processes some purchases made in the Android app.</Bullet>
        <Bullet>Cloudinary — hosting your photographs, voice and video intros and voice messages.</Bullet>
        <Bullet>Our email provider — passcodes, security alerts, match and membership notices.</Bullet>
        <Bullet>Our SMS provider — one-time passcodes to your mobile number.</Bullet>
        <Bullet>Firebase Cloud Messaging — push notifications, if you enable them.</Bullet>
        <Bullet>Agora — carrying in-app voice and video calls, if you use them.</Bullet>
        <Bullet>Our hosting and monitoring providers — running the servers and database and alerting us to errors.</Bullet>
        <Bullet>Astrologers you book a consultation with receive the horoscope details needed for it.</Bullet>
        <Bullet>Legal and safety — courts, police and government agencies where the law requires it, and where necessary to protect members or the public.</Bullet>
        <Bullet>A successor — if the business is transferred, your data moves with it under this policy, and we will tell you.</Bullet>
      </Section>

      <Section heading="6. Transfers outside India">
        <Para>Some of the processors above operate outside India — for example image hosting and email delivery. Where that happens, your data is transferred under contract and only for the stated purpose, as section 16 of the DPDP Act permits, and never to a country the Central Government has restricted.</Para>
      </Section>

      <Section heading="7. Messages, notifications & your choices">
        <Bullet>Service messages — passcodes, password resets, security alerts, receipts and expiry notices. These are part of the Service and cannot be switched off while you have an account.</Bullet>
        <Bullet>Match and activity notifications — new matches, interests, messages, digests and reminders. Every email of this kind carries an unsubscribe link, and push notifications can be turned off in Settings or in your device settings.</Bullet>
        <Bullet>SMS is used only for one-time passcodes, not for marketing.</Bullet>
      </Section>

      <Section heading="8. Cookies & on-device storage">
        <Para>We use secure tokens strictly for authentication. We do not use advertising cookies, cross-site trackers, or third-party analytics that profile you. Limited on-device storage remembers preferences such as language, theme, and a draft you have not sent.</Para>
      </Section>

      <Section heading="9. Your verification selfie">
        <Para>Photo verification is optional. If you use it, we capture a live selfie through your device camera — there is no upload option, because an uploaded photograph can be someone else's. A reviewer compares it against your profile photographs and records only the result. The selfie is never shown to other members, is not used for advertising or training, and is deleted when your account is deleted. You can decline verification, and you can withdraw your consent by writing to us.</Para>
      </Section>

      <Section heading="10. Profiles created by a guardian">
        <Para>Where a parent or relative creates a profile for you, they must have your agreement and must show you this policy. Whether or not you created it, the data in it is yours: write to {CONFIG.PRIVACY_EMAIL} to see it, correct it, take control of it, or have it deleted, and we will act on your instruction over the guardian's.</Para>
      </Section>

      <Section heading="11. Success stories">
        <Para>We publish success stories only from members who submit them and agree to publication, and only after review. Tell us and we will take yours down.</Para>
      </Section>

      <Section heading="12. Security & what we do if something goes wrong">
        <Para>We encrypt traffic in transit (HTTPS), store passwords hashed, rate-limit and lock out repeated login attempts, restrict administrative access by role, keep an audit trail of administrative actions, and validate the files you upload. No system is perfectly secure and we do not claim otherwise.</Para>
        <Para>If a personal data breach affects you, we will tell you without delay in plain language: what happened, what data was involved, what we have done, what you can do, and who to contact. We will report it to CERT-In within six hours of becoming aware of it, as its 2022 Directions require, and to the Data Protection Board of India without delay with a full account within 72 hours, as the DPDP Rules require.</Para>
      </Section>

      <Section heading="13. How long we keep things, and what deletion really does">
        <Para>We keep your data while your account is active. You can delete your account yourself at any time from Settings → Delete Account. Deletion is real, and this is exactly what it does:</Para>
        <Bullet>Erased — your profile and every field in it, your photographs, voice and video intros, your verification selfie, your matches, shortlists, contact unlocks, profile views, notifications, call records, guardian links, blocks and sessions.</Bullet>
        <Bullet>Message text is destroyed, and the empty row is left in place so the other person's conversation does not develop holes.</Bullet>
        <Bullet>Retained — payment and membership records, because tax and accounting law requires them and refunds must be reconcilable; and moderation records where another member has reported you, because a report should not be erasable by the person reported.</Bullet>
        <Bullet>Registration information is held for 180 days after deletion, because rule 3(1)(h) of the IT Rules, 2021 requires it, and then goes.</Bullet>
        <Bullet>Content removed on a complaint or an official order, and its records, are preserved for 180 days for investigation, or longer if a court or agency requires it.</Bullet>
        <Bullet>Server and security logs are kept for a rolling period as required by the CERT-In Directions, 2022, and then rotate out.</Bullet>
        <Para>Where you withdraw consent for something optional, or an account has been inactive and its purpose is served, we erase the related data unless a law requires us to keep it.</Para>
      </Section>

      <Section heading="14. Your rights, and how to use them">
        <Para>Under the DPDP Act you have the right to:</Para>
        <Bullet>Know what personal data of yours we hold and process, and who we have shared it with;</Bullet>
        <Bullet>Correct, complete or update it, and erase it where it is no longer needed;</Bullet>
        <Bullet>Withdraw your consent at any time, as easily as you gave it — by editing or clearing a field, turning a setting off, unsubscribing, or writing to us. Withdrawing consent for something the Service needs (your date of birth, for example) means we can no longer keep your profile, so it is the same as deleting your account;</Bullet>
        <Bullet>Nominate another person to exercise these rights for you if you die or become unable to act. Write to us with their name and contact details and we will record it;</Bullet>
        <Bullet>Have your grievance redressed (section 15).</Bullet>
        <Para>Most of this is in your own hands: edit your profile, change your privacy settings, unsubscribe, or delete your account. For anything else write to {CONFIG.PRIVACY_EMAIL} from your registered email address. We respond to rights requests within 30 days. We may need to confirm who you are first — we will not hand your data to somebody claiming to be you.</Para>
        <Para>The Act also asks something of you: give us information that is true, do not impersonate anyone, and do not file a false or frivolous complaint.</Para>
      </Section>

      <Section heading="15. Grievances, and who to go to next">
        <Bullet>Data protection queries and complaints: {CONFIG.PRIVACY_EMAIL}. We acknowledge within 24 hours and resolve within 15 days, and in no case later than 30 days.</Bullet>
        <Bullet>Grievance Officer{officer}: {CONFIG.GRIEVANCE_EMAIL}{address}. For complaints about content, conduct or this policy, under rule 3(2) of the IT Rules, 2021.</Bullet>
        <Bullet>Everything else: {CONFIG.SUPPORT_EMAIL}.</Bullet>
        <Bullet>If we do not resolve it: you may complain to the Data Protection Board of India about your personal data, or to the consumer commission where you live under the Consumer Protection Act, 2019.</Bullet>
      </Section>

      <Section heading="16. Children">
        <Para>TricityMatch is only for adults of legal marriageable age — 21 and above for men, 18 and above for women. We do not knowingly collect the personal data of a child, we do not process children's data at all, and we do not track or profile children or show them advertising. If you believe a minor has registered, write to {CONFIG.PRIVACY_EMAIL} and we will remove the account and the data.</Para>
      </Section>

      <Section heading="17. Changes to this policy">
        <Para>We may update this policy. The "Last updated" date above always shows when. For a material change we will notify you in the app or by email before it takes effect, and we will remind you of this policy at least once a year.</Para>
      </Section>
    </LegalLayout>
  );
}
