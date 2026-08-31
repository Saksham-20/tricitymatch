import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';
import { legal, support } from '../config';

/**
 * Terms of Service.
 *
 * Rewritten 26 August 2026 after a review of what Indian law actually requires
 * of a platform like this one (docs/LEGAL_REVIEW_2026-08-26.md). The previous
 * version was honest but thin, and it was wrong in three ways that matter:
 *
 *   - it set the minimum age at 18 for everyone, when the Prohibition of Child
 *     Marriage Act, 2006 sets it at 21 for men and 18 for women;
 *   - it said fees are "non-refundable" while /refund-policy promises a
 *     seven-day no-questions refund — two published documents contradicting
 *     each other, and the one that binds us is the one more favourable to the
 *     member;
 *   - it carried none of the intermediary due-diligence content that IT Rules
 *     2021 r.3(1)(b) requires a platform to publish, and named no Grievance
 *     Officer, which r.3(2)(a) requires by name and not by role mailbox.
 *
 * Anything that depends on facts only the owner holds — registered entity name,
 * address, the Grievance Officer's name — comes from `config.legal` and is
 * OMITTED when unset rather than rendered as a placeholder. A fabricated
 * statutory disclosure is worse than a missing one.
 */

const H = ({ children }) => (
  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">{children}</h2>
);

const A = ({ href, children }) => (
  <a href={href} className="text-primary-700 dark:text-primary-300 underline">{children}</a>
);

const L = ({ to, children }) => (
  <Link to={to} className="text-primary-700 dark:text-primary-300 underline">{children}</Link>
);

