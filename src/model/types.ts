/**
 * Core data model.
 *
 * The guiding rule: we persist *observations* (this handle appeared in this list,
 * in this file, in this snapshot) and never persist conclusions. Anything that
 * looks like a conclusion is derived at read time by `src/analysis/*` so that it
 * can always be traced back to the snapshots that produced it.
 */

/** Bumped whenever parsing output changes in a way that affects stored snapshots. */
export const PARSER_VERSION = '1.0.0';

/** A list an account can appear in within an Instagram export. */
export type RelationKind =
  | 'follower'
  | 'following'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'recently_unfollowed'
  | 'close_friend'
  | 'blocked'
  | 'restricted'
  | 'hidden_story_from';

export const RELATION_KINDS: readonly RelationKind[] = [
  'follower',
  'following',
  'pending_outgoing',
  'pending_incoming',
  'recently_unfollowed',
  'close_friend',
  'blocked',
  'restricted',
  'hidden_story_from',
];

export const RELATION_LABELS: Record<RelationKind, string> = {
  follower: 'Followers',
  following: 'Following',
  pending_outgoing: 'Follow requests you sent',
  pending_incoming: 'Follow requests you received',
  recently_unfollowed: 'Recently unfollowed by you',
  close_friend: 'Close friends',
  blocked: 'Blocked',
  restricted: 'Restricted',
  hidden_story_from: 'Story hidden from',
};

/** One account seen in one list of one snapshot. */
export interface Observation {
  /** Normalized key: lowercased, no '@', no '_u/' prefix, no trailing slash. */
  handle: string;
  /** Best human-readable form found in the export. */
  displayHandle: string;
  kind: RelationKind;
  /** Parsed follow date, epoch ms. Absent when the export omitted or mangled it. */
  followedAt?: number;
  /**
   * The timestamp exactly as printed, e.g. "Aug 01, 2026 9:09 am".
   * Rename matching compares this raw string rather than the parsed value so that
   * timezone ambiguity in the export can never invent or destroy a match.
   */
  followedAtRaw?: string;
  profileUrl?: string;
  /** Path of the file this came from, for provenance in the UI. */
  sourcePath: string;
}

/** How we decided which list a file represents. */
export type KindSource = 'document_heading' | 'filename' | 'none';

export interface SourceFile {
  path: string;
  bytes: number;
  /** Hash of the raw bytes, so a re-upload of the identical file is recognisable. */
  contentHash: string;
  kind: RelationKind | 'unmatched';
  kindSource: KindSource;
  /** Which extractor strategy produced the entries, or null if none did. */
  extractorId: string | null;
  entryCount: number;
}

export type ParseWarningCode =
  | 'unmatched_file'
  | 'no_entries'
  | 'no_timestamps'
  | 'kind_conflict'
  | 'duplicate_handles'
  | 'no_export_date'
  | 'mixed_export_dates'
  | 'unreadable_file';

export interface ParseWarning {
  code: ParseWarningCode;
  message: string;
  path?: string;
}

/** Where the snapshot's export date came from, shown in the UI so it is never a mystery. */
export type ExportDateSource =
  | 'document_header'
  | 'zip_filename'
  | 'latest_observation'
  | 'file_modified'
  | 'user_entered';

/**
 * The window Instagram itself claims the export covers, taken verbatim from the
 * "Contains data you requested from X to Y" line. This is evidence about coverage,
 * not a guarantee that every entry falls inside it.
 */
export interface CoverageWindow {
  from: string;
  to: string;
}

export interface Snapshot {
  id: string;
  label: string;
  /** ISO string. */
  exportedAt: string;
  exportedAtSource: ExportDateSource;
  importedAt: string;
  parserVersion: string;
  /** Account the export was generated for, when the export states it. */
  generatedBy?: string;
  coverage?: CoverageWindow;
  sourceFiles: SourceFile[];
  /**
   * Which lists this snapshot actually contains. The diff engine refuses to
   * compare a kind that is missing from either side, which is what stops a
   * failed or partial upload from being reported as a mass exodus.
   */
  kindsPresent: RelationKind[];
  warnings: ParseWarning[];
  observations: Observation[];
  /** Hash over the normalized per-kind handle lists; used for duplicate detection. */
  contentHash: string;
}

/** Result of parsing an upload, before the user commits it as a snapshot. */
export type ParsedSnapshot = Omit<Snapshot, 'id' | 'label' | 'importedAt'>;

export type AccountCategory = 'personal' | 'creator' | 'business' | 'unknown';

export const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  personal: 'Personal',
  creator: 'Creator / influencer',
  business: 'Business / brand',
  unknown: 'Unclassified',
};

export interface AccountClassification {
  handle: string;
  category: AccountCategory;
  note?: string;
  updatedAt: string;
}

export interface AppSettings {
  classifications: Record<string, AccountClassification>;
  /** Rename suggestions the user waved off, keyed "from->to". */
  dismissedRenames: string[];
  /** Default state of the "hide creators and brands" filter on the non-followers screen. */
  hideNonPersonalInNonFollowers: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  classifications: {},
  dismissedRenames: [],
  hideNonPersonalInNonFollowers: false,
};
