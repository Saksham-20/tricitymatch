import React, { useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import {
  PROFILE_PROMPTS, MAX_PROMPTS, PROMPT_ANSWER_MAX, fromProfilePrompts, toProfilePrompts, promptLabel,
} from '../../constants/profilePrompts';
import { findContactInText, contactInTextMessage } from '../../utils/contactInText';

const FIELD = 'w-full px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-[160ms]';

/**
 * Up to three "Get to know me" answers. Pairs are kept locally (so a chosen
 * question with a half-typed answer survives) and written back to the form in
 * the stored shape on every change.
 */
export default function PromptsEditor({ value, onChange }) {
  const { t } = useTranslation();
  const [pairs, setPairs] = useState(() => fromProfilePrompts(value));

  const commit = (next) => {
    setPairs(next);
    onChange(toProfilePrompts(next));
  };
  const update = (i, patch) => commit(pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i) => commit(pairs.filter((_, j) => j !== i));
  const unused = PROFILE_PROMPTS.filter((q) => !pairs.some((p) => p.prompt === q));
  const add = () => { if (unused.length) commit([...pairs, { prompt: unused[0], answer: '' }]); };

  return (
    <div>
      <p className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">{t('prompts.title')} <span className="text-xs font-normal text-neutral-500">{t('prompts.optional')}</span></p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{t('prompts.intro', { max: MAX_PROMPTS })}</p>
      <div className="space-y-4">
        {pairs.map((p, i) => {
          const kind = findContactInText(p.answer || '');
          const id = `prompt-answer-${i}`;
          return (
            <div key={i} className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <label htmlFor={`prompt-q-${i}`} className="sr-only">{t('prompts.questionN', { n: i + 1 })}</label>
                <select
                  id={`prompt-q-${i}`}
                  value={p.prompt}
                  onChange={(e) => update(i, { prompt: e.target.value })}
                  className={`${FIELD} py-2.5 text-sm font-medium`}
                >
                  {[p.prompt, ...unused].map((q) => <option key={q} value={q}>{promptLabel(q, t)}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={t('prompts.removeQuestionN', { n: i + 1 })}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-neutral-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors duration-[160ms]"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <label htmlFor={id} className="sr-only">{t('prompts.answerTo', { prompt: promptLabel(p.prompt, t) })}</label>
              <textarea
                id={id}
                rows={3}
                maxLength={PROMPT_ANSWER_MAX}
                value={p.answer}
                onChange={(e) => update(i, { answer: e.target.value.slice(0, PROMPT_ANSWER_MAX) })}
                placeholder={t('prompts.answerPlaceholder')}
                aria-invalid={kind ? 'true' : undefined}
                className={`${FIELD} resize-none`}
              />
              <div className="flex justify-between text-xs">
                {kind
                  ? <span role="alert" className="text-red-600 dark:text-red-400">{contactInTextMessage(kind)}</span>
                  : <span className="text-neutral-400">{p.answer.trim() ? '' : t('prompts.emptyNotSaved')}</span>}
                <span className="text-neutral-500">{p.answer.length}/{PROMPT_ANSWER_MAX}</span>
              </div>
            </div>
          );
        })}
      </div>
      {pairs.length < MAX_PROMPTS && unused.length > 0 && (
        <button
          type="button"
          onClick={add}
          className="mt-3 inline-flex items-center gap-2 px-4 min-h-[2.75rem] rounded-lg border border-dashed border-primary-300 dark:border-primary-700 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors duration-[160ms]"
        >
          <FiPlus className="w-4 h-4" /> {pairs.length ? t('prompts.addAnother') : t('prompts.addFirst')}
        </button>
      )}
    </div>
  );
}