export default function Terms() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pt-20 pb-16 px-4">
      <Seo
        title="Terms of Service"
        description="The terms governing your use of TricityMatch."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-700 dark:text-primary-300 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">← Back to Home</Link>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Terms of Service</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">Last updated: {legal.termsUpdated}</p>

          <div className="prose prose-sm max-w-none text-neutral-700 dark:text-neutral-300 space-y-6">
            <section>
              <p>
                TricityMatch is a matrimonial platform for the Tricity region — Chandigarh, Mohali
                and Panchkula — and for families from the region living elsewhere. These Terms of
                Service ("Terms") are a legally binding agreement between you and{' '}
                {legal.entity} ("TricityMatch", "we", "us"), the operator of the website
                tricitymatch.com and the TricityMatch mobile applications (together, the "Service").
                Please read them carefully. By creating an account or using the Service, you accept
                these Terms and our <L to="/privacy">Privacy Policy</L>.
              </p>
              {legal.address && (
                <p className="mt-2">
                  <strong>Operator:</strong> {legal.entity}
                  {legal.address ? `, ${legal.address}` : ''}
                  {legal.gstin ? ` · GSTIN ${legal.gstin}` : ''}.
                </p>
              )}
              <p className="mt-2">
                TricityMatch is an "intermediary" under section 2(1)(w) of the Information
                Technology Act, 2000. We host information provided by our members; we do not author
                it, and we do not vouch for it.
              </p>
            </section>

            <section>
              <H>1. Acceptance of these Terms</H>
              <p>By accessing, registering for, or using the Service you agree to be bound by these Terms. If you do not agree, please do not use the Service. If you are using the Service on behalf of a family member, you agree to these Terms both for yourself and on their behalf.</p>
            </section>

            <section>
              <H>2. Eligibility</H>
              <p>To register you must:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>be of legal marriageable age in India — <strong>21 years or above if you are a man, 18 years or above if you are a woman</strong> (Prohibition of Child Marriage Act, 2006) — or of legal marriageable age under the law that applies to you, if higher;</li>
                <li>be legally competent to contract and to marry, and not be within a degree of relationship prohibited by the law applicable to you;</li>
                <li>be unmarried, divorced, widowed, or otherwise lawfully free to marry, and state your marital status truthfully. <strong>Creating a profile while you are legally married is a serious misrepresentation</strong> and grounds for immediate removal without refund;</li>
                <li>not have been previously removed from the Service, and not be barred from using it under any applicable law.</li>
              </ul>
              <p className="mt-2">The Service is intended for use in India. If you use it from elsewhere, you are responsible for complying with your local law.</p>
            </section>

            <section>
              <H>3. Matrimonial purpose only</H>
              <p>
                <strong>TricityMatch is a matrimonial service, not a dating service.</strong> You may
                use it only with a genuine and present intention of entering into marriage — for
                yourself, or for a consenting family member. Using the Service for casual dating,
                companionship, friendship, commercial solicitation, advertising, recruitment,
                sex work, or any exploitative, immoral or unlawful purpose is prohibited and will
                result in removal.
              </p>
            </section>

            <section>
              <H>4. Registration &amp; account security</H>
              <p>You agree to provide accurate, current and complete information at registration and to keep it updated. One person may hold one account. You are responsible for keeping your password and one-time passcodes confidential and for everything done under your account. Tell us at once, at <A href={`mailto:${support.email}`}>{support.email}</A>, if you believe your account has been accessed by someone else.</p>
              <p className="mt-2">We verify your mobile number or email by one-time passcode at signup. That check confirms control of a contact point. It is not a check of who you are.</p>
            </section>

            <section>
              <H>5. Guardian &amp; family-managed profiles</H>
              <p>Our guardian feature lets a parent, sibling or relative create and manage a profile for a family member. If you use it, you confirm that:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>the person whose profile you create is of legal marriageable age (see clause 2), knows the profile exists, and has agreed to it;</li>
                <li>you have their permission to publish their photographs, personal details and horoscope information on this platform, and to receive and act on communications about their marriage;</li>
                <li>you will show them our <L to="/privacy">Privacy Policy</L>, and stop processing their information if they ask you to.</li>
              </ul>
              <p className="mt-2">The person the profile describes may contact us at any time to take control of the profile, correct it, or have it deleted, whether or not they created it. We will act on their instruction over the guardian's.</p>
            </section>

            <section>
              <H>6. Photo verification — what it is and is not</H>
              <p>Photo verification is optional. You capture a live selfie through your device camera and our review team compares it against your profile photographs to confirm that a real person is behind the profile.</p>
              <p className="mt-2">A verified badge is <strong>not</strong> a background check, a criminal-record check, an income check, an employment check, or a check of marital status. It is not an endorsement, a guarantee of anyone's identity, character or intentions, and it does not make any statement on the profile true. <strong>We do not screen members, and we cannot.</strong> Please make your own enquiries before you commit to anything.</p>
            </section>

            <section>
              <H>7. Acceptable use</H>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>post false, misleading or fraudulent information, or impersonate any person;</li>
                <li>harass, abuse, threaten, stalk, intimidate or harm another member, on or off the platform;</li>
                <li>ask any member for money, gifts, loans, investments, or financial or commercial favours — <em>no genuine match will ever ask you for money</em>;</li>
                <li>demand or offer dowry, in any form. Demanding dowry is an offence under the Dowry Prohibition Act, 1961 and we will remove and report accounts that do it;</li>
                <li>send spam, advertising, chain messages or unsolicited promotional content;</li>
                <li>use bots, scrapers, automated scripts or bulk methods to access, copy or extract profiles or contact details;</li>
                <li>copy, save, republish or share another member's photographs or contact details, on social media or anywhere else;</li>
                <li>contact a member outside the platform without their consent, or continue contacting anyone who has asked you to stop;</li>
                <li>circumvent, disable or test the security, rate limits, payment features or contact-unlock allowances of the Service;</li>
                <li>hold more than one account, sell or transfer your account, or use another member's account.</li>
              </ul>
              <p className="mt-2">Contact details are revealed only through your plan's unlock allowance, and only for genuine matrimonial communication with that person. Everything you unlock is another member's personal data — treat it that way.</p>
            </section>

            <section>
              <H>8. Content you may not host, display, upload or share</H>
              <p>In accordance with rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, you must not host, display, upload, modify, publish, transmit, store, update or share any information that:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>belongs to another person and to which you do not have any right;</li>
                <li>is obscene, pornographic, paedophilic, invasive of another's privacy including bodily privacy, insulting or harassing on the basis of gender, racially or ethnically objectionable, or otherwise inconsistent with or contrary to the laws in force;</li>
                <li>is harmful to a child;</li>
                <li>infringes any patent, trademark, copyright or other proprietary right;</li>
                <li>deceives or misleads the addressee about the origin of the message, or knowingly and intentionally communicates any misinformation or information which is patently false or untrue or misleading in nature;</li>
                <li>impersonates another person;</li>
                <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, or public order, or causes incitement to the commission of any cognisable offence, or prevents investigation of any offence, or is insulting to any foreign State;</li>
                <li>contains a software virus or any other computer code, file or programme designed to interrupt, destroy or limit the functionality of any computer resource;</li>
                <li>violates any law for the time being in force.</li>
              </ul>
              <p className="mt-2">We will inform you at least once every year of these rules, of our Terms and Privacy Policy, and of any change to them — and of the consequences of not complying, which include removing your content and terminating your access.</p>
            </section>

            <section>
              <H>9. Reporting, removal &amp; enforcement</H>
              <p>Every profile and every conversation carries a report option, and you can also write to our Grievance Officer (clause 23). We review reports by hand. We may remove content, restrict features, suspend or terminate an account where we reasonably believe these Terms or the law have been broken, or where a member is putting others at risk.</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>We acknowledge a complaint within <strong>24 hours</strong> and decide it within <strong>15 days</strong>.</li>
                <li>A complaint about content that exposes a person's private area, shows them in full or partial nudity, shows or depicts them in a sexual act, or is impersonation including morphed images, is acted on within <strong>24 hours</strong>.</li>
                <li>On a court order or a notification from an authorised government agency, unlawful information is removed or disabled within <strong>36 hours</strong>.</li>
                <li>Information we remove, and the records associated with it, are preserved for <strong>180 days</strong> for investigation, or longer where a court or agency requires it.</li>
              </ul>
              <p className="mt-2">We may also disclose information to law-enforcement agencies where we are lawfully required to, and we cooperate with investigating agencies as the law directs.</p>
            </section>

            <section>
              <H>10. Your content, and the licence you give us</H>
              <p>You keep ownership of the photographs, text, voice and video intros and other content you upload. You grant us a non-exclusive, royalty-free, worldwide licence to host, store, reproduce, resize, adapt for display, and show that content to other members and their guardians, for as long as your account exists and strictly to operate the Service in line with your privacy settings. This licence ends when you delete the content or your account, except for copies we are required to preserve under clause 9 or clause 20.</p>
              <p className="mt-2">You confirm you have the right to upload everything you upload, that photographs are of the person the profile describes, and that you have consent to upload any photograph containing another identifiable person.</p>
              <p className="mt-2">We do not sell your content, and we do not use your photographs in advertising without asking you first. Where you agree to appear in a success story, we will tell you exactly what will be published, and you can withdraw that consent at any time.</p>
            </section>

            <section>
              <H>11. Our intellectual property</H>
              <p>The Service — its software, design, brand, name, logo, text and compilation of profiles — belongs to us or our licensors and is protected by law. You may use it only as these Terms allow. You may not copy, scrape, frame, reverse-engineer, or build a competing or derivative service from it.</p>
            </section>

            <section>
              <H>12. Plans, prices, taxes &amp; payments</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Basic use is free. Some features — including unlocking contact details and unrestricted messaging — require a paid membership, sold for a fixed term stated at checkout.</li>
                <li><strong>Prices shown are in Indian Rupees and include all applicable taxes, including GST.</strong> The price you see at checkout is the price you pay; there are no charges added afterwards.</li>
                <li><strong>Memberships do not auto-renew.</strong> There is no standing instruction on your card or account. A membership simply expires at the end of its term unless you choose to buy again.</li>
                <li>A membership grants the contact-unlock allowance stated at checkout. Unlocks are consumed when you use them and do not carry over after the term ends.</li>
                <li>Where a launch or promotional price is shown against a struck-through price, the struck-through figure is our regular price for the same term. Where an offer has an end date, that date is real.</li>
                <li>Payments are processed by Razorpay, and on Android may be processed by Google Play. We never see or store your card, UPI or bank credentials.</li>
                <li>We may change our prices. A change never affects a membership you have already bought.</li>
                <li>A tax invoice is available for every completed payment from Payment History in your account.</li>
              </ul>
            </section>

            <section>
              <H>13. Refunds &amp; cancellation</H>
              <p>Our refund commitments are set out in full in our <L to="/refund-policy">Refund &amp; Conduct Policy</L>, which forms part of these Terms. In short: ask within seven days of paying and we refund the membership in full, less any contact unlocks you have already used; after that a membership runs its term, but we will always refund a feature we withdrew, a sustained outage, or a double charge. Nothing in these Terms limits your rights under the Consumer Protection Act, 2019.</p>
              <p className="mt-2">A member removed for harassment, fraud or misrepresentation is not refunded.</p>
            </section>

            <section>
              <H>14. No guarantee of outcome</H>
              <p>We help you find and reach prospective matches. We do not promise that you will receive responses, find a match, or marry, and we are not a party to any introduction, engagement, relationship or marriage that follows. Compatibility scores, horoscope matching and match suggestions are informational aids generated from the information members provide — they are not advice, and they are not predictions.</p>
              <p className="mt-2">If you meet someone offline, meet in a public place, tell someone where you are going, and verify independently anything that matters to you — identity, marital status, income, employment, health, and family circumstances. Please read our <L to="/safety">Safety</L> guidance before you meet anyone.</p>
            </section>

            <section>
              <H>15. Third-party services</H>
              <p>Parts of the Service rely on third parties — payments (Razorpay, Google Play), image hosting (Cloudinary), email and SMS delivery, push notifications, and voice/video calling. Their handling of your data is described in our <L to="/privacy">Privacy Policy</L>. Astrologer consultations, where offered, are provided by independent practitioners; we facilitate the booking and are not responsible for the content of any consultation.</p>
            </section>

            <section>
              <H>16. Privacy</H>
              <p>Our <L to="/privacy">Privacy Policy</L> explains what we collect, why, who we share it with, how long we keep it, and the rights you have under the Digital Personal Data Protection Act, 2023. It is incorporated into these Terms by reference.</p>
            </section>

            <section>
              <H>17. Disclaimers</H>
              <p>The Service is provided on an "as is" and "as available" basis, without warranties of any kind, express or implied, to the fullest extent the law allows. We do not warrant that the Service will be uninterrupted, error-free or secure, or that any information a member provides about themselves is true. We are not responsible for the conduct of any member, online or offline.</p>
            </section>

            <section>
              <H>18. Limitation of liability</H>
              <p>To the maximum extent permitted by law, TricityMatch is not liable for indirect, incidental, special, punitive or consequential loss, or for loss of profit, opportunity, data or reputation, arising from your use of the Service or from the acts or omissions of any member.</p>
              <p className="mt-2"><strong>Our total aggregate liability for all claims arising in any twelve-month period is limited to the total amount you actually paid us in that period</strong>, or ₹1,000 if you paid nothing.</p>
              <p className="mt-2">Nothing here limits liability that cannot be limited by law, including liability for fraud, or your rights as a consumer under the Consumer Protection Act, 2019.</p>
            </section>

            <section>
              <H>19. Indemnity</H>
              <p>You agree to indemnify and hold harmless TricityMatch, its officers and employees, from claims, damages, losses and reasonable costs arising out of information you post, your breach of these Terms or of any law, or your dealings with any other member.</p>
            </section>

            <section>
              <H>20. Suspension, termination &amp; what happens to your data</H>
              <p>You may delete your account at any time from <L to="/settings">Settings</L> — see <L to="/delete-account">how to delete your account</L> for the exact steps on the website and both apps. We may suspend or terminate an account that breaches these Terms or the law, or that endangers other members.</p>
              <p className="mt-2">When your account is deleted, your profile, photographs, verification selfie, messages, matches and guardian links are erased. We retain your registration information for <strong>180 days</strong> after deletion, as rule 3(1)(h) of the IT Rules, 2021 requires, and we keep payment records for as long as tax and accounting law requires, and moderation records where another member has reported you. This is set out in detail in section 13 of the <L to="/privacy">Privacy Policy</L>.</p>
            </section>

            <section>
              <H>21. Changes to these Terms</H>
              <p>We may update these Terms. When we do, we will change the "Last updated" date above and, for a material change, notify you in the app or by email. We will also remind you of these Terms, the Privacy Policy and any changes to them at least once every year. Continuing to use the Service after a change takes effect means you accept it. If you do not, you may delete your account.</p>
            </section>

            <section>
              <H>22. Governing law &amp; disputes</H>
              <p>These Terms are governed by the laws of India. Please write to our Grievance Officer first — most complaints are resolved there. Subject to the paragraph below, the courts at Chandigarh have exclusive jurisdiction over disputes arising from these Terms.</p>
              <p className="mt-2">If you are a consumer, nothing in this clause takes away your statutory right to bring a complaint before the consumer commission having jurisdiction where you reside or work, under the Consumer Protection Act, 2019. You may also use the National Consumer Helpline (1915) or the e-Daakhil portal.</p>
            </section>

            <section>
              <H>23. Grievance redressal</H>
              <p>If something on the platform harms you, or a member behaves badly, or you believe we have got something wrong, tell us. We would rather fix it than have you leave.</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Everyday help:</strong> <A href={`mailto:${support.email}`}>{support.email}</A>, or the <L to="/help">Help Centre</L>. We reply within two working days.</li>
                <li>
                  <strong>Grievance Officer{legal.grievanceOfficer ? ` — ${legal.grievanceOfficer}` : ''}:</strong>{' '}
                  <A href={`mailto:${legal.grievanceEmail}`}>{legal.grievanceEmail}</A>
                  {legal.address ? <> · {legal.entity}, {legal.address}</> : null}. Appointed under rule 3(2) of the IT Rules, 2021 and rule 4(3) of the Consumer Protection (E-Commerce) Rules, 2020.
                </li>
                <li><strong>Timelines:</strong> we acknowledge every complaint within <strong>24 hours</strong> (and within 48 hours for consumer complaints), decide content and conduct complaints within <strong>15 days</strong>, and resolve consumer complaints within <strong>one month</strong>. Complaints of the kind described in clause 9 are acted on within 24 hours.</li>
                <li><strong>Data protection:</strong> for anything about your personal data, write to <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A>. If you are not satisfied with our answer you may complain to the Data Protection Board of India.</li>
              </ul>
            </section>

            <section>
              <H>24. General</H>
              <p>If any clause of these Terms is held unenforceable, the rest continues in force. Our not enforcing a clause on one occasion does not waive it. You may not assign these Terms; we may assign them to a successor of the business, and will tell you if we do. These Terms, the Privacy Policy and the Refund &amp; Conduct Policy are the entire agreement between us about the Service. We are not liable for failure caused by events outside our reasonable control.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
