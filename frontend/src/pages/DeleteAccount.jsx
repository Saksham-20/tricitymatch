import React from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/common/Seo';

// Public account-deletion page. Google Play's Data-Safety / account-deletion
// policy requires a URL reachable outside the app that explains how a user can
// delete their account and what happens to their data — this is that URL.
export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-20 pb-16 px-4">
      <Seo
        title="Delete Your Account"
        description="How to permanently delete your TricityMatch account and data."
        path="/delete-account"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 inline-block py-2 px-2 -mx-2 -mt-2 mb-4">← Back to Home</Link>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Delete Your Account</h1>
          <p className="text-sm text-neutral-600 mb-8">Applies to the TricityMatch website and mobile apps</p>

          <div className="prose prose-sm max-w-none text-neutral-700 space-y-6">
            <section>
              <p>
                You can permanently delete your TricityMatch account at any time. Deletion
                removes your profile from the platform and cannot be undone.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Delete from the website</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Log in at <Link to="/login" className="text-primary-600 underline hover:text-primary-700">tricitymatch.com/login</Link></li>
                <li>Go to <strong>Settings</strong></li>
                <li>Open the <strong>Account</strong> section and choose <strong>Delete Account</strong></li>
                <li>Confirm with your password</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Delete from the mobile app</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Open the TricityMatch app and log in</li>
                <li>Go to <strong>Settings</strong></li>
                <li>Choose <strong>Delete Account</strong> and confirm</li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Can't log in?</h2>
              <p>
                Email us at <a href="mailto:support@tricitymatch.com" className="text-primary-600 underline hover:text-primary-700">support@tricitymatch.com</a> from
                the email address registered to your account (or include the mobile number
                you signed up with) and request deletion. We will verify it is really you
                before deleting, and confirm once it is done.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-900 mb-2">What gets deleted</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your profile, photos, and partner preferences</li>
                <li>Your matches, likes, shortlists, and conversations</li>
                <li>Your verification selfie, if you submitted one</li>
                <li>Your contact details and notification tokens</li>
              </ul>
              <p className="mt-2">
                Your profile is removed from public view immediately and your data is
                permanently purged within a reasonable period. Limited records (for
                example payment/invoice records, or data connected to a safety report)
                may be retained where the law requires it or to prevent fraud and abuse,
                as described in our <Link to="/privacy" className="text-primary-600 underline hover:text-primary-700">Privacy Policy</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
