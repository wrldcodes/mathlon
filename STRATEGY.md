# Mathlon — Architecture, Funding & B2B Strategy

> A grounded, evidence-based reasoning of where Mathlon is today, why Vapi is showing its seams, and what a more robust framework looks like for beta testers, production users, and B2B expansion.

---

## 1. What actually happened in your last session

I read through `call-logs-2026-05-28T03-31-35-614Z.json` (~266k log lines). Here is the truth about that call, not a guess:

### The session did not crash. It hit a configured ceiling.

The final two log events:

```text
log-3489  body: "call.maxDurationReached"
          attributes.maxDurationSeconds: 600
log-3490  body: "call.ended"
          attributes.endedReason: "exceeded-max-duration"
          attributes.durationMs: 600001
```

The call ended at **600.001 seconds — exactly 10 minutes**. That is Vapi's **default** `maxDurationSeconds` per the official Vapi server SDK reference. It is not a Krisp failure, not a network failure, not a Vapi bug. It is a config value that nobody on our side changed.

Source: Vapi server SDK reference — `max_duration_seconds … @default 600 (10 minutes)`.
Vapi support has publicly stated it can be configured up to **43,200s (12h)** but they recommend **staying under ~3,200s (~53 min)** for stability.

So the very first concrete fix is one line:

```ts
await vapi.start(assistantId, {
  clientMessages: [...],
  maxDurationSeconds: 3000, // 50 minutes — closer to a real tutoring session
});
```

That alone solves the symptom the user reported. The deeper architectural question still stands.

### What the log reveals about Vapi's real stack

Mathlon's "Vapi" call is actually a stitched pipeline of 4 third-party services:

| Stage | Provider | Model / Detail |
|-------|----------|----------------|
| Transport (WebRTC) | **Daily.co** | `transportProvider: "daily"`, 44.1 kHz stereo |
| Noise suppression | **Krisp** | bundled with Daily; this is the `Krisp error: system overload` you saw |
| STT (speech → text) | **Deepgram** | `nova-3`, `language: "multi"` |
| LLM | **Anthropic** | `claude-haiku-4-5-20251001` |
| TTS (text → speech) | **ElevenLabs** | `eleven_turbo_v2_5`, voiceId `FUfBrNit0NNZAwb58KWH`, `optimizeStreamingLatency: 3` |

So your hypothesis is correct: **Vapi already uses ElevenLabs under the hood for our voice.** Switching directly to ElevenLabs ElevenAgents would not change the voice you hear — it would change who orchestrates the four pieces and bills you.

### Krisp error: not fatal, but a real symptom

`Krisp error: system overload` (from the Next.js red overlay) is logged on the Daily.co audio worker. Krisp is the noise suppressor. "System overload" means it could not keep up with the audio stream — usually triggered by background-tab throttling, CPU contention, or audio clock drift.

The log shows ~70 `call.driftDetected` events through the 10-minute session. That is audio clock drift between the browser's capture clock and the server's playback clock. Drift accumulates in long-running web sessions, especially:

