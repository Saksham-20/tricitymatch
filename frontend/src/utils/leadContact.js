// Leads store the phone as '91' + 10 digits and 'N/A' for a missing email (the
// column is NOT NULL). Neither should reach the screen raw.
export const formatLeadPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
  return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : (v || '');
};

export const leadEmail = (v) => (v && v !== 'N/A' ? v : null);
