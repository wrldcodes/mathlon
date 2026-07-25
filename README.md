# Mathlon

Interactive AI math tutor — voice + teaching canvas, built with Next.js.

This repo is shared. The goal of this doc is **how we land work on `main` safely**, including when most of the code was written with AI agents.

---

## How we land work on `main`

`main` is what the team pulls and tests. Feature work goes on a **branch**, then a **pull request (PR)** is reviewed and merged.

```text
latest main  →  your branch  →  commits  →  push  →  PR  →  review  →  merge to main
```

| Term | Meaning |
|------|---------|
| Branch | Your lane for one task (`feature/…`, `fix/…`) |
| PR | “Please put this branch into `main` after review.” |
| Review | You (or a teammate) decide the change is good enough to ship |

**One task ≈ one branch ≈ one PR.** Don’t mix unrelated work.

### Workflow (once Git is set up on your machine)

```bash
git checkout main
git pull origin main
git checkout -b feature/short-description-of-the-work

# …build the change (with or without an agent)…

git status
git add <files you intend to ship>   # never .env.local
git commit -m "Explain the change in plain English."
git push -u origin HEAD
```

Then on GitHub: open a PR **into `main`**, fill in what changed and how to test, get a review (or self-review if the team allows it), merge, then:

```bash
git checkout main
git pull origin main
```

If `main` moved while you worked:

```bash
git fetch origin
git rebase origin/main
# fix conflicts if any, then:
git push --force-with-lease
```

Use `--force-with-lease` only on **your** feature branch — never on `main`.

### Rules that matter

| Do | Don’t |
|----|--------|
| Branch from latest `main` | Land large features on `main` with no PR |
| Keep PRs focused and reviewable | One PR that “does everything” |
| Review before merge (especially agent code) | Rubber-stamp green CI without reading the diff |
| Keep secrets out of Git | Commit `.env.local` or API keys |

If you already pushed something bad to `main`, **stop and ask** before rewriting history.

---

## Reviewing code in the AI-agent era

A lot of Mathlon code will be written or edited by agents (Cursor, Claude, Copilot, etc.). Agents are fast; **they do not own the merge**. A human still decides what enters `main`.

You do **not** need to re-type the whole feature. You need a **tight review habit** so bad or risky diffs don’t land.

### What “review” means here

Review is not “read every line like a textbook.” It is:

1. **Understand the intent** — What problem does this PR solve?  
2. **Trust the diff, not the chat** — The agent’s summary can be wrong or incomplete. GitHub’s **Files changed** tab is the source of truth.  
3. **Decide: merge, request changes, or reject** — based on product fit, correctness, and safety.

### A practical review loop (use this freely)

Do this on **every** PR that isn’t a pure typo, including your own agent-heavy PRs (**self-review** counts).

#### 1. Orient (2 minutes)

- Read the PR title + description.  
- Skim the file list: which areas moved? (`src/app/canvas`, `api/sessions`, …)  
- Check size: a 40-file “misc fixes” PR is a smell — ask to split or at least review in passes.

#### 2. Walk the diff on GitHub

Open **Files changed**. For each meaningful hunk ask:

| Question | Why it matters |
|----------|----------------|
| Does this match the product goal? | Agents invent scope. |
| Would this break an existing flow? | Sessions, voice, canvas, auth-ish headers. |
| Are secrets or local-only paths included? | `.env.local`, keys, one-off scripts. |
| Is error handling real or cosmetic? | Empty `catch`, fake success. |
| Any data / identity mistakes? | Wrong `userId` scoping, shared env assumptions. |

Use GitHub’s **Viewed** checkbox so you can leave and resume.  
Collapse files you already understand (lockfiles, pure formatting) and spend time on logic.

#### 3. Run the app on the branch (when UI or API changed)

```bash
git fetch origin
git checkout the-pr-branch-name
git pull
npm install   # if package.json changed
npm run dev
```

Click through the path the PR claims to fix. Agent code often “looks right” and fails in the browser.

#### 4. Use AI as a **reviewer**, not as a merge button

Allowed and useful:

- Paste a suspicious file/hunk into an agent: *“What regressions could this cause? What’s unclear?”*  
- Ask: *“Summarize this PR’s risk areas from the diff only.”*  
- Ask for a test plan, then **you** execute it.

Not enough on its own:

- “LGTM” because the agent said the PR is fine.  
- Merging solely because CI is green (we may not have full CI coverage).

You stay accountable for the merge.

#### 5. Leave comments like a teammate

On GitHub, comment on the **line**:

- **Blocking:** “This still scopes sessions with a shared env user — please use the browser id header.”  
- **Non-blocking:** “Nit: name could be clearer.”  
- **Question:** “What happens if localStorage is blocked?”

Prefer specific, actionable notes over “this is messy.”

#### 6. Merge when you’re satisfied

On GitHub (PR page):

1. **Squash and merge** is a good default for agent-heavy branches (one clean commit on `main`).  
2. Confirm the commit message still describes the change.  
3. Delete the remote branch after merge if GitHub offers it.  
4. Locally: `git checkout main && git pull origin main`.

If something is wrong after merge: fix forward on a new branch/PR, or revert the merge commit — don’t silently rewrite `main`.

### Self-review checklist (agent wrote most of this)

Before you request review — or before you merge your own PR:

- [ ] I opened **Files changed** and scanned every non-generated file  
- [ ] I know which user-facing behavior changed  
- [ ] I ran the happy path locally (or noted why it’s docs-only)  
- [ ] No `.env.local` / keys / accidental debug dumps  
- [ ] PR description says **what / why / how to test**  
- [ ] Out-of-scope agent edits were reverted or split out  

If you can’t tick those, don’t merge yet.

### What you can skip (so review stays free, not heavy)

- Re-implementing the feature from scratch “to understand it”  
- Debating pure style that a formatter already owns  
- Blocking on every nit — mark nits as non-blocking and merge when the product is sound  

Review is a **filter for risk and intent**, not a full rewrite of the agent’s work.

---

## Local setup

### Requirements

- Node.js 20+ (LTS)
- npm (or pnpm)
- MongoDB URI
- Voice provider keys if testing tutoring (ElevenLabs by default)

### Install & run

```bash
git clone https://github.com/bryanqueen/mathlon.git
cd mathlon
npm install
cp .env.example .env.local
# edit .env.local with Mongo + voice keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

See `.env.example`. At minimum:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Mongo connection |
| `MONGODB_DB_NAME` | Database name (e.g. `mathlon`) |
| `NEXT_PUBLIC_VOICE_PROVIDER` | `elevenlabs` (default) |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | Agent id for voice |
| `ELEVENLABS_API_KEY` | Server-only (scripts / optional tooling) |

**Do not** set `MATHLON_DEV_USER_ID` or `NEXT_PUBLIC_USER_NAME`.  
Identity is per browser so teammates don’t share one session list.

**Never commit** `.env.local`.

### Identity & sessions (team testing)

| Browser key | Purpose |
|-------------|---------|
| `mathlon.userId` | Anonymous id; sent as `X-Mathlon-User-Id`; stored on session docs as `userId` |
| `mathlon.displayName` | UI / voice greeting only — **not** in Mongo |

First visit asks for a display name. Each browser gets its own history.

Optional local reset while dev is running: `/reset-identity.html`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local app |
| `npm run build` | Production build |
| `npm start` | Serve production build |

---

## Questions

Stuck on a conflict, a scary force-push prompt, or an agent PR you don’t trust? **Ask before merging or rewriting `main`.** That’s faster than recovering a broken shared branch.
