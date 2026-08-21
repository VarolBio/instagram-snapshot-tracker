import { EvidenceLegend } from './EvidenceBadge';
import { Card, SectionTitle } from './ui';

const LIMITATIONS = [
  {
    title: '"All time" is not all of history',
    body: 'Instagram decides what an export contains, and its own header states the window it covers. Your first upload is a baseline of what Instagram included that day, not a complete record of everyone who ever followed you.',
  },
  {
    title: 'A date range can quietly shrink one list and not another',
    body: 'If you request anything other than "All time", Instagram may trim your followers list to accounts acquired inside that window while leaving your following list reaching back years. The follower count then looks like a total when it is really a subset. This app compares each list against the window the export declares and warns you when one of them looks trimmed, but the only real fix is to re-request with the range set to "All time".',
  },
  {
    title: 'Two exports taken over different date ranges are not directly comparable',
    body: 'An export requested for the last two months lists only the followers gained in those two months. Comparing it against an all-time export would put every long-standing follower in the "gone" column. Where the later export\u2019s own date range explains an absence, that account is set aside and counted separately instead of being reported as a departure. Always request "All time" so your snapshots are comparable.',
  },
  {
    title: 'Anyone who came and went between snapshots is invisible',
    body: 'If somebody followed you in February and left in March, and your snapshots are from January and April, nothing in either file records that they were ever there.',
  },
  {
    title: 'A disappearance has at least five explanations',
    body: 'An account that stops appearing may have unfollowed, changed its username, been deleted, been deactivated, blocked you, or simply been left out of an incomplete export. Nothing in the export distinguishes these, so this app never picks one for you.',
  },
  {
    title: 'Renames are suggestions built on a shared follow date',
    body: 'Exports contain no account IDs. The only link between an old and a new username is the follow date Instagram carries over. A suggestion appears only when exactly one account left and exactly one arrived with that same date, because those dates genuinely collide otherwise.',
  },
  {
    title: 'There is no follower count, verification badge, or account type',
    body: 'The export lists usernames and follow dates and nothing more. Optional keyword guesses (official, festival, .io, and whatever you add) only read the username and stay suggestions until you confirm them. Telling a creator or brand apart from a personal account is still your judgement.',
  },
  {
    title: 'A missing list is treated as a gap, not an exodus',
    body: 'If a snapshot does not contain a list at all, comparisons involving that list are refused rather than reporting everybody in it as gone.',
  },
  {
    title: 'Follow times are read without a timezone',
    body: 'The export prints follow dates with no timezone, so they are read as UTC and may be off by a few hours. Anything requiring exactness compares the original printed text instead.',
  },
];

export function LimitationsPanel() {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>What this app cannot tell you</SectionTitle>
        <div className="space-y-3">
          {LIMITATIONS.map((limitation) => (
            <Card key={limitation.title} className="p-4">
              <h3 className="text-sm font-semibold text-ink-100">{limitation.title}</h3>
              <p className="mt-1 text-sm text-ink-400">{limitation.body}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>What the labels mean</SectionTitle>
        <Card className="p-4">
          <EvidenceLegend />
        </Card>
      </div>
    </div>
  );
}
