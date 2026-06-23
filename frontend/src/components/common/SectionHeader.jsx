import React from 'react';
import { cn } from '../../utils/cn';

/**
 * SectionHeader — canonical section title used across every page section.
 * Design-handoff spec: 4px tick bar + Playfair title + optional count chip + subtext.
 * Rule: tone="gold" for premium sections, tone="primary" (default) for standard.
 *
 * @example
 * <SectionHeader title="Mutual Matches" subtitle="They liked you back" count={3} countTone="ok"
 *   action={<Link to="/chat" className="btn-link">Open Chat</Link>} />
 */
const SectionHeader = ({
  title,
  subtitle,
  count,
  countTone = 'primary', // 'primary' | 'gold' | 'ok'
  tone = 'primary',      // tick color: 'primary' | 'gold'
  action,
  className,
  as: Heading = 'h2',
}) => {
  const tick = tone === 'gold' ? 'bg-gold-500' : 'bg-primary-500';
  const chipTone = {
    primary: 'text-primary-600 bg-primary-50 border-primary-100',
    gold: 'text-gold-700 bg-gold-50 border-gold-200',
    ok: 'text-success bg-success-50 border-success-100',
  }[countTone] || 'text-primary-600 bg-primary-50 border-primary-100';

  return (
    <div className={cn('flex items-end justify-between gap-4 mb-5', className)}>
      <div className="flex items-stretch gap-3 min-w-0">
        <span className={cn('w-1 rounded-full self-stretch min-h-[2.25rem]', tick)} aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Heading className="font-display text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
              {title}
            </Heading>
            {count != null && (
              <span className={cn('px-2.5 py-0.5 text-xs font-bold rounded-full border', chipTone)}>
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-neutral-500 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 hidden sm:flex items-center">{action}</div>}
    </div>
  );
};

export default SectionHeader;