- when the tab loses focus (browsers throttle non-foreground audio),
- on lower-power machines (the user's case is plausible),
- when canvas rendering competes with audio worklets on the main thread.

This is not unique to Vapi — it is a Daily/Krisp/WebRTC class of problem. But it is amplified by Vapi's setup because:

1. We cannot tune Daily settings (we don't own the transport layer).
2. Krisp is forced on by default.
3. There's nothing we can do to surface the issue to the user gracefully — it crashes into the Next dev overlay.

### The Tool call failed errors (27 of them)

The log contains 27 `ERROR` entries, **all of them the same error**:

```text
toolName: canvas_write_text  (and canvas_draw_diagram)
error: "No result returned. If this is unexpected, see
       https://docs.vapi.ai/tools/custom-tools-troubleshooting#no-result-returned-error"
```

This is a Mathlon-side bug, not Vapi's:

- We registered `canvas_write_text`, `canvas_draw_diagram`, `canvas_navigate_to_step` as **client-side tools**.
- Client-side tools are intentionally "fire-and-forget" in our handler (`useVapiVoice.ts` listens for `tool-calls` and calls `onToolCall`, but never sends a result back).
- Vapi's LLM (Claude Haiku) still expects a tool result message. Without it, every single canvas action the AI took during that 10-minute lesson was logged server-side as a failed tool call.

That has two consequences:

1. **Token waste.** Claude keeps trying to reason about why the tool "failed" — that's why our prompts get bloated and the model sometimes apologizes for "not being able to draw."
2. **Bad telemetry.** From Vapi's dashboard, every Mathlon lesson looks like a fire of failing tool calls.

**Fix:** Either (a) move tool execution server-side so the result loop closes, or (b) explicitly emit a synthetic tool-result back to Vapi from the client (`vapi.send({ type: 'tool-result', toolCallId, result: 'ok' })`). I lean (b) for now — it keeps the canvas in-process and stops the error storm.

---

## 2. Why Vapi feels wrong for Mathlon (and what it's actually good at)

You said: *"I haven't seen anyone building what I'm building with it. People mostly use it for AI support calls."* That instinct is correct, and here's the architectural reason.

| Vapi is optimized for… | Mathlon needs… |
|---|---|
| Short, single-task calls (book a hair appointment, qualify a lead) — median 1–3 min | Long, exploratory tutoring sessions — 15–45 min target |
| Default `maxDurationSeconds = 600` | Sessions to live as long as the student is engaged |
| Phone-grade audio assumptions (telephony PSTN, mono 8 kHz endpoint historically) | High-quality 44.1 kHz two-way, plus rich client-side state (canvas, steps, diagrams) |
| Tools that *call your backend* and return a result | **Client-driven tools** that mutate UI state (canvas) and don't have a meaningful return |
| Single-turn "answer the question" patterns | Multi-step **pedagogy** — pacing, scaffolding, recall, follow-ups |
| Black-boxed orchestration (you cannot change Krisp, the VAD, the endpointing heuristic, drift handling) | The freedom to tune endpointing, mute Krisp, choose providers |
| Pricing optimized for low-cost-per-minute outbound dialing | Pricing economics for in-product educational sessions |

Vapi is excellent — for a different product. Their economic model and engineering investments are aimed at AI receptionists, AI SDRs, and outbound demo bots. We are building a **synchronous AI tutor with persistent canvas state**. That is closer to LiveKit + custom orchestration than it is to "Vapi for math."

This is not Vapi's fault. It's a product-fit mismatch and we found it by using their product seriously. That's healthy.

---

## 3. The real architectural choices on the table

There are three families of architecture that could power Mathlon. Each has a different cost curve, a different ceiling, and a different time-to-ship.

### Option A — Stay on Vapi, but tune it (this week)

**What this means:** Keep Vapi as the orchestration layer. Fix the things we can.

**Required changes:**

1. **`maxDurationSeconds` → 3000** (50 min) at session start, configurable per user later.
2. **Close the tool-result loop** so the 27-errors-per-session storm stops.
3. **Wake-lock + visibility handling.** Use `navigator.wakeLock` and pause/resume hints when the tab goes to background, to reduce drift.
4. **Bigger canvas-tool batching.** Instead of `canvas_write_text` 30 times, expose a coarser `canvas_step({ title, body, diagram? })` tool. Fewer round-trips = fewer tool errors and a snappier feel.
5. **Defensive UX:** if Vapi raises `call.ended` for any non-user reason, auto-resume the session from the last canvas step instead of dumping the user into the Next error overlay.

**Cost:** ~1–2 days of engineering. No new infra.
**Ceiling:** still bounded by Vapi's per-minute pricing and their roadmap. Still vulnerable to Krisp/drift in long sessions.
**Best for:** the next 4–6 weeks while we finish UX, ship to beta testers, and validate retention.

### Option B — Migrate to LiveKit Agents (4–6 weeks, recommended target)

**What this means:** We own the orchestration layer. We pick our STT, LLM, and TTS independently. LiveKit handles the WebRTC transport (which they *built* — it's the same transport behind ChatGPT Advanced Voice Mode).

**Why LiveKit fits Mathlon specifically:**

- **No artificial duration cap.** Our session lives as long as we keep the room alive.
- **Cascaded pipeline that we control.** STT (Deepgram nova-3) → LLM (Claude Haiku / Gemini Flash / GPT) → TTS (ElevenLabs Flash 2.5 / Cartesia Sonic). We can swap any leg.
- **First-class client tools.** LiveKit's `function_tool` model is built to round-trip back to the client cleanly.
- **WebRTC owned by LiveKit themselves.** No Daily middleman; Krisp is optional and tuneable.
- **Open source.** No vendor lock-in. We can self-host later.
- **Inference API** lets us route STT/LLM/TTS through one API key while we're small, then break out provider keys when we want pricing control.

**Cost analysis** (from the 2026 LiveKit playbook):

| Stack | Time-to-first-call | Cost / min |
|---|---|---|
| LiveKit Agents | 2–6 weeks | **$0.05–0.18** |
| Vapi | 2–3 hours | $0.05–0.13 |
| Retell | 3–6 hours | $0.06–0.15 |

Practically, our cost-per-minute on LiveKit + Deepgram + Claude Haiku + ElevenLabs Flash 2.5 should land near **$0.08–0.10/min**, the same ballpark as Vapi — because the underlying providers are the same. We're cutting the orchestration markup but spending engineering hours instead.

**Recommended LiveKit stack for Mathlon:**

```python
session = AgentSession(
    stt=inference.STT("deepgram/nova-3"),       # already what Vapi uses
    llm=inference.LLM("anthropic/claude-haiku-4-5"),  # already what Vapi uses
    tts=inference.TTS("elevenlabs/turbo-v2-5"), # already what Vapi uses
    vad=silero.VAD.load(),                       # owned, no Krisp
    turn_detection=MultilingualTurnDetector(),   # tuneable, unlike Vapi's heuristic
)
```

We literally keep the exact same voice the user already knows, we just stop renting the duct tape between the pieces.

**Best for:** Beta launch and the first 6 months of production. This is the right home if Mathlon takes off.

### Option C — Gemini Live (speech-to-speech, future bet)

**What this means:** Skip the cascaded STT → LLM → TTS pipeline entirely. Gemini Live ingests raw audio and emits raw audio. One model, one provider, no glue.

**Why this is interesting for Mathlon:**

- **Latency is unbeatable** (~200–400 ms vs ~600–900 ms for cascade).
- **Emotion and prosody preserved** end-to-end — for a tutor, this matters (excitement when the student gets it, gentle pacing when they're struggling).
- It is the model behind the XPRIZE we're targeting — strategically aligned.

**Why we wait on it as primary:**

- Tool/function calling on Gemini Live is still less mature than on cascaded LLMs. Our canvas relies heavily on tool calls — degrading that experience to pick up better prosody is a bad trade today.
- Free tier excludes Pro models since April 2026. Gemini Live Flash is on the free tier but with **1,500 req/day, 10 RPM** caps — fine for prototyping, not for beta usage.
- It is fast-moving (3.1 Flash Live just released). Wiring it in now means rewriting again in 3 months.

**Best for:** A second voice path we ship in beta as a toggle ("Talk to Mathlon in fluent mode"), behind LiveKit. LiveKit's `AgentSession` already supports both cascade and speech-to-speech under the same agent — we don't have to rebuild to add it.

---

## 4. Recommended phased framework

> **Update — Solo unfunded founder reality check.** The original plan below assumed we had budget to keep Vapi running while we migrated. The truth is: Vapi credits are exhausted, Vapi's Startup Program is on hold, and there is no money to buy more. That changes the order of operations significantly. **The revised plan below skips Phase 0 (stabilize on Vapi) and goes straight to migration.** Vapi stays only as a fallback we test against when we have free minutes.

### Phase 1 — Migrate to ElevenLabs Agents (this week, ~3–5 days engineering)

**Why this and not LiveKit first:**

- You already tested ElevenLabs Conversational AI Agents and liked the voice and the ergonomics.
- ElevenLabs offers a Startup Grant: **3 months of Business-tier access (~11M characters / ~3,600 Conversational AI minutes per month, totalling ~33M characters / ~10,800 minutes)**, no credit card, applications reviewed within ~3–7 days (official: "within one week").
  > *Correction from earlier draft: the grant is 3 months of Business-tier access, not 12 months. The 12-month figure refers to the duration of the "ElevenLabs Grants" footer-logo requirement, which is a condition of acceptance — not the grant length itself.*
- LiveKit Cloud Build is free but requires you to assemble + own the STT + LLM + TTS pipeline yourself. Solo founder engineering time is the bottleneck, not orchestration fees.
- You can always migrate to LiveKit *later* if Mathlon outgrows ElevenLabs Agents. Not before.

**Tool calling capability — verified:** ElevenLabs Agents supports our exact pattern of client-side tools via `useConversationClientTool(name, handler)` in their React SDK, with proper "Wait for response" semantics that **let tools return real values back to the agent.** This is a strict upgrade over Vapi (which is what caused the 27-error-per-session storm in our log). All three canvas tools (`canvas_write_text`, `canvas_draw_diagram`, `canvas_navigate_to_step`) map directly to the new API. ElevenLabs Agents also natively supports `claude-haiku-4-5` as the LLM — the same model Vapi was using underneath — so the agent's intelligence doesn't change either.

**Required work:**

- [ ] **Apply for the ElevenLabs Startup Grant TODAY** (`elevenlabs.io/startup-grants`). Framing: "voice-first AI tutor for adult math learners (university students, exam prep, career re-skillers). Beta cohort 18+." Avoid the word "kids" or "K-12" in the application; that's an auto-reject under their no-minors clause. K-12 is a B2B-institutional channel we'll explore later.
- [ ] Sign up for Deepgram (instant $200 in credits, no card) — kept as a fallback STT and for direct STT integrations if needed.
- [ ] Sign up for Anthropic Console ($5 sign-on credit) — Claude Haiku 4.5 stays our LLM, now billed pay-as-you-go directly.
- [ ] Register for **Build with Gemini XPRIZE** — gets you **$100 AI Ultra + $300 Google Cloud** in credits just for registering. Gemini Live becomes our toggle-able S2S voice path during the 90-day window.
- [ ] Apply for **Google for Startups Start tier** ($2K–$20K Cloud credits, no VC requirement, <5 yrs old, MVP-stage).
- [ ] Apply for **Deepgram Startup Program** ($100K credits, 12 months, no VC required — just <$10M funded + live website + voice product).
- [ ] Build ElevenLabs Agents integration:
  - Replace `useVapiVoice.ts` with `useElevenAgents.ts`.
  - Port the three canvas client-tools (`canvas_write_text`, `canvas_draw_diagram`, `canvas_navigate_to_step`) to ElevenLabs' client-tool API — and **return real results** this time so we don't recreate the 27-errors-per-session storm.
  - Use ElevenLabs' "Custom LLM" feature to point at Anthropic Claude Haiku 4.5 directly (the same model Vapi was routing to underneath).
  - Keep the same voice (`FUfBrNit0NNZAwb58KWH`) — students hear no change.
- [ ] Add session persistence (Supabase free tier works) so a refresh doesn't kill canvas state.
- [ ] Add wake-lock + tab visibility handling to reduce drift in long sessions.
- [ ] Add the "ElevenLabs Grants" footer logo + link (grant condition; trivially small commitment).

**Exit condition:** five complete 30+ minute tutoring sessions on ElevenLabs Agents with zero infra-related drops, paid for entirely out of grant + free tiers.

### Phase 2 — Multi-track voice in beta (weeks 4–8)

**Goal:** add Gemini Live as a second voice mode (strategic alignment with Build with Gemini XPRIZE) and gather data on which mode users actually prefer for math.

- [ ] Wire up Gemini Live Flash as a "Fluent mode" toggle.
- [ ] A/B test "Standard mode" (ElevenLabs Agents, cascade pipeline) vs "Fluent mode" (Gemini Live, S2S) on a small cohort.
- [ ] Log: completion rate, perceived comprehension, % of session in interruption mode, average session length.
- [ ] Begin collecting "real user, real revenue" evidence for the XPRIZE submission.

### Phase 3 — LiveKit migration *only if needed* (post-beta, post-PMF)

**Trigger conditions** for moving off ElevenLabs Agents to LiveKit (don't move pre-emptively):

- Hitting concurrency ceilings on the ElevenLabs Scale tier (30 concurrent calls is plenty until we have ≥500 active users).
- Needing region-pinned deployments (HIPAA/FERPA institutional customers).
- Needing turn-detection or VAD tuning ElevenLabs doesn't expose.
- Per-minute economics flipping unfavorably (ElevenLabs $0.08/min vs ~$0.05/min self-orchestrated).

**Until then, LiveKit is a fallback we *prototype* but don't migrate to.** A weekend project, not a quarter project.

### Phase 4 — Scale-readiness (post-monetization)

**Goal:** stop being one bad cloud day from a 100% outage.

- [ ] Provider fallback ladder: ElevenLabs Flash → Cartesia Sonic → Deepgram Aura, automatic on 5xx.
- [ ] STT fallback: Deepgram nova-3 → Google STT Chirp.
- [ ] LLM fallback: Claude Haiku → GPT-4o-mini → Gemini 2.5 Flash.
- [ ] Per-user / per-org rate limits.
- [ ] Cost telemetry per session so we know our true unit economics before pricing.

---

## 4a. The "broke founder" runway math

Everything below is free, requires no credit card, and stacks for a Nigerian solo founder with no VC:

| Source | What you get | Realistic Mathlon usage |
|---|---|---|
| **LiveKit Cloud Build** | 1,000 agent minutes + 5,000 WebRTC minutes + 50 GB / month, forever | Kept as a fallback prototype environment |
| **Deepgram $200 signup** | ~26,000 streaming minutes at nova-3 | ~430 hours of STT |
| **Deepgram Startup Program** | Up to $100K credits over 12 months | Apply once we have ≥1 paying user as proof |
| **Anthropic $5 signup** | ~30–100 Mathlon sessions at Claude Haiku 4.5 | Bridge until grants land |
| **ElevenLabs Free tier** | 10K credits + 15 Conversational AI minutes / month | Fallback if grant doesn't land |
| **ElevenLabs Startup Grant** | 33M characters + Scale-tier Agents (~3,600 min / month) for 12 months | **Primary voice infra** |
| **Build with Gemini XPRIZE registration** | $100 AI Ultra + $300 GCP credits | Gemini Live experiments |
| **Google for Startups Start** | $2K–$20K Cloud credits, no VC required | Future Postgres / Cloud Run hosting |
| **Vapi default** | 100 free minutes/month | Kept active as comparison baseline only |

**Bottom line:** even in the worst case where the ElevenLabs grant is rejected and no startup program credits land, Mathlon can run on **free tiers alone** for the next 3+ months at a beta scale of 10–20 active testers. That is enough runway to either get the grant approved or get the first paying customer.

---

## 4b. Should you cold email Vapi's CEO (Jordan Dearsley)?

Honest answer: **don't lead with this. It's a side bet, not a strategy.**

**Why it probably won't pay off as direct credits:**
- Vapi's official Startup Program page reads *"APPLICATIONS ON HOLD"*. Their published qualification bar is "$250K+ in funding". That's not a personal decision Jordan made — it's their current go-to-market.
- Vapi just raised a $50M Series B; their focus is enterprise telephony, not subsidising educational solo founders.
- Vapi already operates in Nigeria (one of their 6 listed countries) so they've seen Nigerian developers. They are not under-exposed to the market.
- Even with a yes, Vapi's architecture is structurally wrong for long-form tutoring with a shared canvas. Credits would buy time on the wrong train.

**Why it's still worth doing as a side bet:**
- Jordan is a Canadian founder who himself burnt out, pivoted multiple times, lived in an SF Airbnb for three months hoping for product-market fit. The kind of person who, on the right day, replies to a well-crafted message from a fellow founder.
- Cost: one hour of writing.
- Asymmetric upside.

**How to do it right:**
- **Do not ask for credits in the first email.** That's the email he ignores.
- Ask for *20 minutes of his time* to share what you're learning at the edge of Vapi's platform. Frame yourself as the rarest type of user he has: someone building education on Vapi.
- Lead with the technical depth (call ID, the `exceeded-max-duration` finding, the client-tool result-loop issue) — that signals you're a serious technical builder, not a credit beggar.
- *If* he replies and you get on a call, *that* is when you ask whether Vapi has any flexibility — phrased as: *"I'd love to keep testing on Vapi to validate the limits I'm finding. Is there any way to extend my free tier while I do that?"* — and let him say yes or no without making it the point of the conversation.

**Best alternative people to cold-email** (in order of likely value):
1. **ElevenLabs founders Mati Staniszewski & Piotr Dabkowski.** ElevenLabs is actively trying to land Conversational AI customers. A Nigerian solo founder building a math tutor is *exactly* the case study they want for their startup grant marketing. Higher reply probability than Vapi.
2. **Deepgram dev rel.** Their startup program is the gold standard and they actively promote it. Even if your application is in the queue, dev rel can fast-track it.
3. **LiveKit founders Russ d'Sa & David Zhao.** They love education use cases (the LiveKit-powered ChatGPT Voice product is a frequent point of pride). Worth a Twitter/Linkedin DM if/when you get to Phase 3.

**Send order, this week:**
1. ElevenLabs Startup Grant application — formal, via the application portal.
2. Deepgram Startup Program application — formal.
3. Google for Startups Start tier application — formal.
4. Build with Gemini XPRIZE registration — gets you the $400 in credits instantly.
5. Cold email to Jordan @ Vapi — informal, 20-min ask, technical, no credits ask.
6. Twitter DM to Mati @ ElevenLabs — informal, "we're applying for the grant, here's what we're building, would love your eyes on it."

---

## 5. Funding paths (in order of fit)

### 1. Build with Gemini XPRIZE — **strongly recommended for the team**

- **Prize pool:** $2M total. Education & Human Potential category: **$50K dedicated**. Grand prize $500K.
- **Deadline:** August 17, 2026. Build window is 90 days from May 19, 2026.
- **Hard requirements that match us:**
  - "Education & Human Potential" is literally a named category. Personalized tutoring for underserved students is in the official examples.
  - Must use at least one Google Cloud / Gemini product. **This is why introducing Gemini Live as a second voice path matters strategically** — not because we need to abandon ElevenLabs, but because it grounds our submission.
  - Must show **real users and real revenue** during the 90 days. Projections don't count.
- **Side perk:** all registrants get **$100 in AI Ultra credits + $300 Google Cloud credits** just for signing up.
- **What we need to do:**
  - Register the team now.
  - Ship the Gemini Live toggle in Phase 2 (above).
  - Onboard ≥10 paying customers — even at $5/month = $50/mo recurring is "real revenue" for judging.
  - Keep agent execution logs (LiveKit gives us these natively) for the "AI in production" criterion.

### 2. ElevenLabs Startup Grant

- **12 months free, 33M character credits.**
- We already use ElevenLabs (via Vapi) — moving to direct billing post-LiveKit migration aligns perfectly.
- No credit card, no equity, no obligation. Apply now even if we stay on Vapi for Phase 0.

### 3. Google for Startups Cloud Program (AI-first track)

- **Up to $350K** in Google Cloud credits + $10K Model Garden + $12K enhanced support.
- Eligible: under 5 years old, AI-native, ≤ Series A.
- This is the credit ladder we should be on once we have early traction (Phase 1 onwards) — it directly funds Gemini Live + LiveKit Cloud + Postgres + everything else.
- This is also the credit pool the LinkedIn post you were sent likely points to. (LinkedIn URLs don't fetch reliably — but Google for Startups, ElevenLabs Grant, and the XPRIZE registration credits are the three names that consistently appear in these "free credits for AI startups" lists.)

### 4. Vapi credits — confirmed paused

You noted Vapi's giveaway is on hold. That tracks with what we're seeing in their community channels. They are funding their own growth, not subsidizing competitors.

### 5. What NOT to chase

- **$300 Google Cloud Free Trial:** explicitly cannot be applied to Gemini API or AI Studio since March 2026.
- **OpenAI startup credits:** worth applying, but their TTS quality lags ElevenLabs/Cartesia for educational warmth.

---

## 6. B2B possibilities

### 6.1 Architecture-driven B2B (selling the *pipes*)

The thing that makes Mathlon's voice work for long-form pedagogy — not generic Q&A, not telephony — is the **canvas-coupled tool layer** sitting on top of LiveKit. That's not unique to math. It's a generalizable platform.

**B2B opportunity 1 — "Mathlon Pedagogy Layer" as an embeddable SDK:**

- Sell the canvas + tool-orchestration layer to other ed-tech companies that want to add a voice tutor without rebuilding the WebRTC + LLM + canvas integration.
- Pricing: $0.06–0.10/min on top of their underlying provider cost (the same way Vapi charges, but for a focused vertical they can't get from Vapi).
- Target: medium-sized ed-tech (Quizlet-tier, Coursera-tier internal teams) who have content but no voice expertise.

**B2B opportunity 2 — "Long-form voice agent platform":**

- Generalize "Mathlon for math" into "long-form synchronous voice agents that share a canvas with the user."
- Use cases beyond tutoring: legal consultations with annotated documents, therapy with shared mood-tracking surfaces, music theory lessons with shared staff notation, language learning with shared text.
- This is a *real gap in the market.* Vapi, Retell, Bland all assume short calls. LiveKit gives you the building blocks but not the pedagogical patterns.

**B2B opportunity 3 — White-label tutor for textbook publishers:**

- Pearson, Cengage, McGraw-Hill, OpenStax all have content libraries and zero voice product.
- Mathlon becomes the voice that brings their static PDFs to life. They keep the brand; we provide the agent.
- Revenue model: per-seat (per-student-per-month) license.

### 6.2 Academic institution B2B

This is where Mathlon has a structural advantage almost no Vapi competitor has: **we are pedagogy-shaped, not call-shaped.**

**Universities and community colleges — high-volume tutoring augmentation:**

- Most US universities run "tutoring centers" with student staff. They are chronically understaffed for math, especially calculus, statistics, and discrete math.
- A Mathlon institutional license replaces or augments tutoring hours during off-peak times (evenings, weekends, finals week).
- Pricing model: **per-FTE-student-per-year**, e.g. $5–15/student/year, billed to the university. A 20,000-student university at $10 = $200K/year ARR.
- Hooks: integrates with Canvas, Blackboard, Moodle via LTI 1.3.
- Differentiator over Khanmigo / Pearson AI: Mathlon shows its work on a canvas, voice-first. Khanmigo is text-chat-shaped.

**K–12 districts:**

- Slower sales cycle (RFPs, procurement) but bigger ACVs.
- Title I funding can be steered to ed-tech that demonstrates math outcomes. The XPRIZE submission + revenue proof becomes our procurement pitch deck.
- Partner with state DOEs: Florida, Texas, California, Mississippi (the latter literally just won the national "Mississippi Miracle" math gains story — they'd be receptive).

**Test-prep & exam boards:**

- SAT/ACT/GMAT/GRE prep companies. Lower-volume, higher-ARPU than universities.
- Princeton Review, Kaplan, Magoosh all have content libraries crying out for synchronous voice tutoring.
- Easier to win than universities (no Canvas integration to fight with).

**International / underserved markets:**

- The XPRIZE Education category explicitly calls out **"personalized tutoring for underserved students"**.
- Once we have multilingual voice (LiveKit's Multilingual Turn Detector + Deepgram nova-3 multi + ElevenLabs multilingual), we can ship to Nigerian / Indian / Indonesian / LatAm markets at a price point Western tutoring services can't touch.
- This is also the most defensible story for the XPRIZE judges and for any subsequent fundraise.

**Online learning platforms (B2B2C):**

- Coursera, edX, Udemy, Brilliant — all sell math content, none offer a synchronous voice tutor.
- We become the "voice layer" they bolt onto their course library.

### 6.3 Defensibility — what stops someone from copying us

Three moats stack here, in increasing order of strength:

1. **Pedagogy-tuned prompts and canvas tools.** Easy to copy individually, hard to do at the level of polish that makes a tutor feel like a tutor and not a chatbot.
2. **Curriculum graph.** As we instrument sessions (which steps confuse which students for which topics), we accumulate a curriculum-level dataset nobody else has. This is the durable moat.
3. **Brand + outcomes.** "My GPA went up using Mathlon" is the moat that beats every cheaper clone. The XPRIZE outcome — *real revenue with real students* — is the seed of this story.

---

## 7. The 12-month north star

By June 2027 we should be able to say:

- We orchestrate our own voice stack on LiveKit (no third-party dependency on Vapi).
- We offer two voice modes: **Studied** (cascade, tool-rich, long sessions) and **Fluent** (Gemini Live, lower latency, casual recall).
- We have ≥3 paying institutional customers (universities or districts) at >$50K ACV each.
- We have ≥1,000 individual paying users at $10–20/month.
- We are either a Build-with-Gemini XPRIZE category winner ($50K) or top-5 finisher ($100K–$500K).
- We are on Google for Startups AI-first ($250K Year 1 credits) and ElevenLabs Startup Grant (12 months free).
- We have a published whitepaper on "Synchronous AI Tutoring Outcomes" using our own session telemetry — the basis for academic partnerships and future Series A.

---

## 8. The 11-week sprint — June 1 to August 17, 2026

XPRIZE submission deadline is August 17. Today is June 1. We have **77 days**. The plan below ships you to a paying-user state by end-of-June and a submission-ready state by mid-August.

| Week | Dates | Ship | Goal |
|---|---|---|---|
| **1** | Jun 1–7 | Submit ElevenLabs grant TODAY. Migrate to ElevenLabs Agents using free tier (15 min/mo) in parallel. Apply to Deepgram Startup Program. Register for Build with Gemini XPRIZE. | Migration code complete; demo working. |
| **2** | Jun 8–14 | Grant decision arrives mid-week (most likely yes). Onboard yourself + 3 friend-and-family beta testers. Polish landing page and pricing page. | First end-to-end sessions on the new stack. |
| **3** | Jun 15–21 | Open beta to 10–15 testers (university students, your network, Twitter). Gather session telemetry. Fix rough edges. | 50+ recorded sessions of usage data. |
| **4** | Jun 22–28 | Launch early-access paid tier at **$5–10/month**. Lifetime deal for first 20 customers ($50 one-time) to seed cash flow + commitment. Post on Indie Hackers, Nigerian tech Twitter, relevant subreddits. | **First paying users by end of June.** |
| **5** | Jun 29–Jul 5 | Iterate on feedback. Add subject coverage (statistics, calculus). Push to 20 paying users. | $100–200 MRR. |
| **6–8** | Jul 6–26 | Growth focus: content marketing, student testimonials, demo videos. University-specific outreach (Lagos, Ibadan, OAU, UI in Nigeria; also community college outreach in US/UK). | 50+ paying users. |
| **9** | Jul 27–Aug 2 | Begin XPRIZE submission prep: session logs, revenue exports, customer testimonials, "AI in production" evidence. | Submission draft complete. |
| **10–11** | Aug 3–16 | Finalize and polish XPRIZE submission. 3-minute video. Written narrative. Revenue evidence (Stripe export). Footer logo for ElevenLabs Grant compliance. | **Submit Aug 17.** |

### Today (Monday, June 1) — 4 form submissions, ~45 minutes total

1. **ElevenLabs Startup Grant** at `https://elevenlabs.io/startup-grants` — highest priority single action. Frame: "voice-first AI tutor for adult math learners (university students, exam prep, career re-skillers)." Use business email. Avoid the word "kids" or "K-12".
2. **Build with Gemini XPRIZE registration** at `https://xprize.devpost.com/` — instant $100 AI Ultra + $300 Google Cloud credits.
3. **Deepgram signup** at `https://deepgram.com/` — instant $200 credit. Then submit the Startup Program application from inside your dashboard ($100K credits, no VC needed).
4. **Anthropic Console signup** at `https://console.anthropic.com` — claim the $5 sign-on credit. Needed regardless of grant outcome (Claude is our LLM).

### Days 2–5 — start migration in parallel

Do not wait for the grant decision. Begin the ElevenLabs Agents migration immediately using the 15-min/month free tier — that is enough to validate the integration works end-to-end before scaling.

### Side bets (any time this week, lowest priority)

- **Apply for Google for Startups Start tier** ($2K–$20K Cloud credits, no VC required).
- **Cold email Jordan Dearsley @ Vapi** — short, technical, asking for 20 minutes of his time only, *not* credits.
- **Twitter/LinkedIn DM Mati Staniszewski @ ElevenLabs** — short note that you've applied for the grant + 30-sec demo link. Increases application visibility.

Skip the "fix Vapi" step from the original plan. There are no credits to fix Vapi with, and Vapi was never the right home anyway.

---

## Appendix — log evidence

For posterity, the lines below are quoted verbatim from `call-logs-2026-05-28T03-31-35-614Z.json`:

- **Call ended at exactly 10 minutes** — line 266258, `endedReason: "exceeded-max-duration"`, `durationMs: 600001`, `maxDurationSeconds: 600`.
- **Stack discovery** — lines 24, 88, 191, 16829: ElevenLabs `eleven_turbo_v2_5`, Deepgram `nova-3`, Anthropic `claude-haiku-4-5-20251001`, transport `daily`.
- **27 tool-call errors**, all identical: `error: "No result returned. If this is unexpected, see https://docs.vapi.ai/tools/custom-tools-troubleshooting#no-result-returned-error"`.
- **70+ `call.driftDetected`** events across the session — audio clock drift, not fatal but degrading.
- **Krisp noise suppression** runs inside the Daily.co WebRTC worker; the `system overload` error you saw in the Next overlay surfaced from there, not from our app.
