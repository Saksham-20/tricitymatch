// Values must match backend/constants/reportReasons.js. Order is the order shown:
// safety-critical categories first, catch-all last.
export const REPORT_REASONS = [
  { value: 'threats', label: 'Threats or I feel unsafe', hint: 'Someone threatened, pressured or frightened you.' },
  { value: 'harassment', label: 'Harassment or abuse', hint: 'Insulting, persistent or unwanted contact.' },
  { value: 'financial_scam', label: 'Asks for money or looks like a scam', hint: 'Requests for money, gifts, deposits or investments.' },
  { value: 'fake_profile', label: 'Fake profile or false identity', hint: 'The person is not who the profile says.' },
  { value: 'stolen_photos', label: "Uses someone else's photos", hint: 'The photos belong to another person.' },
  { value: 'underage', label: 'May be under the legal age', hint: '21 for men, 18 for women.' },
  { value: 'inappropriate_content', label: 'Inappropriate photos or content', hint: '' },
  { value: 'misleading_info', label: 'Misleading information', hint: 'Marital status, job, income or family details that look untrue.' },
  { value: 'spam', label: 'Spam or advertising', hint: '' },
  { value: 'other', label: 'Something else', hint: '' },
];

// Reasons where someone may be in danger: we point at emergency help.
export const URGENT_REASONS = ['threats'];
