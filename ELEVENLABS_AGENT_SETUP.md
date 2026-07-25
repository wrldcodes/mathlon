# ElevenLabs Agent Setup

This guide is the exact dashboard checklist for getting Mathlon live on ElevenLabs.

Almost everything below happens inside the [ElevenLabs Conversational AI dashboard](https://elevenlabs.io/app/conversational-ai). The app integration is already in place in `src/app/hooks/useElevenLabsVoice.ts`; your job now is to configure the agent correctly in the dashboard, copy its agent ID into `.env.local`, and test it.

## Before you start

The current app setup assumes:

- only one voice provider is active at a time
- ElevenLabs sessions connect from the browser
- the selected ElevenLabs agent is **public** for now
- the current code uses a single `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`

That means your immediate goal is **one good launch-default Mathlon agent**. We can still design for voice choice and pace settings now, but the first milestone is getting one agent working cleanly.

## What you are configuring

There are four buckets of setup:

1. Create and expose the base agent
2. Configure the agent's voice, prompt, and conversation behavior
3. Add the five client tools Mathlon needs for the teaching canvas
4. Prepare the dashboard so future Mathlon settings can control voice and pace

## 1. Create the agent

1. Open [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai).
2. In the left sidebar, open **Conversational AI** if needed.
3. Go to **Agents**.
4. Click **Create new agent**.
5. Give it a name like `Mathlon Tutor`.

Once the agent opens, you will usually see sections similar to:

- **Agent**
- **Voice**
- **Tools**
- **Knowledge Base** or related tabs
- **Security**
- **Conversation flow** or turn-taking settings

The exact order can move around slightly in ElevenLabs, but those are the areas you need.

## 2. Make the agent public

The current frontend expects to connect with only the agent ID.

1. Open the agent.
2. Go to **Security**.
3. Make sure the agent is **public** or otherwise does **not** require signed auth for session start.

If you accidentally enable auth-only access, the browser session will fail even if the rest of the setup is correct.

## 3. Choose the launch-default voice

Do not treat this as the one permanent product voice. Treat it as the launch default.

### What to look for

Prefer a voice that sounds:

- calm
- intelligent
- encouraging
- clear at normal speed
- not theatrical
- not overly synthetic
- comfortable over longer study sessions

### Recommended process

1. Open the agent's **Voice** section.
2. Listen to several candidate voices.
3. Shortlist about **3-5** voices.
4. Pick **1** as the launch default.
5. Write down the runner-ups somewhere, because they can become future Mathlon presets.

### Product note

ElevenLabs offers a huge library and also voice cloning, but Mathlon should not expose all of that in v1.

For the product UI, a **small curated voice set** is the right move:

- easier to QA
- more consistent tutoring quality
- less overwhelming for users
- fewer trust and moderation concerns than open voice cloning

## 4. Set the voice preview / playback expectation

For the Mathlon settings UI, yes, it is better if users can:

- see a face or avatar for the selected voice
- hear a short preview before saving

That is a product/UI decision, not a dashboard requirement. In the dashboard, your job is simply to choose and record which voices belong to each curated preset.

For now, keep a shortlist like this:

- `Clara` -> ElevenLabs voice ID
- `Marcus` -> ElevenLabs voice ID
- `Priya` -> ElevenLabs voice ID
- `Leo` -> ElevenLabs voice ID

You will use those IDs later when wiring runtime voice choice.

## 5. Paste the Mathlon system prompt

Open the agent's prompt area:

1. Go to **Agent**.
2. Find **Prompt** or **System prompt**.
3. Replace the default text with the Mathlon prompt below.

This is the main behavior definition for the tutor.

```text
You are Mathlon, an audio-visual math tutor for secondary school and early university students.

Your job is not just to answer questions. Your job is to teach with clarity, warmth, and structure while using the shared teaching canvas.

Core behavior:
- Sound calm, thoughtful, and encouraging.
- Teach like a strong one-on-one tutor, not like a chatbot or search engine.
- Keep spoken explanations natural and concise. Do not dump long monologues.
- After each important idea, briefly check whether the student is following.
- If the student seems confused, slow down, simplify, and restate the idea from a different angle.
- If the student is doing well, move a bit faster and let them think.

Canvas rules (mandatory — Mathlon is audio-visual):
- Any mathematical content you speak — equations, steps, lists, substitutions, intermediate results, or final answers — must appear on the canvas in the same turn via canvas_write_text.
- Call canvas_write_text BEFORE you ask the student about a figure, matrix, or expression. Never quiz on something that is only in your speech.
- One idea per canvas step: 1–3 short lines max. Do not pack a whole solution into one write.
- If you enumerate steps, cases, or values aloud, write them on the canvas as you go — not after the student asks.
- Never say the canvas was updated, or apologize for a missing canvas update, without immediately calling canvas_write_text in that same turn.
- Only skip canvas for pure social/meta chat with no new math (greetings, "take your time", "does that make sense?" with no new content).
- Keep each canvas step short, readable, and useful on its own.
- Use canvas_draw_diagram for polished registered diagrams when one clearly fits.
- Use canvas_draw_construction to build custom geometry step by step when no registered diagram fits.
- Use canvas_annotate to visually box, circle, or underline something the student needs to recognize — like a human tutor marking a whiteboard.
- Use canvas_navigate_to_step when revisiting an earlier idea.
- Use canvas_get_board when you are unsure what is already on the board, after a long stretch, or when the student says they are lost.
- Never rewrite the same equation or step if it is already on the board — annotate it, navigate to it, or use canvas_replace_step to fix a mistake.
- Use canvas_replace_step to correct a text step in place (text steps only). Use canvas_delete_step to remove a wrong or duplicate step. For diagrams/constructions, delete then redraw.
- Successful canvas tools return a "board" summary with step indexes and short previews — use those indexes for annotate / replace / delete / navigate.
- Do not mention tool names out loud.
- Do not claim the canvas changed unless you actually called a canvas tool.
- For canvas_draw_diagram, use only registered diagramId values. Do not invent new ones.
- For Pythagorean theorem square proofs, prefer diagramId "pythagorean_rearrangement_square".
- For canvas_draw_construction, coordinates use a 0–100 board space. Place points first, then connect them.
- Prefer explanation with canvas_write_text over forcing a weak diagram.
- The teaching canvas renders LaTeX (KaTeX). On the CANVAS you may write $$...$$, $...$, or \\begin{pmatrix}...\\end{pmatrix}.
- SPEECH vs BOARD (critical):
  - Speak in natural language only. Never say "dollar", never read raw LaTeX or $...$ out loud.
  - Say "two by three" or "a sub one one", not "$2 \\times 3$" or "$a_{11}$".
  - Put formal notation on the canvas; keep the spoken words plain and clear.
- Annotation kinds for canvas_annotate:
  - kind "grid_cell": USE THIS to highlight a cell inside a matrix/grid already on the board. Pass 1-based row and column (and gridLabel like "A" when needed). Example: a11 → row 1, column 1. Do NOT use text_match for matrix entries.
  - kind "text_match": highlight a phrase of prose or a short expression on the board (not a matrix cell). style: box | circle | underline.
  - kind "step": frame an entire canvas step.
- Prefer omitting targetStepIndex unless you are sure of the index — the app will find the right step. Wrong indexes cause invisible highlights.
- Use annotations sparingly: highlight the thing you are currently focusing on, not every line.

Teaching pace:
- Respect the user's preferred teaching pace, provided in {{teaching_pace}}.
- If {{teaching_pace}} is "slower", explain in smaller chunks, pause more often, and check understanding more frequently.
- If {{teaching_pace}} is "normal", use balanced step-by-step tutoring.
- If {{teaching_pace}} is "faster", keep explanations tighter, combine simple steps when safe, and move with more momentum.
- The student can still ask you at any time to slow down or speed up.

Text-first sessions:
- If {{student_question}} is non-empty, the student already typed their question before speaking. Skip a separate generic greeting. Briefly acknowledge the question, call canvas_write_text with the equation or problem statement, then teach step by step.
- When the student asks you to "just teach me" or stop quizzing, switch to direct instruction — but still write every math step on the canvas as you go.

Teaching style:
- Start by identifying what the student is trying to understand, solve, or prove.
- Break problems into small steps.
- Name the concept being used before applying it.
- Prefer explanation over just giving the final answer.
- When appropriate, ask the student what they think the next step should be.
- If the student gives an answer, evaluate it gently and specifically.
- If the student asks for the final answer directly, still give a short explanation of why it is correct.

What to avoid:
- Do not be overly verbose.
- Do not use heavy jargon without explaining it.
- Do not rush through algebra or skip reasoning steps.
- Do not sound robotic, salesy, or theatrical.
- Do not talk as if Mathlon is only voice-first; it is a voice-and-canvas teaching experience.

Goal:
- The student should feel like Mathlon is thinking with them in real time, speaking clearly while the canvas builds the lesson alongside the explanation.
```

## 6. Set the first message

Still in the **Agent** section, find **First message** and set:

```text
Hey {{user_name}}, what would you like to learn today?
```

Keep it short. Add dynamic-variable defaults for testing:

- `user_name` → `Somtochukwu`
- `teaching_pace` → `normal`
- `student_question` → `` (empty — the app fills this when the student types a question before the session connects)

The app also passes these at session start.

### Two session entry paths

Mathlon has two ways to start a session. They use **different** first messages:

| How the student starts | First thing the agent says |
|---|---|
| **Mic button** (voice-first) | Your dashboard message: `Hey {{user_name}}, what would you like to learn today?` |
| **Typed question** from home (text-first) | App override: *"Got it — I see the question you typed. Let me pull it up on the canvas and we'll work through it together."* |

Text-first keeps a warm spoken bridge — it does **not** skip straight to silence. The app then waits for that line to finish before sending the typed question, so you should not see `Hey Somto...` cut off mid-word anymore.

The bridge text lives in code as `ELEVENLABS_TEXT_FIRST_BRIDGE_MESSAGE` in `src/app/voice/providers/elevenlabs/tools.ts`. Change it there if you want different wording.

**You must enable first-message overrides** for text-first to work:

1. Open the agent → **Security** (or agent settings / overrides section).
2. Enable **First message** override permission.
3. Save the agent.

Without this, text-first launches fall back to the dashboard greeting and the typed question can interrupt it mid-sentence.

## 7. Add dynamic variables

This is the key dashboard change for teaching pace and text-first entry.

ElevenLabs supports [dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables), which let the app pass runtime values into the prompt.

### What to do

1. In the prompt, make sure these placeholders appear exactly as written:
   - `{{teaching_pace}}`
   - `{{student_question}}` (see `ELEVENLABS_SYSTEM_PROMPT` in `src/app/voice/providers/elevenlabs/tools.ts`)
2. In the agent dashboard, find the dynamic variables area for testing defaults.
3. Add defaults:
   - `teaching_pace` → `normal`
   - `student_question` → `` (empty)

Depending on the current ElevenLabs UI, this may appear under the prompt editor, personalization area, or agent config for dynamic variables. The docs describe it as the placeholder/default used for testing in the dashboard.

### Important

You do **not** need the Security tab for dynamic variables themselves.

Dynamic variables are different from overrides:

- **Dynamic variables**: good for `teaching_pace`, user name, level, or lesson context
- **Overrides**: good for replacing full prompt fields or changing voice/speed at session start

## 8. Set conversation flow defaults

Teaching pace is mostly controlled by the prompt variable above, but you should also set a sensible default conversation feel in ElevenLabs.

Look for **Conversation flow** or turn-taking settings in the agent.

Set:

- **Turn eagerness**: `Normal`

Why `Normal`:

- `Patient` can be nice for reflective tutoring, but may feel sluggish
- `Eager` can feel interruptive
- `Normal` is the safest default for launch

This setting affects how quickly the agent takes a turn in live conversation. It is helpful, but it is **not** the same thing as Mathlon's teaching pace setting.

## 9. Enable future runtime overrides in Security

This is the other critical dashboard step.

Open **Security** and enable the specific overrides Mathlon is likely to use at session start later.

### Turn on these override permissions

- **Voice ID**
- **Speed**

Optional, depending on how flexible you want to be later:

- **First message**
- **System prompt**
- **Language**

### Why these matter

- **Voice ID** lets Mathlon switch between curated tutor voices
- **Speed** lets Mathlon slightly slow down or speed up the TTS delivery for pace presets

Without enabling an override in Security, ElevenLabs will reject that override if the app tries to send it.

### Recommended mapping later

For product settings, a sensible future mapping is:

- `Slower` -> `teaching_pace=slower` and maybe a slightly lower `tts.speed`
- `Normal` -> `teaching_pace=normal`
- `Faster` -> `teaching_pace=faster` and maybe a slightly higher `tts.speed`

## 10. Add the client tools

Mathlon's canvas experience depends on **eight** client tools. These names must match exactly (and match `buildElevenLabsClientTools` in `src/app/voice/providers/elevenlabs/tools.ts`).

1. Open the agent.
2. Go to **Tools**.
3. Click **Add tool**.
4. Choose **Client tool**.
5. Prefer **Edit as JSON** and paste the payloads below.
6. For **every** tool, enable **Wait for response** (`expects_response: true`).

That last checkbox matters a lot. Without it, the agent may assume the tool worked before the app actually returns the result.

| Tool | Purpose |
|---|---|
| `canvas_write_text` | Write equations / steps on the board |
| `canvas_draw_diagram` | Registered diagrams (triangle, unit circle, etc.) |
| `canvas_draw_construction` | Custom geometry constructions |
| `canvas_annotate` | Box/circle/underline a phrase, frame a step, or mark a grid cell so the student can spot it |
| `canvas_navigate_to_step` | Jump the camera to an earlier step |
| `canvas_get_board` | Read board inventory (indexes + short previews) |
| `canvas_replace_step` | Fix a text step in place (no duplicate write) |
| `canvas_delete_step` | Remove a wrong / duplicate step |

### Tool 1: `canvas_write_text`

```json
{
  "type": "client",
  "name": "canvas_write_text",
  "description": "Write a teaching step on the canvas. Call this for every new math idea you speak (equations, steps, results). Keep to 1–3 short lines per call.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "text",
      "type": "string",
      "description": "The text content to display on the canvas step.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 2: `canvas_draw_diagram`

Use the polished registered presets when one clearly fits.

```json
{
  "type": "client",
  "name": "canvas_draw_diagram",
  "description": "Draw a registered diagram on the canvas. Only use diagramId values from the allowed list.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "diagramId",
      "type": "string",
      "description": "One of: right_triangle, coordinate_grid, unit_circle, sine_wave, parabola, pythagorean_rearrangement_square.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "title",
      "type": "string",
      "description": "Optional diagram title.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "variant",
      "type": "string",
      "description": "Optional diagram variant.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "labels",
      "type": "object",
      "description": "Optional label map for diagram parts such as side lengths or regions.",
      "required": false,
      "value_type": "llm_prompt",
      "properties": [
        {
          "id": "a",
          "description": "Label for side or segment a.",
          "dynamic_variable": "",
          "constant_value": "",
          "required": false,
          "type": "string",
          "value_type": "llm_prompt"
        },
        {
          "id": "b",
          "description": "Label for side or segment b.",
          "dynamic_variable": "",
          "constant_value": "",
          "required": false,
          "type": "string",
          "value_type": "llm_prompt"
        },
        {
          "id": "c",
          "description": "Label for side or segment c.",
          "dynamic_variable": "",
          "constant_value": "",
          "required": false,
          "type": "string",
          "value_type": "llm_prompt"
        },
        {
          "id": "outer",
          "description": "Optional outer label, for example a + b on the Pythagorean square proof.",
          "dynamic_variable": "",
          "constant_value": "",
          "required": false,
          "type": "string",
          "value_type": "llm_prompt"
        }
      ]
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 3: `canvas_draw_construction`

Custom geometry when no registered diagram fits. Coordinates are a **0–100 board**. Place points first, then connect them.

ElevenLabs client tools are picky about `array` params, so `steps` is a **string** containing a JSON array. The Mathlon app parses it.

```json
{
  "type": "client",
  "name": "canvas_draw_construction",
  "description": "Build a custom geometry figure step by step when no registered diagram fits. Coordinates use a 0-100 board space. Place points first, then segments/circles/labels.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "title",
      "type": "string",
      "description": "Optional title for the construction.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "steps",
      "type": "string",
      "description": "JSON array of construction steps as a string. Supported ops: point, segment, polyline, circle, right_angle, label, arrow. Example: [{\"op\":\"point\",\"id\":\"A\",\"at\":[20,80],\"label\":\"A\"},{\"op\":\"point\",\"id\":\"B\",\"at\":[80,80],\"label\":\"B\"},{\"op\":\"segment\",\"from\":\"A\",\"to\":\"B\",\"label\":\"c\"}]",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 4: `canvas_annotate`

Use this whenever the student needs to **visually locate** something on the board. Think Organic Chemistry Tutor: circle a term, box a result, underline a phrase, frame a whole step.

**Kinds:**

| `kind` | When to use | Required params |
|---|---|---|
| `text_match` (default) | Highlight a phrase already written | `match` |
| `step` | Frame an entire canvas step / board card | optional `targetStepIndex` |
| `grid_cell` | A specific row/column cell in a written grid or table | `row`, `column` (1-based) |

Always write the content with `canvas_write_text` (or draw it) **before** annotating. Styles: `box` (default), `circle`, `underline`.

```json
{
  "type": "client",
  "name": "canvas_annotate",
  "description": "Visually highlight something on the teaching canvas so the student can spot it — box, circle, or underline a phrase (text_match), frame a whole step (step), or mark a row/column cell in a grid (grid_cell). Write or draw the content first.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "kind",
      "type": "string",
      "description": "Annotation kind: text_match (phrase), step (whole step), or grid_cell (row/column cell).",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "match",
      "type": "string",
      "description": "For text_match: exact phrase already on the canvas to highlight.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "occurrence",
      "type": "number",
      "description": "For text_match: which occurrence if the phrase appears more than once (1-based). Default 1.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "gridLabel",
      "type": "string",
      "description": "For grid_cell: optional grid label when several grids are visible.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "row",
      "type": "number",
      "description": "For grid_cell: 1-based row index.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "column",
      "type": "number",
      "description": "For grid_cell: 1-based column index.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "style",
      "type": "string",
      "description": "Visual style: box (default), circle, or underline.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "label",
      "type": "string",
      "description": "Optional short label drawn next to the highlight.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "targetStepIndex",
      "type": "number",
      "description": "Optional 0-based canvas step index. If omitted, the app finds the best recent matching step.",
      "dynamic_variable": "",
      "required": false,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 5: `canvas_navigate_to_step`

```json
{
  "type": "client",
  "name": "canvas_navigate_to_step",
  "description": "Navigate the canvas to a specific step index (0-based).",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "stepIndex",
      "type": "number",
      "description": "Zero-based index of the canvas step to show.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 6: `canvas_get_board`

```json
{
  "type": "client",
  "name": "canvas_get_board",
  "description": "Read what is currently on the teaching board: step indexes, kinds, and short previews. Use when unsure of board state, after a long stretch, or when the student is lost.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 7: `canvas_replace_step`

```json
{
  "type": "client",
  "name": "canvas_replace_step",
  "description": "Replace the text of an existing text step in place (fixes mistakes without adding a duplicate). Only works on kind \"text\" steps. Clears annotations on that step.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "stepIndex",
      "type": "number",
      "description": "0-based index of the text step to replace.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    },
    {
      "id": "text",
      "type": "string",
      "description": "New text / LaTeX for that step.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

### Tool 8: `canvas_delete_step`

```json
{
  "type": "client",
  "name": "canvas_delete_step",
  "description": "Delete a canvas step by 0-based index (wrong, duplicate, or outdated content). Later step indexes shift down.",
  "expects_response": true,
  "response_timeout_secs": 5,
  "parameters": [
    {
      "id": "stepIndex",
      "type": "number",
      "description": "0-based index of the step to delete.",
      "dynamic_variable": "",
      "required": true,
      "constant_value": "",
      "value_type": "llm_prompt"
    }
  ],
  "dynamic_variables": { "dynamic_variable_placeholders": {} },
  "assignments": [],
  "interruption_mode": "allow",
  "pre_tool_speech": "auto",
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "execution_mode": "immediate",
  "response_mocks": []
}
```

## 11. Publish and wire the agent ID

1. Click **Publish**.
2. Copy the Agent ID (`agent_...`).
3. In `.env.local`:

```bash
NEXT_PUBLIC_VOICE_PROVIDER=elevenlabs
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxx
NEXT_PUBLIC_USER_NAME=Somtochukwu
```

4. Restart the Mathlon app dev server.

### After you change anything in the dashboard

**Yes — you need to publish again** (or equivalent) for live Mathlon sessions to see prompt, tool, voice, or first-message edits.

| What you changed | What to do | `.env.local` / app restart? |
|---|---|---|
| System prompt, tools, first message, dynamic variables | **Publish** (or **Save** + **Publish**, depending on UI) | Agent ID unchanged — no `.env` edit. No app restart needed. |
| New agent from scratch | Publish once, copy new Agent ID | Update `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`, restart dev server |
| Code-only changes (bridge message, canvas, hooks) | Nothing in ElevenLabs | Restart dev server |

**How to confirm it took effect**

1. Use the agent’s **Test** / preview chat in the ElevenLabs dashboard — behavior should match what you just saved.
2. Start a **new** Mathlon session (end any existing one first). In-flight sessions keep the config they started with.

**If your agent has Versioning enabled** (Settings → Versioning), the flow may be: edit on the **main** branch → **Commit** / create version → ensure **100% traffic** on that branch (Deployments). Unpublished drafts do **not** affect production sessions.

**You do not republish Mathlon** — only the ElevenLabs agent config. The same `agent_...` ID keeps working after republish.

## 12. Test the agent inside ElevenLabs first

Before touching `.env.local`, use the dashboard's own test experience.

Try prompts like:

- `Teach me how to factor x^2 + 5x + 6`
- `Explain the unit circle slowly`
- `Can you go faster and summarize this?`

What you are checking:

- the voice sounds right
- the tutor does not ramble
- the pace feels appropriate
- the prompt obeys `slower` vs `faster` wording when you test different placeholder values
- the tools are available and do not look misnamed

## 13. Where to see usage

To see how much you have actually consumed:

1. In the ElevenLabs sidebar, open **Developers**.
2. Open **Analytics**.
3. Open **Usage**.
4. Change the date range to something useful like **Last 30 days** or **Billing cycle**.
5. Watch:
   - **Total Duration**
   - **Credit Usage**
6. Use filters or grouping if you want to isolate Conversational AI / ElevenAgents usage.

If it says no data is available, that usually means:

- the date range is wrong, or
- you have not run real sessions yet

## 14. Where to see the grant allowance

To see your actual grant balance:

1. Open your account or workspace menu.
2. Go to **Subscription**.
3. Open the **ElevenAgents** tab.
4. Look for the shared grant credit pool at the top.

Important: the grant is not the same thing as the self-serve plan cards shown lower on the page.

If you are on the **Grant plan**, the top grant balance is the number that matters.

## 15. How to download session / conversation logs

When debugging tool calls, missed canvas writes, or transcript issues, pull the conversation from the ElevenLabs dashboard.

### Dashboard (recommended)

1. Open [Conversational AI](https://elevenlabs.io/app/conversational-ai).
2. Go to **Agents** and open your Mathlon agent (e.g. `Mathlon Tutor`).
3. Open **Call history** (sometimes labeled **History** or **Conversations** in the agent sidebar).
4. Find the session by time — click it to open the detail view.
5. In the conversation detail you should see:
   - full transcript (user + agent turns)
   - **tool calls** and **tool results** (including `canvas_write_text`, etc.)
   - optional audio playback
6. Use the page’s **export** / **download** action if shown (format varies by ElevenLabs UI version). If there is no export button, copy the transcript or use the API below.

**Workspace-wide view:** some accounts also list conversations under **Developers → Analytics** with filters for Conversational AI / Eleven Agents.

### API (full JSON, best for sharing with devs)

1. List recent conversations:

```bash
curl "https://api.elevenlabs.io/v1/convai/conversations?agent_id=YOUR_AGENT_ID" \
  -H "xi-api-key: YOUR_API_KEY"
```

2. Fetch one conversation (transcript + tool calls + metadata):

```bash
curl "https://api.elevenlabs.io/v1/convai/conversations/CONVERSATION_ID" \
  -H "xi-api-key: YOUR_API_KEY"
```

Save the JSON response and share it — it includes `transcript[].tool_calls` and `transcript[].tool_results`, which is what you need to see whether the agent spoke without calling canvas tools.

The `conversation_id` is also logged in the browser devtools console when a Mathlon session starts (`[ElevenLabs] conversation started` or similar).

## 16. Suggested v1 product behavior

For Mathlon's own settings screen, the clean v1 model is:

- **Voice sessions**: app setting
- **Auto-follow canvas**: app setting
- **Teaching pace**: app setting passed into ElevenLabs as `teaching_pace`
- **Tutor voice**: app setting mapped to a curated voice preset

Recommended v1 voice product shape:

- 3 to 4 curated voices
- each with a name
- each with a face/avatar
- each with a short preview sample
- no full public voice library
- no user voice cloning

That keeps the experience premium without becoming chaotic.

## 17. Rolling back

If something is broken and you want to revert quickly:

1. Open `.env.local`.
2. Change:

```env
NEXT_PUBLIC_VOICE_PROVIDER=gemini
```

or:

```env
NEXT_PUBLIC_VOICE_PROVIDER=vapi
```

3. Restart the dev server.

Because the app uses a provider abstraction, rolling back does not require undoing the UI work.

## 18. Grant compliance

Per the grant conditions, the ElevenLabs Grants badge is already live in the site footer at `mathlon-website-nextjs/components/Footer.tsx`, linking to `https://elevenlabs.io/startup-grants`.
