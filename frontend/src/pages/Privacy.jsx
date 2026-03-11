import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-rose-700 hover:text-rose-800 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-neutral-400 mb-8">Last updated: January 2025</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">1. Information We Collect</h2>
              <p>We collect information you provide when creating your profile (name, age, photos, preferences), communications data (messages), and technical data (device info, IP address, usage patterns).</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">2. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To match you with compatible profiles</li>
                <li>To enable communication between users</li>
                <li>To process payments and manage subscriptions</li>
                <li>To detect and prevent fraud and abuse</li>
                <li>To improve and personalise the Service</li>
                <li>To send service-related notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">3. Information Sharing</h2>
              <p>We do not sell your personal information. We may share data with:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Service providers</strong> — hosting, payment processing (Razorpay), image storage (Cloudinary)</li>
                <li><strong>Legal authorities</strong> — when required by law or to protect rights and safety</li>
                <li><strong>Other users</strong> — your public profile information visible as per your privacy settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">4. Profile Visibility</h2>
              <p>You can control your profile visibility in <Link to="/settings" className="text-rose-700 hover:underline">Settings → Privacy</Link>. You can choose to show your profile to everyone, only premium users, or only your connections.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">5. Data Security</h2>
              <p>We use industry-standard security measures including encryption in transit (HTTPS), secure httpOnly cookies, and hashed passwords. While we strive to protect your data, no method of transmission is 100% secure.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">6. Data Retention</h2>
              <p>We retain your data while your account is active. When you delete your account, your data is soft-deleted and permanently purged after 30 days. Messages may be retained for legal compliance.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">7. Your Rights</h2>
              <p>You have the right to access, correct, or delete your personal data. You can manage this through your profile settings or by contacting us at <a href="mailto:privacy@tricitymatch.com" className="text-rose-700 hover:underline">privacy@tricitymatch.com</a>.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">8. Cookies</h2>
              <p>We use httpOnly cookies for authentication (access and refresh tokens). We do not use cookies for advertising tracking. Session storage is used for client-side preferences only.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">9. Children's Privacy</h2>
              <p>TricityMatch is not intended for users under 18 years of age. We do not knowingly collect information from minors.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">10. Contact</h2>
              <p>For privacy-related enquiries, contact us at <a href="mailto:privacy@tricitymatch.com" className="text-rose-700 hover:underline">privacy@tricitymatch.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
