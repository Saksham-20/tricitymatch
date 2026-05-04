import React from 'react';
import { Link } from 'react-router-dom';

export default function Safety() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-6 inline-block">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Safety Centre</h1>
          <p className="text-sm text-neutral-400 mb-8">Your safety is our top priority</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Profile Verification</h2>
              <p>TricityShadi verifies profiles using government-issued ID documents. Verified profiles display a blue badge and receive 3× more match responses. Always prefer verified profiles when connecting.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Safe Messaging</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Never share personal financial information in chats</li>
                <li>Do not send money to anyone you haven't met in person</li>
                <li>Be cautious of profiles that quickly ask for contact details off-platform</li>
                <li>Report suspicious behaviour immediately using the Report button</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Meeting Safely</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Meet for the first time in a public place with family or friends present</li>
                <li>Inform a trusted person of your plans before meeting</li>
                <li>Do not share your home address until you feel fully comfortable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Reporting & Blocking</h2>
              <p>Use the Report and Block features on any profile page. Reports are reviewed by our team within 24 hours. Blocked users cannot view your profile or contact you.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Emergency Contact</h2>
              <p>If you believe you are in immediate danger, please contact local emergency services (112). For platform safety concerns, email <a href="mailto:support@tricityshadi.com" className="text-primary-600 hover:underline">support@tricityshadi.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
