declare module 'katex' {
  export interface KatexOptions {
    throwOnError?: boolean;
    displayMode?: boolean;
    strict?: boolean | string | ((...args: unknown[]) => unknown);
    trust?: boolean | ((context: { command: string }) => boolean);
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    macros?: Record<string, string>;
  }

  export function renderToString(tex: string, options?: KatexOptions): string;
  export function render(
    tex: string,
    element: HTMLElement,
    options?: KatexOptions,
  ): void;

  const katex: {
    renderToString: typeof renderToString;
    render: typeof render;
    version?: string;
  };
  export default katex;
}

declare module 'katex/dist/katex.min.css';
