import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <Seo
        title="Privacy Policy"
        description="How TricityShadi collects, uses and protects your personal data."
        path="/privacy"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-neutral-600 mb-8">Last updated: July 2026</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <p>
                TricityShadi respects your privacy. This policy explains what personal
                information we collect, how we use and protect it, and the choices you have.
                It applies to your use of our website and services. We handle your data in
                line with applicable Indian law, including the Digital Personal Data
                Protection Act, 2023.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">1. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Profile information</strong> — name, gender, date of birth, photos, education, profession, income range, religion, community, location, lifestyle, partner preferences, and any bio or horoscope details you choose to add.</li>
                <li><strong>Contact details</strong> — email address and/or mobile number, used for sign-in, verification, and notifications.</li>
                <li><strong>Verification selfie</strong> — if you opt into photo verification, a live selfie captured through your device camera (see Section 5).</li>
                <li><strong>Communications</strong> — messages you exchange with other members on the platform.</li>
                <li><strong>Technical data</strong> — device and browser information, IP address, and usage activity, used for security and to operate the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">2. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To create your profile and match you with compatible members</li>
                <li>To enable communication between mutually interested members</li>
                <li>To verify accounts and keep the community safe from fraud and abuse</li>
                <li>To process payments and manage subscriptions</li>
                <li>To send account and service-related notifications (email, SMS, or push)</li>
                <li>To improve, personalise, and secure the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">3. Information Sharing</h2>
              <p>We do <strong>not</strong> sell your personal information. We share data only as needed to run the Service:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Other members</strong> — your profile information, shown to other users according to your privacy settings. Your contact details are revealed only when unlocked as part of a paid plan.</li>
                <li><strong>Service providers</strong> — trusted partners who process data on our behalf: Razorpay (payments), Cloudinary (image storage), and our email/SMS providers for OTP and notifications. They may only use your data to provide their service to us.</li>
                <li><strong>Legal authorities</strong> — when required by law, or to protect the rights, property, or safety of our users or the public.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">4. Profile Visibility &amp; Your Controls</h2>
              <p>You control who can see your profile in <Link to="/settings" className="text-primary-600 underline hover:text-primary-700">Settings → Privacy</Link>. You can set your profile to be visible to <strong>Everyone</strong> or to <strong>Matches Only</strong>, and you can choose whether to show your online status and last-seen time. You can update or remove your photos and profile details at any time.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">5. Verification Selfie</h2>
              <p>Photo verification is optional. If you use it, we capture a live selfie through your device camera and our review team compares it against your profile photos to confirm you are a real person. Your verification selfie is used only for this review — it is <strong>never shown to other members</strong> and is not used for advertising. If you prefer not to verify, you can continue using the Service without a verified badge.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">6. Data Security</h2>
              <p>We use industry-standard safeguards, including encryption in transit (HTTPS), secure httpOnly authentication cookies, and hashed passwords. While we work hard to protect your data, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">7. Data Retention</h2>
              <p>We keep your data while your account is active. When you delete your account, your profile is removed from public view and permanently purged within a reasonable period, except where limited information must be retained to meet legal, security, or fraud-prevention obligations.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">8. Your Rights</h2>
              <p>You have the right to access, correct, update, or delete your personal data, and to withdraw consent for optional processing such as verification. You can manage most of this directly from your profile and settings, or by contacting us at <a href="mailto:privacy@tricityshadi.com" className="text-primary-600 underline hover:text-primary-700">privacy@tricityshadi.com</a>.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">9. Cookies</h2>
              <p>We use httpOnly cookies strictly for authentication (secure access and refresh tokens). We do <strong>not</strong> use cookies for advertising or cross-site tracking. Limited browser storage is used only to remember your on-device preferences.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">10. Children's Privacy</h2>
              <p>TricityShadi is intended only for adults aged 18 and above. We do not knowingly collect information from minors. If you believe a minor has provided us data, please contact us and we will remove it.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">11. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. Material changes will be reflected in the "Last updated" date above and, where appropriate, notified to you.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">12. Grievances &amp; Contact</h2>
              <p>For any privacy-related question or request, contact us at <a href="mailto:privacy@tricityshadi.com" className="text-primary-600 underline hover:text-primary-700">privacy@tricityshadi.com</a>. In accordance with applicable Indian law, you may also reach our Grievance Officer at <a href="mailto:grievance@tricityshadi.com" className="text-primary-600 underline hover:text-primary-700">grievance@tricityshadi.com</a> for complaints regarding your personal data, and we will respond within the timelines prescribed by law.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
