import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCopy, FiCheck, FiSend, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import apiClient from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import copyText from '../../utils/copyText';
import { launchPhase } from '../../utils/launchDate';
import { messageTemplates } from '../../data/partnerMessages';

const Card = ({ id, title, children }) => (
  <section id={id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-6 scroll-mt-6">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">{title}</h2>
    {children}
  </section>
);

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function MessageCard({ title, note, text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
          {note && <p className="text-xs text-neutral-600 dark:text-neutral-400">{note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800"
          >
            <FiSend size={14} aria-hidden="true" /> WhatsApp
            <span className="sr-only"> (opens WhatsApp with this message ready to send)</span>
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            {copied ? <FiCheck size={14} aria-hidden="true" /> : <FiCopy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">{text}</p>
      <span className="sr-only" role="status">{copied ? 'Message copied to the clipboard' : ''}</span>
    </div>
  );
}

const SAY = [
  'A matrimonial site made only for Chandigarh, Mohali and Panchkula.',
  'Creating a profile is free.',
  'Members can verify themselves with a live selfie, and verified profiles carry a badge.',
  'Each person decides who can see their phone number.',
  'A parent or guardian can create a profile on behalf of their son or daughter.',
];

const NEVER = [
  'Any promise of a match, a marriage or a timeline.',
  '"Background-verified", "police-verified" or "ID-verified". Verification is a live selfie check and nothing more.',
  'Numbers of members, matches or success stories that you cannot show on the website.',
  'Taking money, a UPI payment or a "deposit" yourself. Members pay TricityMatch directly.',
  'A discount or free offer that is not shown on the website or applied by your code.',
];

const FAQ = [
  {
    q: 'Is it really free?',
    a: 'Creating a profile and browsing is free. Premium is optional and adds contact unlocks; the current price is shown above and on the Membership page.',
  },
  {
    q: 'Can you guarantee a match?',
    a: 'No, and neither should you. TricityMatch helps families meet each other. What happens next is up to them.',
  },
  {
    q: 'Who can see my phone number?',
    a: 'Only who the member allows. In Settings → Privacy they choose everyone, matches only, or no one.',
  },
  {
    q: 'How are profiles checked?',
    a: 'A member can verify their profile with a live selfie, which our team compares with their photos before awarding the Verified badge. Reports are reviewed by people. It is not a background check.',
  },
  {
    q: 'What if I want a refund?',
    a: 'The Refund Policy on the website explains exactly what applies. For a payment problem, ask them to write to support.',
  },
];

export default function MarketingKit() {
  const { user } = useAuth();
  const [code, setCode] = useState(undefined); // undefined = loading, null = none
  const [premium, setPremium] = useState(null);

  useEffect(() => {
    apiClient.get('/marketing/referral-codes?limit=50')
      .then((r) => setCode((r.data?.codes || []).find((c) => c.isActive)?.code ?? null))
      .catch(() => setCode(null));
    apiClient.get('/subscription/plans')
      .then((r) => {
        const p = Object.entries(r.data?.plans || {})
          .filter(([key, v]) => key !== 'free' && v && Number(v.price) > 0)
          .map(([, v]) => v)[0];
        setPremium(p ? { name: p.name, price: Number(p.price), duration: p.duration, unlimited: p.contactUnlocks == null || p.contactUnlocks === -1 } : null);
      })
      .catch(() => {});
  }, []);

  const link = code ? `${window.location.origin}/onboarding?ref=${code}` : '[your link]';
  const me = user?.firstName || '[Your name]';
  const { phase } = launchPhase();
  const messages = messageTemplates({ me, link, phase });

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-100">Outreach Kit</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Messages you can send as they are, what to say, and what never to promise. Read the <Link to="/marketing/guide" className="text-primary-700 dark:text-primary-300 underline underline-offset-2">Partner Guide</Link> first.
        </p>
      </div>

      <div className="space-y-4">
        <Card id="link" title="Your link">
          {code === undefined && <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading your link…</p>}
          {code === null && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              You do not have a referral code yet. <Link to="/marketing/referral-codes" className="text-primary-700 dark:text-primary-300 underline underline-offset-2">Generate one</Link> and your link will appear in every message below.
            </p>
          )}
          {code && (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Anyone who signs up through this link is credited to you. Code: <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">{code}</span></p>
              <p className="break-all rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100">{link}</p>
            </>
          )}
        </Card>

        <Card id="facts" title="Facts you can quote">
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>Serves Chandigarh, Mohali and Panchkula.</li>
            <li>Creating a profile is free.</li>
            {premium && (
              <li>
                {premium.name} membership is {inr(premium.price)} for {premium.duration}{premium.unlimited ? ', with unlimited contact unlocks' : ''}. This is today's price from the website.
              </li>
            )}
            <li>Members choose who can see their phone number.</li>
          </ul>
        </Card>

        <Card id="messages" title="Messages">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Replace [Name] before you send. Send one-to-one, to people who know you. {code ? '' : 'Generate your code first so your link is filled in.'}
          </p>
          <div className="space-y-4">
            {messages.map((m) => <MessageCard key={m.id} title={m.title} note={m.note} text={m.text} />)}
          </div>
        </Card>

        <Card id="say" title="What to say, and what never to say">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                <FiCheckCircle className="text-green-600 dark:text-green-400" aria-hidden="true" /> Say
              </h3>
              <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                {SAY.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                <FiXCircle className="text-red-600 dark:text-red-400" aria-hidden="true" /> Never say or do
              </h3>
              <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                {NEVER.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        </Card>

        <Card id="faq" title="Questions people ask">
          <dl className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-medium text-neutral-900 dark:text-neutral-100">{q}</dt>
                <dd className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{a}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card id="before" title="Before you press send">
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            <li>You know this person, and they would expect to hear from you.</li>
            <li>You are writing to them alone, not to a group or a broadcast list.</li>
            <li>They are an adult who can legally marry (21 for men, 18 for women), or you are writing to their parent.</li>
            <li>If they say they are not interested, you stop.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
