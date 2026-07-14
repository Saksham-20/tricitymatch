import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';

export default function Terms() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <Seo
        title="Terms of Service"
        description="The terms governing your use of TricityShadi."
        path="/terms"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-neutral-600 mb-8">Last updated: July 2026</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <p>
                Welcome to TricityShadi — a matrimonial platform for the Tricity region
                (Chandigarh, Mohali, and Panchkula) and beyond. These Terms of Service
                ("Terms") are an agreement between you and TricityShadi. Please read them
                carefully. By creating an account or using the platform, you accept these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using TricityShadi ("the Service"), you agree to be bound by these Terms. If you do not agree, please do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">2. Eligibility</h2>
              <p>You must be at least 18 years of age and legally competent to marry under the laws applicable to you. By using TricityShadi, you represent and warrant that you meet these requirements and are creating a profile for a genuine matrimonial purpose — for yourself, or, where our guardian feature is used, on behalf of a consenting family member.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">3. Account Registration &amp; Guardian Profiles</h2>
              <p>You agree to provide accurate, current, and complete information during registration, and to keep it updated. You are responsible for keeping your login credentials confidential and for all activity under your account. If you create or manage a profile for a family member (a "guardian" profile), you confirm that you have that person's consent to do so and to process their information on this platform.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">4. Verification</h2>
              <p>We offer optional photo verification, in which you capture a live selfie that our team compares against your profile photos to confirm you are a real person. Verification helps build trust but is <strong>not</strong> a background check, and a verified badge is not a guarantee of any user's identity, character, intentions, marital status, or the accuracy of their information. Always exercise your own judgement.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">5. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Post false, misleading, or fraudulent information, or impersonate any person</li>
                <li>Harass, abuse, threaten, stalk, or harm other users</li>
                <li>Solicit money, gifts, or financial or commercial favours from other users</li>
                <li>Send spam, advertising, or unsolicited promotional content</li>
                <li>Upload obscene, unlawful, or infringing content</li>
                <li>Collect or misuse other users' data, or contact them off-platform without consent</li>
                <li>Violate any applicable law, or attempt to circumvent the platform's security or payment features</li>
              </ul>
              <p className="mt-2">Contact details of other members are unlocked only through your plan's allowance and must be used solely for genuine matrimonial communication.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">6. Your Content</h2>
              <p>You retain ownership of the photos, text, and other content you upload. By uploading it, you grant TricityShadi a limited licence to host, display, and process that content for the purpose of operating the Service (for example, showing your profile to other members according to your privacy settings). You are responsible for having the rights to any content you upload.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">7. Subscriptions &amp; Payments</h2>
              <p>Some features require a paid plan. Paid plans are billed in advance for a fixed term and grant a set number of contact unlocks and features as described at checkout. Plans do <strong>not</strong> auto-renew — they simply expire at the end of the term unless you purchase again. Fees are non-refundable except where required by law. We may change pricing with reasonable notice. Payments are processed securely by our payment partner, Razorpay; we do not store your card details.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">8. No Guarantee of Outcome</h2>
              <p>TricityShadi is a platform to help you discover and connect with prospective matches. We do not guarantee that you will find a match, a response, or a marriage, and we are not a party to any relationship, engagement, or marriage that results from using the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">9. Privacy</h2>
              <p>Your use of the Service is also governed by our <Link to="/privacy" className="text-primary-600 underline hover:text-primary-700">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">10. Suspension &amp; Termination</h2>
              <p>We may suspend or terminate your account if you breach these Terms, misuse the platform, or put other members at risk. You may delete your account at any time from <Link to="/settings" className="text-primary-600 underline hover:text-primary-700">Settings</Link>. Some information may be retained after deletion as described in the Privacy Policy.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">11. Disclaimer of Warranties</h2>
              <p>The Service is provided "as is" and "as available" without warranties of any kind. We do not verify the accuracy of user-provided information beyond the optional verification described above, and we are not responsible for the conduct of any user, online or offline.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">12. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, TricityShadi shall not be liable for any indirect, incidental, special, or consequential damages, or for the acts or omissions of any user, arising from your use of the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">13. Governing Law</h2>
              <p>These Terms are governed by the laws of India. Subject to applicable law, the courts at Chandigarh shall have jurisdiction over any dispute arising from these Terms or your use of the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">14. Changes to These Terms</h2>
              <p>We may update these Terms from time to time. When we do, we will revise the "Last updated" date above. Your continued use of the Service after changes take effect means you accept the updated Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">15. Grievances &amp; Contact</h2>
              <p>For questions about these Terms, or to report content or conduct, contact us at <a href="mailto:support@tricityshadi.com" className="text-primary-600 underline hover:text-primary-700">support@tricityshadi.com</a>. In line with applicable Indian law, complaints regarding content or data may be addressed to our Grievance Officer at <a href="mailto:grievance@tricityshadi.com" className="text-primary-600 underline hover:text-primary-700">grievance@tricityshadi.com</a>, and we will acknowledge and endeavour to resolve them within the timelines prescribed by law.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
