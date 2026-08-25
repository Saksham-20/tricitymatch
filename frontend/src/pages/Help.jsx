import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHelpCircle, FiMail, FiMessageCircle, FiShield, FiCreditCard,
  FiUser, FiArrowRight, FiChevronDown, FiTrash2,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import Seo from '../components/common/Seo';
import { support } from '../config';

/**
 * Help Centre — the self-serve half of support.
 *
 * Support was previously a single contact form: every question, however
 * routine, became a human ticket into a mailbox. These answers are the ones the
 * inbox actually receives; the contact form stays one click away for the rest.
 *
 * Every answer here must match shipped behaviour — a help page that describes a
 * product we do not have is worse than no help page.
 */

const Eyebrow = ({ children, className = '' }) => (
  <span className={`inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-primary-600 ${className}`}>
    {children}
  </span>
);

const SECTIONS = [
  {
    icon: FiUser,
    title: 'Profile & verification',
    faqs: [
      {
        q: 'How do I get the verified badge?',
        a: 'Go to Verification and capture a live selfie in your browser — we never accept an uploaded file, because an upload can be doctored. Our team compares it by hand against your profile photos and awards the badge, usually within 24–48 hours. We never ask for a government ID.',
      },
      {
        q: 'Who can see my photos?',
        a: 'You control this under Settings → Privacy. You can be visible to everyone or only to your matches, and you can hide your online status and last-seen time. Photo blur stays on for members you have not matched with.',
      },
      {
        q: 'Can my parents manage my profile?',
        a: 'Yes. Guardian access lets a parent or sibling browse and shortlist on your behalf from their own login — they never see your chats. Set it up under Guardian.',
      },
      {
        q: 'I am an NRI — can I join?',
        a: 'Yes, as long as you are from the Tricity or your family is. TricityMatch is hyperlocal by design: every profile is from Chandigarh, Mohali or Panchkula, or has direct family ties to the region — where you currently live does not change that. Tick "I\u2019m an NRI / currently living outside India" on the Location step and add the country you live in, and we will show that on your profile so families know an NRI alliance is on the table. Your family\u2019s Tricity location stays on the profile too, and a parent or sibling here can run the search with you through Guardian access while you are abroad.',
      },
    ],
  },
  {
    icon: FiCreditCard,
    title: 'Plans & payments',
    faqs: [
      {
        q: 'What do contact unlocks do?',
        a: "Each unlock reveals one member's phone number and email. They are tied to your active plan and stay valid until it expires. If you run out before your plan ends, you can top up without changing plans.",
      },
      {
        q: 'Can I upgrade in the middle of a plan?',
        a: 'Yes — you can move up to a higher plan at any time while your current plan is active. The new plan starts fresh from the day you upgrade, and your unlock allowance resets to the new plan.',
      },
      {
        q: 'Do unused days or unlocks carry over?',
        a: 'No. A plan runs for its stated term, and unlocks belong to the plan that granted them. Upgrading starts a fresh full term rather than adding to the old one.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Yes — ask within seven days of paying and we refund the membership in full, no justification needed (minus any contact unlocks you already used). After that a membership runs its term, but write to us anyway if something has genuinely gone wrong. The full policy is on the Refunds page.',
      },
      {
        q: 'Is my payment secure?',
        a: 'Payments are processed by Razorpay over an encrypted connection. We never see or store your card details.',
      },
    ],
  },
  {
    icon: FiMessageCircle,
    title: 'Matches & messaging',
    faqs: [
      {
        q: 'Why can I not message someone?',
        a: 'Chat opens when interest is mutual — both of you have liked each other — and requires a paid plan on at least one side. This keeps inboxes free of unsolicited messages.',
      },
      {
        q: 'How is the compatibility score worked out?',
        a: 'It combines the things families actually weigh: community and religion preferences, city, education and profession, lifestyle and diet, and your stated partner preferences. Horoscope matching (Ashtakoot guna, Manglik status) is shown separately, never folded into the score.',
      },
    ],
  },
  {
    icon: FiShield,
    title: 'Safety & account',
    faqs: [
      {
        q: 'Someone is behaving inappropriately. What do I do?',
        a: 'Use Report on their profile or in the chat. Reports go to our safety team and are reviewed within 24 hours. Blocking them immediately stops all contact and hides your profile from them.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Settings → Account → Delete Account, or use the delete-account page. Your profile disappears from search immediately and your data is removed permanently within 7 days, as described in our Privacy Policy.',
      },
    ],
  },
];

