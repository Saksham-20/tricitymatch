/**
 * Skeleton — the ONE shimmer primitive (DS8). Replaces the ad-hoc
 * `animate-pulse` / hand-rolled shimmer divs so every loading state shares the
 * same texture. Uses the existing `.skeleton` class from index.css.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton variant="circle" className="w-12 h-12" />
 *   <Skeleton.Text lines={3} />
 */

const Skeleton = ({ variant = 'rect', className = '' }) => (
  <div
    aria-hidden="true"
    className={`skeleton ${variant === 'circle' ? 'rounded-full' : ''} ${className}`}
  />
);

const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`skeleton h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

Skeleton.Text = SkeletonText;

export default Skeleton;
