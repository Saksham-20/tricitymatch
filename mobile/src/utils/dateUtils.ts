import { formatDistanceToNow, format, differenceInYears } from 'date-fns';

export const getAge = (dateOfBirth: string): number =>
  differenceInYears(new Date(), new Date(dateOfBirth));

export const formatRelativeTime = (date: string): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatDate = (date: string, pattern = 'dd MMM yyyy'): string =>
  format(new Date(date), pattern);

export const formatTime = (date: string): string =>
  format(new Date(date), 'hh:mm a');

export const formatCallDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
