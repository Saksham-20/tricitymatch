import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';
import { legal, support } from '../config';

/**
 * Privacy Policy.
 *
 * Rewritten 26 August 2026 (docs/LEGAL_REVIEW_2026-08-26.md). The previous
 * version described a smaller product than the one we now run and made two
 * claims the code does not support: that deleted data is "permanently purged"
 * (financial and moderation records are deliberately retained, and rule 3(1)(h)
 * of the IT Rules requires registration data to be held for 180 days), and that
 * we notify only the Data Protection Board on a breach (CERT-In's 2022
 * Directions require reporting within six hours, separately).
 *
 * Everything here is written against what backend/utils/accountErasure.js
 * actually does and which processors the app actually calls. If you change
 * either, change this page in the same commit.
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

export default function Privacy() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0f1117] pt-20 pb-16 px-4">
      <Seo
        title="Privacy Policy"
        description="How TricityMatch collects, uses and protects your personal data."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-700 dark:text-primary-300 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">← Back to Home</Link>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Privacy Policy</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-8">Last updated: {legal.privacyUpdated}</p>

          <div className="prose prose-sm max-w-none text-neutral-700 dark:text-neutral-300 space-y-6">
            <section>
              <p>
                A matrimonial profile is one of the most personal things a person publishes about
                themselves — date and place of birth, caste, income, family, photographs. This
                policy says exactly what we collect, why, who else sees it, how long we keep it, and
                what you can make us do about it. It applies to tricitymatch.com and to the
                TricityMatch mobile applications.
              </p>
              <p className="mt-2">
                {legal.entity} is the <strong>Data Fiduciary</strong> for this information under the
                Digital Personal Data Protection Act, 2023 ("DPDP Act"); you are the{' '}
                <strong>Data Principal</strong>. We also handle your information in line with the
                Information Technology Act, 2000 and the rules made under it, including the
                Reasonable Security Practices (SPDI) Rules, 2011 to the extent they remain in force.
              </p>
              {legal.address && (
                <p className="mt-2"><strong>Our address:</strong> {legal.entity}, {legal.address}.</p>
              )}
            </section>

            <section>
              <H>1. What we collect</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Account details</strong> — your email address and/or mobile number, a hashed password, and, if you use Google Sign-In, the basic profile Google returns.</li>
                <li><strong>Profile information</strong> — name, gender, date of birth, height, weight, marital status and number of children, city and state, NRI/residence status, religion, caste, sub-caste and gotra, mother tongue and languages, diet, smoking and drinking habits, education, profession and income range, family details (type, status, parents' occupations, siblings), photographs, voice and video introductions, bio, prompts, interests, personality answers, and your partner preferences.</li>
                <li><strong>Horoscope details</strong> — place of birth, time of birth, manglik status, rashi and nakshatra, where you choose to provide them, used for Ashtakoot and numerology matching.</li>
                <li><strong>Verification selfie</strong> — if you opt into photo verification, a live selfie captured through your device camera (section 9).</li>
                <li><strong>Activity on the platform</strong> — interests you send, shortlists, mutual matches, profiles you have viewed and who has viewed you, contact details you have unlocked, blocks and reports.</li>
                <li><strong>Messages</strong> — the text, voice notes and reactions you exchange with other members, and family-group messages.</li>
                <li><strong>Calls</strong> — if you use in-app voice or video calling, the fact, time and duration of the call. <strong>We do not record calls</strong> and the audio and video do not pass through our servers in a form we store.</li>
                <li><strong>Payment records</strong> — plan, amount, date, and the payment and order identifiers our payment provider returns. <strong>We never receive or store your card, UPI or bank credentials.</strong></li>
                <li><strong>Guardian and family information</strong> — if you invite a guardian, or someone creates a profile for you, the name and contact details needed to link the two accounts.</li>
                <li><strong>Technical data</strong> — IP address, device and browser information, app version, and server logs, used for security, abuse prevention and to keep the Service running. If you enable push notifications we store the device push token.</li>
                <li><strong>Counters</strong> — a small set of anonymous product counters (for example "an OTP was verified", "a profile was completed") used to see where people get stuck. They carry no message content and no profile content.</li>
              </ul>
              <p className="mt-2"><strong>Sensitive categories.</strong> Some of the above — religion, caste and community, horoscope details, your photographs and verification selfie, and financial information — are sensitive. We collect them because matrimonial matching in India cannot work without them, we collect them only with your consent, and every field beyond the minimum needed to register is optional.</p>
            </section>

            <section>
              <H>2. Why we use it, and on what basis</H>
              <p>We process your personal data on the basis of the consent you give when you register and when you add each optional detail, and for the "legitimate uses" the DPDP Act permits — for example responding to something you ask us for, and complying with a legal obligation. Specifically, we use it:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>to create and display your profile to other members according to your privacy settings;</li>
                <li>to find and rank matches for you, and to show your profile in others' searches and match suggestions;</li>
                <li>to enable interests, messaging and calling between members;</li>
                <li>to verify accounts, detect fraud and fake profiles, and act on reports and blocks;</li>
                <li>to take payment, run memberships and unlocks, and issue invoices;</li>
                <li>to send you service messages — one-time passcodes, security alerts, match and message notifications, and membership notices;</li>
                <li>to answer your support requests and grievances;</li>
                <li>to keep the Service secure and working, and to meet our obligations under Indian law.</li>
              </ul>
              <p className="mt-2">We do not use your data for behavioural advertising, and we do not sell it to anyone.</p>
            </section>

            <section>
              <H>3. Automated matching</H>
              <p>Match suggestions, compatibility percentages, Ashtakoot guna scores and numerology readings are generated automatically from the details you and other members provide, and from your stated preferences. Search results are ordered by relevance, and a profile may be ranked higher because the member has an active boost, or lower because it has no photograph.</p>
              <p className="mt-2">These are suggestions and nothing more. No decision with a legal or similarly significant effect on you is made automatically, and you are free to ignore every one of them. You can change what feeds them at any time by editing your profile and preferences.</p>
            </section>

            <section>
              <H>4. Who can see your profile</H>
              <p>Your profile is shown to other logged-in members of TricityMatch, and to a guardian linked to a member. It is not published on the open internet and is not indexed by search engines. In <L to="/settings">Settings → Privacy</L> you can:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>set your profile to <strong>Everyone</strong> or to <strong>Matches only</strong>;</li>
                <li>turn off your online status and last-seen time;</li>
                <li>blur your photographs until you match;</li>
                <li>hide your phone number and email on your profile;</li>
                <li>turn on incognito browsing, so you do not appear in others' "who viewed me".</li>
              </ul>
              <p className="mt-2"><strong>Your phone number and email are never shown to another member unless they unlock your contact details</strong> using a paid allowance, or you share them yourself in chat. A member who unlocks your details is bound by our Terms to use them only for genuine matrimonial contact — but once shared, we cannot take information back out of somebody's phone. Please share carefully.</p>
            </section>

            <section>
              <H>5. Who we share it with</H>
              <p>We do not sell personal data and we do not share it for anyone else's marketing. We share it only with processors who work for us, under contract, and only for these purposes:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Razorpay</strong> — payments, refunds and invoices. Google Play processes some purchases made in the Android app.</li>
                <li><strong>Cloudinary</strong> — hosting your photographs, voice and video intros and voice messages.</li>
                <li><strong>Our email provider</strong> — one-time passcodes, security alerts, match and membership notices.</li>
                <li><strong>Our SMS provider</strong> — one-time passcodes to your mobile number.</li>
                <li><strong>Firebase Cloud Messaging</strong> — push notifications, if you enable them.</li>
                <li><strong>Agora</strong> — carrying in-app voice and video calls, if you use them.</li>
                <li><strong>Our hosting and monitoring providers</strong> — running the servers and database and alerting us to errors.</li>
                <li><strong>Astrologers</strong> you book a consultation with receive the horoscope details needed for that consultation.</li>
                <li><strong>Legal and safety</strong> — courts, police and government agencies where the law requires it, and where it is necessary to protect the rights, property or safety of our members or the public. We cooperate with investigating agencies as the IT Act and the rules made under it direct.</li>
                <li><strong>A successor</strong> — if the business is transferred, your data moves with it under this policy, and we will tell you.</li>
              </ul>
            </section>

            <section>
              <H>6. Transfers outside India</H>
              <p>Our servers and database are operated by us; some of the processors listed above operate outside India — for example image hosting and email delivery. Where that happens, your data is transferred under contract and only for the purpose stated, as section 16 of the DPDP Act permits, and never to a country the Central Government has restricted.</p>
            </section>

            <section>
              <H>7. Messages, notifications &amp; your choices</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Service messages</strong> — one-time passcodes, password resets, security alerts, payment receipts and membership expiry notices. These are part of the Service and cannot be switched off while you have an account.</li>
                <li><strong>Match and activity notifications</strong> — new matches, interests, messages, weekly digests and reminders. Every email of this kind carries an unsubscribe link, and push notifications can be turned off in <L to="/settings">Settings</L> or in your device settings.</li>
                <li><strong>SMS</strong> is used only for one-time passcodes, not for marketing.</li>
              </ul>
            </section>

            <section>
              <H>8. Cookies &amp; on-device storage</H>
              <p>We use httpOnly cookies strictly for authentication (a short-lived access token and a refresh token). We do <strong>not</strong> use advertising cookies, cross-site trackers, or third-party analytics that profile you. Limited browser and app storage is used to remember on-device preferences such as language, theme, and a draft you have not sent.</p>
            </section>

            <section>
              <H>9. Your verification selfie</H>
              <p>Photo verification is optional. If you use it, we capture a live selfie through your device camera — there is no upload option, because an uploaded photograph can be someone else's. A reviewer on our team compares it against your profile photographs and records only the result. The selfie is <strong>never shown to other members</strong>, is not used for advertising or training, and is deleted when your account is deleted. You can decline verification and continue using the Service without a verified badge, and you can withdraw your consent by writing to us.</p>
            </section>

            <section>
              <H>10. Profiles created by a guardian</H>
              <p>Where a parent or relative creates a profile for you, they must have your agreement and must show you this policy. Whether or not you created the profile, it describes you and the data in it is yours: you may write to us at <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A> to see it, correct it, take control of it, or have it deleted, and we will act on your instruction over the guardian's.</p>
            </section>

            <section>
              <H>11. Success stories</H>
              <p>We publish success stories only from members who submit them and agree to publication, and only after review. Tell us and we will take yours down.</p>
            </section>

            <section>
              <H>12. Security &amp; what we do if something goes wrong</H>
              <p>We encrypt traffic in transit (HTTPS), store passwords hashed, hold authentication in httpOnly cookies, rate-limit and lock out repeated login attempts, restrict administrative access by role, keep an audit trail of administrative actions, and validate the files you upload. No system is perfectly secure and we do not claim otherwise.</p>
              <p className="mt-2">If a personal data breach affects you, we will tell you without delay, in plain language: what happened, what data was involved, what we have done, what you can do, and who to contact. We will report it to the <strong>Indian Computer Emergency Response Team (CERT-In) within six hours</strong> of becoming aware of it, as its 2022 Directions require, and to the <strong>Data Protection Board of India</strong> without delay, with a full account within <strong>72 hours</strong>, as the DPDP Rules require.</p>
            </section>

            <section>
              <H>13. How long we keep things, and what deletion really does</H>
              <p>We keep your data while your account is active. You can delete your account yourself at any time from <L to="/settings">Settings</L> — see <L to="/delete-account">how to delete your account</L>. Deletion is real, and this is exactly what it does:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Erased</strong> — your profile and every field in it, your photographs, voice and video intros, your verification selfie, your matches, shortlists, contact unlocks, profile views, notifications, call records, guardian links, blocks and sessions.</li>
                <li><strong>Message text is destroyed</strong>, and the empty row is left in place so the other person's conversation does not develop holes.</li>
                <li><strong>Retained</strong> — payment and membership records, because tax and accounting law requires them and because refunds have to be reconcilable; and moderation records where another member has reported you, because a report should not be erasable by the person reported.</li>
                <li><strong>Registration information is held for 180 days</strong> after deletion, because rule 3(1)(h) of the IT Rules, 2021 requires it, and then goes.</li>
                <li>Content we have removed on a complaint or an official order, and its associated records, are preserved for <strong>180 days</strong> for investigation, or longer if a court or agency requires it.</li>
                <li>Server and security logs are kept for a rolling period as required by the CERT-In Directions, 2022, and then rotate out.</li>
              </ul>
              <p className="mt-2">Where you withdraw consent for something optional, or an account has been inactive and its purpose is served, we erase the related data unless a law requires us to keep it.</p>
            </section>

            <section>
              <H>14. Your rights, and how to use them</H>
              <p>Under the DPDP Act you have the right to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Know</strong> what personal data of yours we hold and process, and who we have shared it with;</li>
                <li><strong>Correct, complete or update</strong> it, and <strong>erase</strong> it where it is no longer needed;</li>
                <li><strong>Withdraw your consent</strong> at any time, as easily as you gave it — by editing or clearing a field, turning a setting off, unsubscribing, or writing to us. Withdrawing consent for something the Service needs (your date of birth, for example) means we can no longer keep your profile, so it is the same as deleting your account;</li>
                <li><strong>Nominate</strong> another person to exercise these rights for you if you die or become unable to act. Write to us with their name and contact details and we will record it;</li>
                <li><strong>Have your grievance redressed</strong> (section 15).</li>
              </ul>
              <p className="mt-2">Most of this is immediate and in your own hands: edit your profile, change your privacy settings, unsubscribe, or delete your account. For anything else, write to <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A> from your registered email address. <strong>We respond to rights requests within 30 days.</strong> We may need to confirm who you are first — we will not hand your data to somebody claiming to be you.</p>
              <p className="mt-2">The Act also asks something of you: give us information that is true, do not impersonate anyone, and do not file a false or frivolous complaint.</p>
            </section>

            <section>
              <H>15. Grievances, and who to go to next</H>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Data protection queries and complaints:</strong> <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A>{legal.dataProtectionOfficer ? ` (${legal.dataProtectionOfficer})` : ''}. <strong>We acknowledge within 24 hours and resolve within 15 days</strong>, and in no case later than 30 days.</li>
                <li>
                  <strong>Grievance Officer{legal.grievanceOfficer ? ` — ${legal.grievanceOfficer}` : ''}:</strong>{' '}
                  <A href={`mailto:${legal.grievanceEmail}`}>{legal.grievanceEmail}</A>
                  {legal.address ? <> · {legal.entity}, {legal.address}</> : null}. For complaints about content, conduct or this policy, under rule 3(2) of the IT Rules, 2021.
                </li>
                <li><strong>Everything else:</strong> <A href={`mailto:${support.email}`}>{support.email}</A> or the <L to="/help">Help Centre</L>.</li>
                <li><strong>If we do not resolve it:</strong> you may complain to the <strong>Data Protection Board of India</strong> about your personal data, or to the consumer commission having jurisdiction where you live, under the Consumer Protection Act, 2019.</li>
              </ul>
            </section>

            <section>
              <H>16. Children</H>
              <p>TricityMatch is only for adults of legal marriageable age — 21 and above for men, 18 and above for women. We do not knowingly collect the personal data of a child, we do not process children's data at all, and we do not track or profile children or show them advertising. If you believe a minor has registered, write to <A href={`mailto:${legal.privacyEmail}`}>{legal.privacyEmail}</A> and we will remove the account and the data.</p>
            </section>

            <section>
              <H>17. Changes to this policy</H>
              <p>We may update this policy. The "Last updated" date above always shows when. For a material change we will notify you in the app or by email before it takes effect, and we will remind you of this policy at least once a year.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
