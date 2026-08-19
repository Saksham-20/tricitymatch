/**
 * BiodataCard — D5 flagship UX (DS9): not a bare download button.
 * Template picker (classic/modern) → generating state → success actions
 * [WhatsApp share (primary) / Download / Regenerate]. Warns when key biodata
 * fields are missing, with a jump to the editor.
 *
 * Share: navigator.share with the PDF file where supported (mobile browsers),
 * else the file downloads and a wa.me handoff opens with a ready message.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiFileText, FiDownload, FiRefreshCw, FiShare2, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Gold-ruled, traditional' },
  { id: 'modern', label: 'Modern', desc: 'Clean, minimal' },
];

// Fields whose absence makes a biodata feel incomplete to a receiving family.
const KEY_FIELDS = ['dateOfBirth', 'height', 'education', 'profession', 'religion', 'familyType'];

const BiodataCard = ({ profile }) => {
  const [template, setTemplate] = useState('classic');
  const [state, setState] = useState('idle'); // idle | generating | ready | error
  const [pdfBlob, setPdfBlob] = useState(null);

  const missing = profile
    ? KEY_FIELDS.filter((f) => !profile[f]).length
    : 0;

  const generate = async () => {
    setState('generating');
    try {
      const res = await api.get(`/profile/me/biodata?template=${template}`, { responseType: 'blob' });
      setPdfBlob(res.data);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'biodata-tricitymatch.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const file = new File([pdfBlob], 'biodata-tricitymatch.pdf', { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Marriage Biodata' });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback: download + hand off to WhatsApp with a ready message.
    download();
    const text = encodeURIComponent('Sharing my marriage biodata (PDF attached) — made with TricityMatch, tricitymatch.com');
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
    toast('PDF downloaded — attach it in WhatsApp', { icon: '📄' });
  };

  return (
    <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <FiFileText className="w-4 h-4 text-primary-500" aria-hidden="true" />
        <h3 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">Marriage Biodata</h3>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        A polished PDF of your profile, ready to share with families on WhatsApp.
      </p>

      {missing >= 2 && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm">
          <FiAlertCircle className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-neutral-600 dark:text-neutral-300">
            Add family and career details for a complete biodata.{' '}
            <Link to="/profile/edit" className="font-medium text-primary-600 hover:text-primary-800">Complete profile →</Link>
          </p>
        </div>
      )}

      {/* Template picker */}
      <div className="grid grid-cols-2 gap-3 mb-4" role="radiogroup" aria-label="Biodata template">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={template === t.id}
            onClick={() => { setTemplate(t.id); setState('idle'); setPdfBlob(null); }}
            className={`rounded-2xl border-2 p-3 text-left transition-all ${
              template === t.id
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
            }`}
          >
            {/* Mini preview */}
            <div className="h-16 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 mb-2 p-2 overflow-hidden">
              <div className={`h-1.5 w-1/2 rounded mb-1.5 ${t.id === 'classic' ? 'bg-primary-300' : 'bg-primary-400'}`} />
              <div className={`h-0.5 w-full mb-1.5 ${t.id === 'classic' ? 'bg-gold-300' : 'bg-primary-200'}`} />
              <div className="h-1 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700 mb-1" />
              <div className="h-1 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700 mb-1" />
              <div className="h-1 w-3/4 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{t.label}</p>
            <p className="text-[11px] text-neutral-400">{t.desc}</p>
          </button>
        ))}
      </div>

      {state === 'ready' ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={share}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#25D366] hover:bg-[#1fb958] text-white text-sm font-semibold transition-colors"
          >
            <FiShare2 className="w-4 h-4" /> Share on WhatsApp
          </button>
          <button
            onClick={download}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FiDownload className="w-4 h-4" /> Download
          </button>
          <button
            onClick={generate}
            aria-label="Regenerate biodata"
            className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={state === 'generating'}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors disabled:opacity-70"
        >
          {state === 'generating' ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
              Preparing your biodata…
            </>
          ) : (
            <>
              <FiFileText className="w-4 h-4" />
              {state === 'error' ? 'Try again' : 'Create my biodata'}
            </>
          )}
        </button>
      )}
      {state === 'error' && (
        <p className="mt-2 text-xs text-red-600 text-center">Couldn&apos;t generate the PDF — please try again.</p>
      )}
    </div>
  );
};

export default BiodataCard;
