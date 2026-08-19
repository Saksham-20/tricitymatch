/**
 * EmptyState — DS8/DS10: warm family voice, never "No data found".
 * icon + one line + optional CTA, matching the shipped empty-card idiom.
 */

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => (
  <div className={`text-center py-12 px-6 ${className}`}>
    {Icon && (
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        <Icon className="w-8 h-8 text-neutral-400" />
      </div>
    )}
    <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
      {title}
    </h3>
    {description && (
      <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">{description}</p>
    )}
    {actionLabel && onAction && (
      <button onClick={onAction} className="btn-primary inline-flex items-center gap-2 text-sm">
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;
