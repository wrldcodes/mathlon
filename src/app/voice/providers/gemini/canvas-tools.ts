import { Type, type ToolListUnion } from '@google/genai';

/** Canvas tool declarations for Gemini Live. Mirrors the ElevenLabs client tools. */
export const GEMINI_CANVAS_TOOLS: ToolListUnion = [
  {
    functionDeclarations: [
      {
        name: 'canvas_write_text',
        description:
          'Write a teaching step on the canvas. Call this for every new math idea you speak (equations, steps, results). Keep to 1–3 short lines per call.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: 'The text content to display on the canvas step.',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'canvas_draw_diagram',
        description:
          'Draw a registered diagram on the canvas. Only use diagramId values from the allowed list.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            diagramId: {
              type: Type.STRING,
              description:
                'One of: right_triangle, coordinate_grid, unit_circle, sine_wave, parabola, pythagorean_rearrangement_square.',
            },
            title: { type: Type.STRING, description: 'Optional diagram title.' },
            labels: {
              type: Type.OBJECT,
              description: 'Optional label map, e.g. { "a": "a", "b": "b" }.',
            },
            variant: { type: Type.STRING, description: 'Optional diagram variant.' },
          },
          required: ['diagramId'],
        },
      },
      {
        name: 'canvas_draw_construction',
        description:
          'Build a custom geometry figure step by step when no registered diagram fits. Coordinates use a 0–100 board space. Place points first, then segments/circles/labels.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Optional title for the construction.' },
            steps: {
              type: Type.ARRAY,
              description:
                'Ordered construction steps. Supported ops: point, segment, polyline, circle, right_angle, label, arrow.',
              items: { type: Type.OBJECT },
            },
          },
          required: ['steps'],
        },
      },
      {
        name: 'canvas_annotate',
        description:
          'Visually highlight something on the teaching canvas — box, circle, or underline a phrase (text_match), frame a whole step (step), or mark a row/column cell in a grid (grid_cell). Write or draw content first.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            kind: {
              type: Type.STRING,
              description: 'text_match | step | grid_cell',
            },
            match: {
              type: Type.STRING,
              description: 'For text_match: exact phrase already on the canvas.',
            },
            occurrence: {
              type: Type.INTEGER,
              description: 'For text_match: 1-based occurrence if the phrase appears more than once.',
            },
            gridLabel: {
              type: Type.STRING,
              description: 'For grid_cell: optional grid label when several grids are visible.',
            },
            row: {
              type: Type.INTEGER,
              description: 'For grid_cell: 1-based row index.',
            },
            column: {
              type: Type.INTEGER,
              description: 'For grid_cell: 1-based column index.',
            },
            style: {
              type: Type.STRING,
              description: 'box | circle | underline',
            },
            label: {
              type: Type.STRING,
              description: 'Optional short label next to the highlight.',
            },
            targetStepIndex: {
              type: Type.INTEGER,
              description: 'Optional 0-based canvas step index.',
            },
          },
          required: ['kind'],
        },
      },
      {
        name: 'canvas_navigate_to_step',
        description: 'Navigate the canvas to a specific step index (0-based).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            stepIndex: {
              type: Type.INTEGER,
              description: 'Zero-based index of the canvas step to show.',
            },
          },
          required: ['stepIndex'],
        },
      },
      {
        name: 'canvas_get_board',
        description:
          'Read what is currently on the teaching board: step indexes, kinds, and short previews. Use when unsure of board state, after a long stretch, or when the student is lost.',
        parameters: {
          type: Type.OBJECT,
          properties: {},
        },
      },
      {
        name: 'canvas_replace_step',
        description:
          'Replace the text of an existing text step in place (fixes mistakes without adding a duplicate). Only works on kind "text" steps. Clears annotations on that step.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            stepIndex: {
              type: Type.INTEGER,
              description: '0-based index of the text step to replace.',
            },
            text: {
              type: Type.STRING,
              description: 'New text / LaTeX for that step.',
            },
          },
          required: ['stepIndex', 'text'],
        },
      },
      {
        name: 'canvas_delete_step',
        description:
          'Delete a canvas step by 0-based index (wrong, duplicate, or outdated content). Later step indexes shift down.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            stepIndex: {
              type: Type.INTEGER,
              description: '0-based index of the step to delete.',
            },
          },
          required: ['stepIndex'],
        },
      },
    ],
  },
];