const Faq = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-neutral-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 text-left py-4 min-h-[44px]"
      >
        <span className="font-medium text-neutral-900">{q}</span>
        <FiChevronDown className={`w-4 h-4 text-neutral-400 mt-1 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-sm text-neutral-600 leading-relaxed pb-4 -mt-1 max-w-2xl">{a}</p>}
    </div>
  );
};

export default function Help() {
  return (
    <div className="min-h-screen bg-[#FDF8F2] text-neutral-900">
      <Seo
        title="Help Centre"
        description="Answers about verification, plans and contact unlocks, matches and messaging, safety and account deletion on TricityMatch — plus how to reach our support team."
        path="/help"
      />

      {/* Hero */}
      <section className="px-4 pt-24 pb-12 md:pt-32 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500 hover:text-primary-600 transition-colors block w-fit py-2 px-2 -mx-2 -mt-2 mb-8">← Back to home</Link>
          <Eyebrow className="mb-5">● Help centre</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl">
            Answers, and a <span className="text-primary-700 italic">real person</span> when you need one.
          </h1>
          <p className="mt-6 text-lg text-neutral-600 max-w-2xl leading-relaxed">
            Most questions are answered below. If yours is not, write to us — every message reaches
            our team and gets a reply.
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="px-4 pb-14">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href={`mailto:${support.email}`}
            className="bg-white border border-neutral-200 rounded-2xl p-6 hover:border-primary-300 transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center mb-4">
              <FiMail className="w-5 h-5" />
            </span>
            <h2 className="font-display text-lg font-bold mb-1">Email support</h2>
            <p className="text-sm text-neutral-600 break-all">{support.email}</p>
          </a>

          <Link
            to="/contact"
            className="bg-white border border-neutral-200 rounded-2xl p-6 hover:border-primary-300 transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center mb-4">
              <FiHelpCircle className="w-5 h-5" />
            </span>
            <h2 className="font-display text-lg font-bold mb-1">Contact form</h2>
            <p className="text-sm text-neutral-600">Send us the details and we&apos;ll reply by email.</p>
          </Link>

          {/* Rendered only when a real WhatsApp number is configured — a dead
              support channel is worse than one fewer channel. */}
          {support.whatsapp && (
            <a
              href={`https://wa.me/${support.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-neutral-200 rounded-2xl p-6 hover:border-primary-300 transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-success-50 text-success flex items-center justify-center mb-4">
                <FaWhatsapp className="w-5 h-5" />
              </span>
              <h2 className="font-display text-lg font-bold mb-1">WhatsApp</h2>
              <p className="text-sm text-neutral-600">Chat with our team.</p>
            </a>
          )}
        </div>
      </section>

      {/* FAQ sections */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto space-y-6">
          {SECTIONS.map(({ icon: Icon, title, faqs }) => (
            <div key={title} className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <h2 className="font-display text-xl md:text-2xl font-bold">{title}</h2>
              </div>
              <div>
                {faqs.map((f) => <Faq key={f.q} {...f} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer links */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-3">
          <Link to="/safety" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 text-sm font-medium hover:border-primary-400 transition-colors">
            <FiShield className="w-4 h-4" /> Safety centre
          </Link>
          <Link to="/privacy" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 text-sm font-medium hover:border-primary-400 transition-colors">
            Privacy policy
          </Link>
          <Link to="/delete-account" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-neutral-300 text-sm font-medium hover:border-primary-400 transition-colors">
            <FiTrash2 className="w-4 h-4" /> Delete account
          </Link>
          <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
            Still stuck? Contact us <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
