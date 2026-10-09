/**
 * BiodataCard — D5 flagship UX (DS9): not a bare download button.
 * Template picker (Traditional/Modern) → generating state → success actions
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
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

// Two genuinely different layouts (see backend/utils/biodata.js). The ids stay
// classic/modern because shipped mobile builds send them.
// Label and description: `biodata.templates.<id>.label|desc`.
const TEMPLATES = [{ id: 'classic' }, { id: 'modern' }];

// Thumbnails drawn to match each PDF's actual layout, so the choice is visible
// before generating. Colours stay off gold (premium signal, doctrine §3.1).
const TraditionalThumb = () => (
  <div className="h-24 rounded-md bg-white dark:bg-neutral-900 border-2 border-primary-400 p-1">
    <div className="h-full rounded-sm border border-primary-200 dark:border-primary-800 flex flex-col items-center pt-1.5 gap-1">
      <div className="flex items-center gap-1 w-full px-1.5">
        <div className="h-px flex-1 bg-primary-200" />
        <div className="h-1 w-6 rounded bg-primary-400" />
        <div className="h-px flex-1 bg-primary-200" />
      </div>
      <div className="h-5 w-4 rounded-sm bg-neutral-300 dark:bg-neutral-600" />
      <div className="h-1 w-10 rounded bg-neutral-500 dark:bg-neutral-400" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1 w-full px-2">
          <div className="h-0.5 w-5 rounded bg-neutral-400 dark:bg-neutral-500" />
          <div className="h-0.5 w-0.5 rounded-full bg-primary-300" />
          <div className="h-0.5 flex-1 rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
      ))}
    </div>
  </div>
);

const ModernThumb = () => (
  <div className="h-24 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 overflow-hidden flex">
    <div className="w-1/3 bg-primary-500 flex flex-col items-center pt-2 gap-1">
      <div className="h-5 w-5 rounded-md bg-primary-300" />
      <div className="h-1 w-6 rounded bg-white/90" />
      <div className="h-0.5 w-5 rounded bg-white/60" />
      <div className="h-0.5 w-4 rounded bg-white/60" />
    </div>
    <div className="flex-1 p-1.5 space-y-1.5">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center gap-0.5 mb-0.5">
            <div className="h-1.5 w-0.5 bg-primary-500" />
            <div className="h-1 w-7 rounded bg-neutral-500 dark:bg-neutral-400" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="h-0.5 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-0.5 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      ))}
    </div>
  </div>
);


// Fields whose absence makes a biodata feel incomplete to a receiving family.
const KEY_FIELDS = ['dateOfBirth', 'height', 'education', 'profession', 'religion', 'familyType'];

const BiodataCard = ({ profile }) => {
  const { t } = useTranslation();
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
    a.download = `biodata-tricitymatch-${template === 'modern' ? 'modern' : 'traditional'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const file = new File([pdfBlob], `biodata-tricitymatch-${template === 'modern' ? 'modern' : 'traditional'}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t('biodata.shareTitle') });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback: download + hand off to WhatsApp with a ready message.
    download();
    const text = encodeURIComponent(t('biodata.waText'));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
    toast(t('biodata.downloaded'), { icon: <FiFileText className="w-4 h-4 text-primary-500" /> });
  };

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <FiFileText className="w-4 h-4 text-primary-500" aria-hidden="true" />
        <h3 className="font-display text-base font-bold text-neutral-900 dark:text-neutral-100">{t('biodata.title')}</h3>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        {t('biodata.intro')}
      </p>

      {missing >= 2 && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm">
          <FiAlertCircle className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-neutral-600 dark:text-neutral-300">
            {t('biodata.missing')}{' '}
            <Link to="/profile/edit" className="font-medium text-primary-600 hover:text-primary-800">{t('biodata.completeProfile')}</Link>
          </p>
        </div>
      )}

      {/* Template picker */}
      <div className="grid grid-cols-2 gap-3 mb-4" role="radiogroup" aria-label={t('biodata.pickerAria')}>
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            role="radio"
            aria-checked={template === tpl.id}
            onClick={() => { setTemplate(tpl.id); setState('idle'); setPdfBlob(null); }}
            className={`rounded-2xl border-2 p-3 text-left transition-colors duration-[160ms] ${
              template === tpl.id
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
            }`}
          >
            {/* Mini preview of the actual layout */}
            <div className="mb-2" aria-hidden="true">
              {tpl.id === 'classic' ? <TraditionalThumb /> : <ModernThumb />}
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{t(`biodata.templates.${tpl.id}.label`)}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-snug mt-0.5">{t(`biodata.templates.${tpl.id}.desc`)}</p>
          </button>
        ))}
      </div>

      {state === 'ready' ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={share}
            className="flex-1 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#25D366] hover:bg-[#1fb958] text-white text-sm font-semibold transition-colors"
          >
            <FiShare2 className="w-4 h-4" /> {t('biodata.shareWhatsApp')}
          </button>
          <button
            onClick={download}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FiDownload className="w-4 h-4" /> {t('biodata.download')}
          </button>
          <button
            onClick={generate}
            aria-label={t('biodata.regenerate')}
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
              {t('biodata.preparing')}
            </>
          ) : (
            <>
              <FiFileText className="w-4 h-4" />
              {state === 'error' ? t('biodata.tryAgain') : t('biodata.create')}
            </>
          )}
        </button>
      )}
      {state === 'error' && (
        <p className="mt-2 text-xs text-destructive text-center">{t('biodata.error')}</p>
      )}
    </div>
  );
};

export default BiodataCard;
