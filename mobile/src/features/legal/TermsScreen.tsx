import React from 'react';
import { LegalLayout, Section, Para, Bullet } from './LegalLayout';
import { CONFIG } from '../../constants/config';

// Mirrors frontend/src/pages/Terms.jsx. Both were rewritten 26 Aug 2026 against
// docs/LEGAL_REVIEW_2026-08-26.md — if you change one, change the other in the
// same commit. Values only the owner holds (entity, address, Grievance Officer
// name) come from CONFIG and are OMITTED when unset, never faked.
export default function TermsScreen() {
  const entity = CONFIG.LEGAL_ENTITY;
  const officer = CONFIG.GRIEVANCE_OFFICER ? ` — ${CONFIG.GRIEVANCE_OFFICER}` : '';
  const address = CONFIG.LEGAL_ADDRESS ? ` · ${entity}, ${CONFIG.LEGAL_ADDRESS}` : '';

  return (
    <LegalLayout title="Terms of Service" subtitle={`Last updated: ${CONFIG.LEGAL_UPDATED}`}>
      <Section>
        <Para>
          TricityMatch is a matrimonial platform for the Tricity region — Chandigarh, Mohali and
          Panchkula — and for families from the region living elsewhere. These Terms of Service
          ("Terms") are a legally binding agreement between you and {entity} ("TricityMatch", "we",
          "us"), the operator of tricitymatch.com and the TricityMatch mobile applications (together,
          the "Service"). By creating an account or using the Service you accept these Terms and our
          Privacy Policy.
        </Para>
        {CONFIG.LEGAL_ADDRESS ? (
          <Para>Operator: {entity}, {CONFIG.LEGAL_ADDRESS}.</Para>
        ) : null}
        <Para>
          TricityMatch is an "intermediary" under section 2(1)(w) of the Information Technology Act,
          2000. We host information provided by our members; we do not author it, and we do not vouch
          for it.
        </Para>
      </Section>

      <Section heading="1. Acceptance of these Terms">
        <Para>By accessing, registering for, or using the Service you agree to be bound by these Terms. If you do not agree, please do not use the Service. If you are using the Service on behalf of a family member, you agree to these Terms both for yourself and on their behalf.</Para>
      </Section>

      <Section heading="2. Eligibility">
        <Para>To register you must:</Para>
        <Bullet>be of legal marriageable age in India — 21 years or above if you are a man, 18 years or above if you are a woman (Prohibition of Child Marriage Act, 2006) — or of legal marriageable age under the law that applies to you, if higher;</Bullet>
        <Bullet>be legally competent to contract and to marry, and not be within a degree of relationship prohibited by the law applicable to you;</Bullet>
        <Bullet>be unmarried, divorced, widowed, or otherwise lawfully free to marry, and state your marital status truthfully. Creating a profile while you are legally married is a serious misrepresentation and grounds for immediate removal without refund;</Bullet>
        <Bullet>not have been previously removed from the Service, and not be barred from using it under any applicable law.</Bullet>
      </Section>

      <Section heading="3. Matrimonial purpose only">
        <Para>TricityMatch is a matrimonial service, not a dating service. You may use it only with a genuine and present intention of entering into marriage — for yourself, or for a consenting family member. Using it for casual dating, companionship, commercial solicitation, advertising, recruitment, or any exploitative, immoral or unlawful purpose is prohibited and will result in removal.</Para>
      </Section>

      <Section heading="4. Registration & account security">
        <Para>Provide accurate, current and complete information and keep it updated. One person may hold one account. You are responsible for your password and one-time passcodes and for everything done under your account. Tell us at once at {CONFIG.SUPPORT_EMAIL} if you believe someone else has accessed it.</Para>
        <Para>We verify your mobile number or email by one-time passcode at signup. That confirms control of a contact point. It is not a check of who you are.</Para>
      </Section>

      <Section heading="5. Guardian & family-managed profiles">
        <Para>If you create or manage a profile for a family member, you confirm that:</Para>
        <Bullet>they are of legal marriageable age, know the profile exists, and have agreed to it;</Bullet>
        <Bullet>you have their permission to publish their photographs, personal details and horoscope information here, and to receive communications about their marriage;</Bullet>
        <Bullet>you will show them our Privacy Policy and stop processing their information if they ask.</Bullet>
        <Para>The person the profile describes may contact us at any time to take control of it, correct it, or have it deleted — whether or not they created it. We act on their instruction over the guardian's.</Para>
      </Section>

      <Section heading="6. Photo verification — what it is and is not">
        <Para>Photo verification is optional. You capture a live selfie through your device camera and our review team compares it against your profile photographs to confirm a real person is behind the profile.</Para>
        <Para>A verified badge is not a background check, a criminal-record check, an income, employment or marital-status check. It is not an endorsement and it does not make any statement on a profile true. We do not screen members, and we cannot. Make your own enquiries before you commit to anything.</Para>
      </Section>

      <Section heading="7. Acceptable use">
        <Para>You agree not to:</Para>
        <Bullet>post false, misleading or fraudulent information, or impersonate any person;</Bullet>
        <Bullet>harass, abuse, threaten, stalk or harm another member, on or off the platform;</Bullet>
        <Bullet>ask any member for money, gifts, loans or investments — no genuine match will ever ask you for money;</Bullet>
        <Bullet>demand or offer dowry in any form. Demanding dowry is an offence under the Dowry Prohibition Act, 1961 and we will remove and report accounts that do it;</Bullet>
        <Bullet>send spam, advertising or unsolicited promotional content;</Bullet>
        <Bullet>use bots, scrapers or automated methods to copy or extract profiles or contact details;</Bullet>
        <Bullet>copy, save, republish or share another member's photographs or contact details anywhere;</Bullet>
        <Bullet>contact a member outside the platform without consent, or keep contacting anyone who asked you to stop;</Bullet>
        <Bullet>circumvent or test the security, rate limits, payment features or unlock allowances of the Service;</Bullet>
        <Bullet>hold more than one account, sell or transfer your account, or use someone else's.</Bullet>
        <Para>Contact details are revealed only through your plan's unlock allowance and only for genuine matrimonial communication with that person.</Para>
      </Section>

      <Section heading="8. Content you may not host, upload or share">
        <Para>Under rule 3(1)(b) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, you must not host, display, upload, modify, publish, transmit, store, update or share information that:</Para>
        <Bullet>belongs to another person and to which you do not have any right;</Bullet>
        <Bullet>is obscene, pornographic, paedophilic, invasive of another's privacy including bodily privacy, insulting or harassing on the basis of gender, racially or ethnically objectionable, or otherwise contrary to the laws in force;</Bullet>
        <Bullet>is harmful to a child;</Bullet>
        <Bullet>infringes any patent, trademark, copyright or other proprietary right;</Bullet>
        <Bullet>deceives or misleads the addressee about the origin of the message, or knowingly communicates misinformation or information which is patently false, untrue or misleading;</Bullet>
        <Bullet>impersonates another person;</Bullet>
        <Bullet>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, or public order, or incites a cognisable offence, or prevents investigation of an offence, or insults a foreign State;</Bullet>
        <Bullet>contains a virus or any code designed to interrupt, destroy or limit the functionality of any computer resource;</Bullet>
        <Bullet>violates any law for the time being in force.</Bullet>
        <Para>We will inform you at least once every year of these rules, of our Terms and Privacy Policy and any change to them, and of the consequences of non-compliance — which include removing your content and terminating your access.</Para>
      </Section>

      <Section heading="9. Reporting, removal & enforcement">
        <Para>Every profile and conversation carries a report option, and you may write to our Grievance Officer (clause 23). We review reports by hand and may remove content, restrict features, suspend or terminate an account.</Para>
        <Bullet>We acknowledge a complaint within 24 hours and decide it within 15 days.</Bullet>
        <Bullet>A complaint about content exposing a private area, nudity, a sexual act, or impersonation including morphed images, is acted on within 24 hours.</Bullet>
        <Bullet>On a court order or an authorised government notification, unlawful information is removed within 36 hours.</Bullet>
        <Bullet>Removed information and its records are preserved for 180 days for investigation, or longer if required.</Bullet>
      </Section>

      <Section heading="10. Your content, and the licence you give us">
        <Para>You keep ownership of what you upload. You grant us a non-exclusive, royalty-free, worldwide licence to host, store, reproduce, resize, adapt for display and show that content to other members and their guardians, for as long as your account exists and strictly to operate the Service in line with your privacy settings. It ends when you delete the content or your account, except for copies we must preserve under clause 9 or 20.</Para>
        <Para>You confirm you have the right to upload everything you upload, that photographs are of the person the profile describes, and that you have consent for any photograph containing another identifiable person. We do not sell your content and do not use your photographs in advertising without asking first.</Para>
      </Section>

      <Section heading="11. Our intellectual property">
        <Para>The Service — its software, design, brand, name, logo and the compilation of profiles — belongs to us or our licensors. You may not copy, scrape, frame, reverse-engineer, or build a competing or derivative service from it.</Para>
      </Section>

      <Section heading="12. Plans, prices, taxes & payments">
        <Bullet>Basic use is free. Some features — unlocking contact details and unrestricted messaging — require a paid membership, sold for a fixed term stated at checkout.</Bullet>
        <Bullet>Prices are in Indian Rupees and include all applicable taxes, including GST. The price at checkout is the price you pay.</Bullet>
        <Bullet>Memberships do not auto-renew. There is no standing instruction on your card or account; a membership expires at the end of its term unless you buy again.</Bullet>
        <Bullet>A membership grants the contact-unlock allowance stated at checkout. Unlocks are consumed when used and do not carry over after the term.</Bullet>
        <Bullet>Where a launch price is shown against a struck-through price, the struck-through figure is our regular price for the same term, and any stated offer end date is real.</Bullet>
        <Bullet>Payments are processed by Razorpay, and on Android may be processed by Google Play. On iPhone, memberships are purchased on our website. We never see or store your card, UPI or bank credentials.</Bullet>
        <Bullet>A tax invoice is available for every completed payment from Payment History.</Bullet>
      </Section>

      <Section heading="13. Refunds & cancellation">
        <Para>Our Refund & Conduct Policy at tricitymatch.com/refund-policy forms part of these Terms: ask within seven days of paying and we refund the membership in full, less any contact unlocks you have already used; after that a membership runs its term, but we will always refund a feature we withdrew, a sustained outage, or a double charge. Nothing here limits your rights under the Consumer Protection Act, 2019. A member removed for harassment, fraud or misrepresentation is not refunded.</Para>
      </Section>

      <Section heading="14. No guarantee of outcome">
        <Para>We help you find and reach prospective matches. We do not promise responses, a match, or a marriage, and we are not a party to any introduction, engagement or marriage that follows. Compatibility scores, horoscope matching and suggestions are informational aids generated from what members provide — not advice, and not predictions.</Para>
        <Para>If you meet someone offline, meet in a public place, tell someone where you are going, and independently verify anything that matters — identity, marital status, income, employment, health and family circumstances.</Para>
      </Section>

      <Section heading="15. Third-party services">
        <Para>Parts of the Service rely on third parties — payments, image hosting, email and SMS delivery, push notifications and calling. Their handling of your data is described in our Privacy Policy. Astrologer consultations, where offered, are provided by independent practitioners; we facilitate the booking and are not responsible for the content of any consultation.</Para>
      </Section>

      <Section heading="16. Privacy">
        <Para>Our Privacy Policy explains what we collect, why, who we share it with, how long we keep it, and your rights under the Digital Personal Data Protection Act, 2023. It is incorporated into these Terms by reference.</Para>
      </Section>

      <Section heading="17. Disclaimers">
        <Para>The Service is provided "as is" and "as available", without warranties of any kind to the fullest extent the law allows. We do not warrant that it will be uninterrupted, error-free or secure, or that anything a member says about themselves is true, and we are not responsible for the conduct of any member, online or offline.</Para>
      </Section>

      <Section heading="18. Limitation of liability">
        <Para>To the maximum extent permitted by law, TricityMatch is not liable for indirect, incidental, special, punitive or consequential loss, or for loss of profit, opportunity, data or reputation, arising from your use of the Service or the acts of any member.</Para>
        <Para>Our total aggregate liability for all claims arising in any twelve-month period is limited to the total amount you actually paid us in that period, or ₹1,000 if you paid nothing. Nothing here limits liability that cannot be limited by law, including for fraud, or your rights as a consumer.</Para>
      </Section>

      <Section heading="19. Indemnity">
        <Para>You agree to indemnify and hold harmless TricityMatch, its officers and employees from claims, damages, losses and reasonable costs arising out of information you post, your breach of these Terms or of any law, or your dealings with any other member.</Para>
      </Section>

      <Section heading="20. Suspension, termination & what happens to your data">
        <Para>You may delete your account at any time from Settings → Delete Account (steps: tricitymatch.com/delete-account). We may suspend or terminate an account that breaches these Terms or the law, or that endangers other members.</Para>
        <Para>On deletion your profile, photographs, verification selfie, messages, matches and guardian links are erased. We retain your registration information for 180 days as rule 3(1)(h) of the IT Rules, 2021 requires, keep payment records for as long as tax and accounting law requires, and keep moderation records where another member has reported you. Section 13 of the Privacy Policy sets this out in full.</Para>
      </Section>

      <Section heading="21. Changes to these Terms">
        <Para>We may update these Terms. We will change the "Last updated" date above and, for a material change, notify you in the app or by email. We will also remind you of these Terms and the Privacy Policy at least once every year. Continuing to use the Service after a change means you accept it.</Para>
      </Section>

      <Section heading="22. Governing law & disputes">
        <Para>These Terms are governed by the laws of India. Please write to our Grievance Officer first. Subject to the next sentence, the courts at Chandigarh have exclusive jurisdiction. If you are a consumer, nothing here takes away your right to complain to the consumer commission where you reside or work under the Consumer Protection Act, 2019, or to use the National Consumer Helpline (1915) or e-Daakhil.</Para>
      </Section>

      <Section heading="23. Grievance redressal">
        <Bullet>Everyday help: {CONFIG.SUPPORT_EMAIL}. We reply within two working days.</Bullet>
        <Bullet>Grievance Officer{officer}: {CONFIG.GRIEVANCE_EMAIL}{address}. Appointed under rule 3(2) of the IT Rules, 2021 and rule 4(3) of the Consumer Protection (E-Commerce) Rules, 2020.</Bullet>
        <Bullet>Timelines: acknowledged within 24 hours (48 hours for consumer complaints), content and conduct complaints decided within 15 days, consumer complaints resolved within one month. Complaints of the kind in clause 9 are acted on within 24 hours.</Bullet>
        <Bullet>Data protection: {CONFIG.PRIVACY_EMAIL}. If our answer does not satisfy you, you may complain to the Data Protection Board of India.</Bullet>
      </Section>

      <Section heading="24. General">
        <Para>If any clause is unenforceable, the rest continues. Not enforcing a clause once does not waive it. You may not assign these Terms; we may assign them to a successor of the business and will tell you. These Terms, the Privacy Policy and the Refund & Conduct Policy are the entire agreement between us about the Service. We are not liable for failure caused by events outside our reasonable control.</Para>
      </Section>
    </LegalLayout>
  );
}