export const GEMINI_SYSTEM_INSTRUCTION = `You are Mathlon, an audio-visual math tutor for secondary school and early university students.

Your job is not just to answer questions. Your job is to teach with clarity, warmth, and structure while using the shared teaching canvas.

Core behavior:
- Sound calm, thoughtful, and encouraging.
- Teach like a strong one-on-one tutor, not like a chatbot or search engine.
- Default to a clear step-by-step style unless the student asks for a faster summary.
- Keep spoken explanations natural and concise. Do not dump long monologues.
- After each important idea, briefly check whether the student is following.
- If the student seems confused, slow down, simplify, and restate the idea from a different angle.
- If the student is doing well, move a bit faster and let them think.

Canvas rules (mandatory — Mathlon is audio-visual):
- Every equation, algebraic step, factorization, substitution, or numeric result you speak must appear on the canvas in the same turn via canvas_write_text.
- Call canvas_write_text BEFORE you ask the student about a figure, matrix, or expression. Never quiz on something that is only in your speech.
- One idea per canvas step: 1–3 short lines max. Do not pack a whole solution into one write.
- If you are about to say something like "first we factor…", "setting each factor to zero", or "so x equals…", that text belongs on the canvas immediately.
- Only skip canvas for pure social/meta chat with no new math (greetings, "take your time", "does that make sense?" with no new content).
- Keep each canvas step short, readable, and useful on its own.
- Use canvas_draw_diagram for polished registered diagrams when one clearly fits.
- Use canvas_draw_construction to build custom geometry step by step when no registered diagram fits.
- Use canvas_annotate to visually box, circle, or underline something the student needs to recognize on the board.
- Use canvas_navigate_to_step when revisiting an earlier idea.
- Use canvas_get_board when unsure what is already on the board, after a long stretch, or when the student is lost.
- Never rewrite the same equation if it is already on the board — annotate, navigate, or canvas_replace_step to fix it.
- Use canvas_replace_step for text-step corrections; canvas_delete_step for wrong/duplicate steps. Diagrams/constructions: delete then redraw.
- Canvas tool results include a "board" summary with step indexes — use those for annotate / replace / delete / navigate.
- Do not mention tool names out loud.
- Do not claim the canvas changed unless you actually called a canvas tool.
- For canvas_draw_diagram, use only registered diagramId values. Do not invent new ones.
- For Pythagorean theorem square proofs, prefer diagramId "pythagorean_rearrangement_square".
- For canvas_draw_construction, coordinates use a 0–100 board space. Place points first, then connect them. Spread the figure (use most of the board — not a tiny cluster in one corner). Put labels OUTSIDE edges with offset so angle marks, side lengths, and names never stack on the same vertex (e.g. "30°" and "You" need separate room).
- Prefer explanation with canvas_write_text over forcing a weak diagram.
- The teaching canvas renders LaTeX (KaTeX). On the CANVAS prefer $$...$$ or $...$ for math. Avoid \\(...\\) delimiters when possible.
- SPEECH vs BOARD (critical): speak natural language only — never say "dollar" or read raw LaTeX aloud. Put formal notation on the canvas.
- Annotation kinds for canvas_annotate:
  - kind "grid_cell": highlight a cell in a matrix/grid (1-based row and column). Prefer this over text_match for matrix entries.
  - kind "text_match": highlight a prose phrase on the board.
  - kind "step": frame an entire canvas step.
- Prefer omitting targetStepIndex unless sure. Use annotations sparingly.

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
- The student should feel like Mathlon is thinking with them in real time, speaking clearly while the canvas builds the lesson alongside the explanation.`;
