import { FiClock } from 'react-icons/fi';

/**
 * Urgent reports have to be acted on within a day of being filed. While one is
 * open the queue shows how long ago it was filed and how long is left, or by how
 * much it is late, counted from when it was filed.
 */
export const URGENT_ACTION_HOURS = 24;
const HOUR = 60 * 60 * 1000;
const OPEN = ['pending', 'reviewing'];

export function reportDeadline(report, now = Date.now()) {
  if (!report || report.priority !== 'urgent' || !OPEN.includes(report.status)) return null;
  const filed = new Date(report.createdAt).getTime();
  if (Number.isNaN(filed)) return null;
  const dueAt = filed + URGENT_ACTION_HOURS * HOUR;
  return { ageMs: Math.max(0, now - filed), leftMs: dueAt - now, overdue: now >= dueAt, dueAt: new Date(dueAt) };
}

// Whole units, rounded down: "45 min", "5 h", "2 d 4 h".
export const spellDuration = (ms) => {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
};

export const deadlineLabel = (deadline) => {
  if (!deadline) return null;
  return deadline.overdue ? `Overdue by ${spellDuration(-deadline.leftMs)}` : `Due in ${spellDuration(deadline.leftMs)}`;
};

export default function ReportDeadlineChip({ report, now = Date.now() }) {
  const deadline = reportDeadline(report, now);
  if (!deadline) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold normal-case ${
          deadline.overdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        }`}
      >
        <FiClock className="w-3 h-3" aria-hidden="true" />
        {deadlineLabel(deadline)}
      </span>
      <span className="text-[11px] text-gray-500 normal-case">filed {spellDuration(deadline.ageMs)} ago</span>
    </span>
  );
}
