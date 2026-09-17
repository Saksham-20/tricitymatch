/**
 * ErrorState — DS8: distinct from empty (a server failure is never blamed on
 * the member's filters/data). icon + line + retry, mirroring the Search error
 * card idiom.
 */

import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

const ErrorState = ({
  title = "Couldn't load this",
  description = 'The connection dropped before this finished loading. Your data is safe — try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) => (
  <div className={`text-center py-12 px-6 ${className}`}>
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive-light dark:bg-destructive/15 flex items-center justify-center">
      <FiAlertCircle className="w-8 h-8 text-destructive" />
    </div>
    <h3 className="font-display text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
      {title}
    </h3>
    <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">{description}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-primary inline-flex items-center gap-2 text-sm">
        <FiRefreshCw className="w-4 h-4" />
        {retryLabel}
      </button>
    )}
  </div>
);

export default ErrorState;
