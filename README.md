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
