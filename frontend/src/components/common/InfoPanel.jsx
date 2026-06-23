import React from 'react';
import { FiInfo } from 'react-icons/fi';
import { cn } from '../../utils/cn';

/**
 * InfoPanel — the ONE standardized info box. Muted neutral surface + burgundy
 * icon. Replaces all rainbow blue/green/cyan/yellow-50 info boxes per the
 * design-handoff. Use tone only for genuine semantic states.
 */
const TONES = {
  info: 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
  success: 'bg-success-50 text-success border-success-100',
  warning: 'bg-warning-light text-warning border-warning/20',
  error: 'bg-destructive-light text-destructive border-destructive/20',
};

const InfoPanel = ({ children, icon: Icon = FiInfo, tone = 'info', className }) => (
  <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', TONES[tone] || TONES.info, className)}>
    <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', tone === 'info' && 'text-primary-500')} />
    <div className="min-w-0 leading-relaxed">{children}</div>
  </div>
);

export default InfoPanel;
