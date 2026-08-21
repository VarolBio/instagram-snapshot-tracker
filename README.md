# Instagram Snapshot Tracker

Track how your Instagram followers and following change over time by comparing your own
data exports. Everything runs in your browser. Nothing is uploaded anywhere.

**[Open the app](https://varolbio.github.io/instagram-snapshot-tracker/)**

> Your Instagram export is processed locally in your browser and is not uploaded to a server.

## What it does

You download your own Instagram data export every few weeks and drop it in. The app reads
the follower and following lists, saves each upload as a dated snapshot, and shows you what
changed between any two of them.

- Reads the whole `.zip` or just the loose `followers_1.html` / `following.html` files
- Current followers, following, mutuals, and accounts that do not follow you back
- Differences between any two snapshots, with a plain-language explanation of each one
- A full timeline for any account across every snapshot you have saved
- Search, sorting, filtering, and manual categories for personal / creator / business
- Duplicate upload detection, local backup export and import, and one-click delete-all

There is no Instagram login, no scraping, no unofficial API, and no server. The app only
ever reads the files you hand it.

## What a single upload already tells you

You do not need two exports to get value. Most of the app works from one, because the
interesting comparison is between your two lists rather than between two points in time.

Working immediately, from one upload:

- **Who does not follow you back** — your following list minus your followers list. This is
  usually the largest and most useful answer, and it needs only one export.
- Followers, following, mutuals, and the people who follow you that you have not followed back
- **A follow date for every single account**, because the export includes one per entry. That
  makes "who did I follow years ago that never followed back" a sortable question
- Categorising accounts as personal, creator, or business, and filtering non-followers by it

Needing a second upload:

- Who started or stopped appearing in a list, which is the entire Changes screen
- Account timelines with more than one point on them
- Possible username changes, which are inferred from a departure and an arrival sharing a date

So one upload answers "where do I stand", and the second onwards answers "what changed". A
useful side effect of the per-entry follow dates is that a single export shows when your
current followers arrived — though note that only covers followers you *still have*, so it is
not a historical follower count.

## What it deliberately will not tell you

This is the part most follower trackers get wrong, so it is worth being direct.

An export proves that an account **was listed** on the day it was generated. It cannot prove
why an account stopped being listed. Someone who disappears between two snapshots may have
unfollowed you, changed their username, deleted or deactivated their account, blocked you,
or simply been left out of an incomplete export. This app says exactly that:

> @someone stopped appearing in your followers between 12 January and 4 March.

rather than inventing a story about an unfollow that the data does not support.

Other honest limits, all of which the app states in its own interface:

| Limitation | Why |
| --- | --- |
| "All time" is not all of history | Instagram decides what to include, and the export's own header states the window it covers |
| A date range can shrink one list but not another | Requesting anything but "All time" may trim followers to that window while following still reaches back years, making the follower count a subset that looks like a total. The app detects this and warns |
| Someone who followed and left between two snapshots is invisible | Neither file ever recorded them |
| Exports covering different date ranges are not directly comparable | A two-month export lists only followers gained in those two months, so absences it implies are set aside rather than reported as departures |
| Renames are suggestions, never confirmations | Exports contain no account IDs, so the only link is a shared follow date |
| No automatic influencer or brand detection | The export has no follower counts. Optional username-keyword guesses stay suggestions until you confirm them |
| A missing list is a gap, not an exodus | Comparisons are refused when either snapshot lacks the list |

Every conclusion in the interface carries a label — Confirmed by export, Likely change,
Possible rename, Possibly deleted / deactivated / renamed / unavailable, or Insufficient
evidence — and names the source file it came from.

### About rename detection

Instagram keeps the original follow date when an account changes its username, which is the
only usable link between an old and a new name. A suggestion is raised only when exactly one
account disappeared and exactly one appeared carrying that same date. That strictness is not
theoretical: in a real export, four separate accounts shared a single timestamp, because the
export prints dates only to the minute.

## Getting your export

1. Instagram app → **Accounts Centre** → **Your information and permissions** → **Download your information**
2. Choose **Some of your information**, then select only **Followers and following** under Connections
3. Set the date range to **All time** and the format to **HTML**
4. Instagram emails a download link, usually within a few minutes
5. Drop the ZIP into the app, and repeat every few weeks to build up a history

## Running it locally

```bash
npm install
npm run dev      # development server
npm test         # 93 tests
npm run build    # production build into dist/
```

Requires Node 20 or newer.

### Testing against your own export

Copy your real `followers_1.html` and `following.html` next to `package.json` and run
`npm test`. An opt-in suite validates the parser against them and skips itself when they are
absent. Those filenames are gitignored, so your data cannot be committed by accident.

## How it is put together

```
src/
  model/       Types and the evidence vocabulary. All user-facing wording lives here.
  parser/      ZIP handling, file routing, and an ordered registry of HTML extractors
  analysis/    Current state, snapshot diffing, timelines, rename heuristic
  storage/     IndexedDB persistence and backup validation
  state/       React store, loads everything into memory once
  components/  Reusable pieces, including the evidence badges
  screens/     One file per tab
```

Two design choices carry most of the weight:

**The parser is a registry, not a hardcoded reader.** Instagram changes its export markup
without notice, so file identification and content extraction are both ordered lists of
strategies. A file's list is identified from its own `<h1>` first and its filename second, and
whichever extractor succeeded is recorded on the snapshot. Supporting a new format means
adding one file.

**Snapshots record observations, never conclusions.** A snapshot stores which accounts were
listed, in which file, with which follow date. Every comparison, count, and statement is
derived at read time, so a claim can always be traced back to the file that produced it and
none of the stored data has any interpretation baked into it.

## Deployment

Pushing to `main` runs typecheck, tests, and build, then publishes to GitHub Pages. Set
Settings → Pages → Source to **GitHub Actions** once, and note that `vite.config.ts` sets
`base` to the repository name.

## Privacy

No analytics, no telemetry, no network requests at runtime, no cookies, and no backend.
Snapshots live in this browser's IndexedDB on this device only, which also means clearing
your browser data deletes them. Use the backup option in Settings if the history matters.

## Licence

MIT

Instagram is a trademark of Meta Platforms, Inc. This project is not affiliated with or
endorsed by Meta.
