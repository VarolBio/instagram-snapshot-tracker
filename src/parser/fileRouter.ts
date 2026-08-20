/**
 * Deciding which list a file represents.
 *
 * Two independent signals are used. The document heading is the ground truth, because
 * the file itself says "Followers" or "Following" in an <h1>. The filename is the
 * fallback, matched against the *basename only* - the containing directory is called
 * `followers_and_following`, so matching the full path would make every file in it
 * look like both a followers file and a following file.
 */

import type { RelationKind } from '../model/types';

interface Rule {
  kind: RelationKind;
  test: RegExp;
}

/** Ordered: the specific lists must be tested before the broad followers/following ones. */
const FILENAME_RULES: readonly Rule[] = [
  { kind: 'recently_unfollowed', test: /recently_unfollowed/ },
  { kind: 'pending_incoming', test: /(received|recent)_follow_requests|follow_requests_you.?ve_received/ },
  { kind: 'pending_outgoing', test: /pending_follow_requests|follow_requests_you.?ve_sent|sent_follow_requests/ },
  { kind: 'close_friend', test: /close_friends/ },
  { kind: 'blocked', test: /blocked/ },
  { kind: 'restricted', test: /restricted/ },
  { kind: 'hidden_story_from', test: /hide_story_from|hidden_story/ },
  { kind: 'follower', test: /followers/ },
  { kind: 'following', test: /following/ },
];

const HEADING_RULES: readonly Rule[] = [
  { kind: 'recently_unfollowed', test: /recently unfollowed/ },
  { kind: 'pending_incoming', test: /follow requests you.?ve received|received follow requests/ },
  {
    kind: 'pending_outgoing',
    test: /pending follow requests|follow requests you.?ve sent|sent follow requests/,
  },
  { kind: 'close_friend', test: /close friends/ },
  { kind: 'blocked', test: /blocked/ },
  { kind: 'restricted', test: /restricted/ },
  { kind: 'hidden_story_from', test: /hide story from|story hidden/ },
  { kind: 'follower', test: /^followers$|^followers\b/ },
  { kind: 'following', test: /^following$|^following\b/ },
];

export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

export function kindFromFilename(path: string): RelationKind | null {
  const name = basename(path).toLowerCase();
  for (const rule of FILENAME_RULES) {
    if (rule.test.test(name)) return rule.kind;
  }
  return null;
}

export function kindFromDocument(doc: Document): RelationKind | null {
  const heading = doc.querySelector('h1')?.textContent ?? doc.querySelector('title')?.textContent;
  if (!heading) return null;

  const normalized = heading
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  for (const rule of HEADING_RULES) {
    if (rule.test.test(normalized)) return rule.kind;
  }
  return null;
}
