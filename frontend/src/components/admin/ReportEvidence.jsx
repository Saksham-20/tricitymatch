import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiChevronDown, FiChevronUp, FiMessageSquare } from 'react-icons/fi';
import { getEvidenceList, getEvidenceRecord } from '../../api/adminApi';
import { formatDate, formatDateTime } from '../../utils/formatDate';

// What each kind of preserved record is, in the words a reviewer needs.
const SOURCE_LABEL = {
  report_filed: 'Chat captured when the report was filed',
  message_deleted: 'Message deleted while a report was open',
  message_edited: 'Message edited while a report was open (the earlier wording)',
};

const recordTitle = (row, reportId) => {
  const title = SOURCE_LABEL[row.source] || 'Kept when the account was erased';
  return row.reportId && row.reportId !== reportId ? `${title}, for another report` : title;
};

const countText = (n) => `${n} ${n === 1 ? 'message' : 'messages'}`;

/** The captured messages of one record, read-only. */
function CapturedMessages({ record, report, reporterName, reportedName }) {
  const payload = record.payload || {};
  const messages = Array.isArray(payload.messages) ? payload.messages : (payload.message ? [payload.message] : []);
  const who = (senderId) => {
    if (senderId && senderId === report.reportedUserId) return `${reportedName} (reported)`;
    if (senderId && senderId === report.reporterId) return `${reporterName} (reporter)`;
    if (senderId && senderId === payload.report?.reporterId) return 'Member who filed that report';
    return 'Another member';
  };

  return (
    <div className="mt-2 space-y-2">
      {payload.at && (
        <p className="text-xs text-gray-500">Changed on {formatDateTime(payload.at)}</p>
      )}
      {messages.length === 0 ? (
        <p className="text-xs text-gray-500">No messages in this record.</p>
      ) : (
        <ol className="space-y-2" aria-label="Captured messages">
          {messages.map((m, i) => (
            <li key={m.id || i} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
              <p className="text-[11px] text-gray-500">
                <span className="font-semibold text-gray-700">{who(m.senderId)}</span>
                {m.createdAt ? ` · ${formatDateTime(m.createdAt)}` : ''}
              </p>
              <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap break-words">
                {m.messageType === 'voice' ? <em>Voice message</em> : (m.content || <em>No text</em>)}
              </p>
            </li>
          ))}
        </ol>
      )}
      {payload.subjectProfile && (
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Profile as it was</p>
          <p>{[payload.subjectProfile.firstName, payload.subjectProfile.lastName].filter(Boolean).join(' ') || '—'}{payload.subjectProfile.city ? ` · ${payload.subjectProfile.city}` : ''}</p>
          {payload.subjectProfile.bio && <p className="mt-1 whitespace-pre-wrap break-words">{payload.subjectProfile.bio}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Preserved evidence behind a report: the conversation captured when it was
 * filed, messages the other person deleted or edited while it was open, and
 * anything kept about the reported member from other reports. The list is
 * metadata only; opening a record fetches its content (and is audited).
 */
export default function ReportEvidence({ report, reporterName, reportedName }) {
  const [rows, setRows] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [records, setRecords] = useState({}); // id -> { loading } | { data } | { error }
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setRows(null);
    setLoadError(false);
    try {
      const [forReport, forMember] = await Promise.all([
        getEvidenceList({ reportId: report.id }),
        report.reportedUserId ? getEvidenceList({ userId: report.reportedUserId }) : Promise.resolve({ data: { evidence: [] } }),
      ]);
      if (mine !== seq.current) return;
      const byId = new Map();
      [...(forReport.data?.evidence || []), ...(forMember.data?.evidence || [])].forEach((r) => byId.set(r.id, r));
      // This report's records first, then the newest of the rest.
      const sorted = [...byId.values()].sort((a, b) => (
        (b.reportId === report.id) - (a.reportId === report.id) || new Date(b.createdAt) - new Date(a.createdAt)
      ));
      setRows(sorted);
    } catch {
      if (mine !== seq.current) return;
      setLoadError(true);
      setRows([]);
    }
  }, [report.id, report.reportedUserId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row) => {
    if (openId === row.id) { setOpenId(null); return; }
    setOpenId(row.id);
    if (records[row.id]?.data) return;
    setRecords((all) => ({ ...all, [row.id]: { loading: true } }));
    try {
      const res = await getEvidenceRecord(row.id);
      setRecords((all) => ({ ...all, [row.id]: { data: res.data.evidence } }));
    } catch {
      setRecords((all) => ({ ...all, [row.id]: { error: true } }));
    }
  };

  return (
    <section aria-labelledby={`evidence-${report.id}`} className="rounded-xl border border-gray-200 p-3">
      <h4 id={`evidence-${report.id}`} className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
        <FiMessageSquare className="w-4 h-4" aria-hidden="true" /> Evidence
      </h4>

      {rows === null ? (
        <p className="mt-2 text-xs text-gray-500" aria-busy="true">Loading evidence…</p>
      ) : loadError ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-700" role="alert">
          <FiAlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          Could not load the evidence.
          <button type="button" onClick={load} className="underline font-medium min-h-[32px]">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          Nothing was kept for this report or this member. A chat is captured only when the two had messaged each other.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {rows.map((row) => {
            const open = openId === row.id;
            const state = records[row.id] || {};
            return (
              <li key={row.id} className="py-2">
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  aria-expanded={open}
                  aria-controls={`evidence-body-${row.id}`}
                  className="w-full min-h-[40px] flex items-center justify-between gap-3 text-left rounded-lg px-1 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800">{recordTitle(row, report.id)}</span>
                    <span className="block text-[11px] text-gray-500">
                      {countText(Number(row.messageCount) || 0)} · {formatDate(row.createdAt)}
                      {row.preserveUntil ? ` · kept until ${formatDate(row.preserveUntil)}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary-700">
                    {open ? 'Hide' : 'Open'}
                    {open ? <FiChevronUp className="w-4 h-4" aria-hidden="true" /> : <FiChevronDown className="w-4 h-4" aria-hidden="true" />}
                  </span>
                </button>
                {open && (
                  <div id={`evidence-body-${row.id}`} className="px-1">
                    {state.loading && <p className="mt-2 text-xs text-gray-500">Opening…</p>}
                    {state.error && (
                      <p className="mt-2 text-xs text-red-700" role="alert">Could not open this record. Close it and try again.</p>
                    )}
                    {state.data && (
                      <CapturedMessages record={state.data} report={report} reporterName={reporterName} reportedName={reportedName} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
