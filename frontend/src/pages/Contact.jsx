import React from 'react';
import { Link } from 'react-router-dom';

export default function Contact() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Contact Us</h1>
          <p className="text-sm text-neutral-400 mb-8">We're here to help</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Get in Touch</h2>
              <p>Have a question, concern, or feedback? Our support team is available to help you.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Email Support</h2>
              <p>
                For general enquiries and account support:{' '}
                <a href="mailto:support@tricityshadi.com" className="text-primary-600 hover:underline">support@tricityshadi.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Response Time</h2>
              <p>We aim to respond to all queries within 24–48 hours on business days (Monday–Saturday, 10am–6pm IST).</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Report Abuse</h2>
              <p>To report a suspicious profile or abusive behaviour, use the "Report" button on the offending profile, or email us at <a href="mailto:support@tricityshadi.com" className="text-primary-600 hover:underline">support@tricityshadi.com</a> with the profile ID.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
