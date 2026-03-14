import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-rose-700 hover:text-rose-800 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-neutral-400 mb-8">Last updated: January 2025</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using TricityMatch ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">2. Eligibility</h2>
              <p>You must be at least 18 years of age to use this Service. By using TricityMatch, you represent and warrant that you are 18 years or older, and that you have the legal capacity to enter into a binding agreement.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">3. Account Registration</h2>
              <p>You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">4. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Post false, misleading, or fraudulent information</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Impersonate any person or entity</li>
                <li>Engage in spam or unsolicited communications</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Attempt to circumvent security features of the platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">5. Subscriptions and Payments</h2>
              <p>Paid subscriptions are billed in advance. Fees are non-refundable except as required by applicable law. We reserve the right to change pricing with reasonable notice. Payments are processed securely via Razorpay.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">6. Privacy</h2>
              <p>Your use of the Service is also governed by our <Link to="/privacy" className="text-rose-700 underline hover:text-rose-800">Privacy Policy</Link>, which is incorporated by reference.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">7. Termination</h2>
              <p>We may suspend or terminate your account at any time for violation of these terms. You may also delete your account at any time from Settings.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">8. Disclaimer of Warranties</h2>
              <p>The Service is provided "as is" without warranties of any kind. We do not guarantee successful matches or verify the accuracy of user-provided information beyond our verification process.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">9. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, TricityMatch shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">10. Contact</h2>
              <p>For questions about these Terms, contact us at <a href="mailto:legal@tricitymatch.com" className="text-rose-700 underline hover:text-rose-800">legal@tricitymatch.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
