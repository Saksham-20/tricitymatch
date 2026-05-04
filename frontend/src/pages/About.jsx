import React from 'react';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">About TricityShadi</h1>
          <p className="text-sm text-neutral-400 mb-8">Connecting families across Chandigarh, Mohali & Panchkula</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Our Mission</h2>
              <p>TricityShadi is a hyperlocal matrimonial platform built specifically for families in Chandigarh, Mohali, and Panchkula. We believe that finding a life partner should be a meaningful, safe, and community-first experience.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Why TricityShadi?</h2>
              <p>Unlike generic matrimonial platforms, TricityShadi focuses on the Tricity region — bringing together people who share local roots, cultural values, and community ties. Our intelligent matching system considers compatibility, family background, education, and lifestyle to suggest the most meaningful connections.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Our Values</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Verified profiles for trust and safety</li>
                <li>Privacy-first — your data is yours</li>
                <li>Family-oriented matching</li>
                <li>Local community focus</li>
                <li>Transparent pricing, no hidden fees</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Get in Touch</h2>
              <p>Have questions or feedback? We'd love to hear from you. Reach us at <a href="mailto:support@tricityshadi.com" className="text-primary-600 hover:underline">support@tricityshadi.com</a></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
