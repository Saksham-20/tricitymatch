import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Profile } from '../types';

/** EditProfile sections a nudge can open. */
export type EditSection = 'photos' | 'basic' | 'community' | 'career' | 'location' | 'about' | 'lifestyle';

/**
 * Where a nudge sends the member. A section name opens EditProfile on that
 * section; 'journey' resumes the profile questions (`useOnboarding().start`),
 * which is where marital status is collected. Only fields one of those two
 * places can complete are nudged: EditProfile has no marital status, income or
 * interest-tag field, and the journey never revisits income or interests once
 * profession and bio are filled, so a nudge for either led nowhere.
 */
export type MissingTarget = EditSection | 'journey';

export interface MissingItem {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  target: MissingTarget;
}

/**
 * High-value fields, in the order worth prompting. Only the unfilled ones show.
 * One source for My profile's completion card and Home's next-step strip, so
 * the two never name different "next" actions.
 */
export function computeMissing(profile: Profile | undefined, hasPhotos: boolean): MissingItem[] {
  if (!profile) return [];
  const items: MissingItem[] = [];
  if (!hasPhotos) items.push({ key: 'photos', label: 'Add photos', icon: 'camera-outline', target: 'photos' });
  if (!profile.bio) items.push({ key: 'bio', label: 'Write a short bio', icon: 'create-outline', target: 'about' });
  // Community fields carry real weight in matrimony matching — surface them too.
  if (!profile.religion) items.push({ key: 'religion', label: 'Add religion & community', icon: 'people-outline', target: 'community' });
  // The journey resumes at the first unanswered question, which is not always
  // marital status, so the row names what it opens rather than one question.
  if (!profile.maritalStatus) items.push({ key: 'marital', label: 'Finish your profile questions', icon: 'list-outline', target: 'journey' });
  if (!profile.education) items.push({ key: 'education', label: 'Add education', icon: 'school-outline', target: 'career' });
  if (!profile.profession) items.push({ key: 'profession', label: 'Add profession', icon: 'briefcase-outline', target: 'career' });
  if (!profile.height) items.push({ key: 'height', label: 'Add height', icon: 'resize-outline', target: 'basic' });
  return items;
}
