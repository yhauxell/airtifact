import { Marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export interface DocNavItem {
  title: string;
  filePath: string;
  routePath: string;
  section?: string;
}

export interface RenderedMarkdownDocument {
  title: string;
  description?: string;
  frontmatter: Record<string, string>;
  html: string;
  toc: TocHeading[];
}

/**
 * Generates a URL-safe slug from heading text
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section';
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parses YAML-like frontmatter at the top of a Markdown file if present
 */
export function parseFrontmatter(rawMarkdown: string): {
  frontmatter: Record<string, string>;
  content: string;
} {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, content: normalized };
  }

  const endIdx = normalized.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { frontmatter: {}, content: normalized };
  }

  const yamlBlock = normalized.slice(4, endIdx);
  const content = normalized.slice(endIdx + 5);
  const frontmatter: Record<string, string> = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) {
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, content };
}

/**
 * Pre-processes LaTeX math blocks ($$...$$ and $...$) outside of code blocks
 * and replaces them with placeholders that get restored after Marked parsing.
 */
function extractAndRenderMath(markdown: string): {
  processedMarkdown: string;
  restoreMath: (html: string) => string;
} {
  const mathPlaceholders: { placeholder: string; rendered: string }[] = [];
  let counter = 0;

  // First protect fenced code blocks and inline code so we don't parse $ inside code
  const codePlaceholders: { placeholder: string; raw: string }[] = [];
  let codeCounter = 0;

  let text = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (match) => {
    const placeholder = `@@CODE_BLOCK_${codeCounter++}@@`;
    codePlaceholders.push({ placeholder, raw: match });
    return placeholder;
  });

  text = text.replace(/`[^`\n]+`/g, (match) => {
    const placeholder = `@@INLINE_CODE_${codeCounter++}@@`;
    codePlaceholders.push({ placeholder, raw: match });
    return placeholder;
  });

  // Render display math: $$ ... $$ or \[ ... \]
  text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_match, expr1, expr2) => {
    const expr = (expr1 ?? expr2 ?? '').trim();
    if (!expr) return _match;
    const placeholder = `@@MATH_DISPLAY_${counter++}@@`;
    try {
      const rendered = `<div class="markdown-math-block my-4 overflow-x-auto py-2">${katex.renderToString(expr, {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml',
      })}</div>`;
      mathPlaceholders.push({ placeholder, rendered });
      return placeholder;
    } catch {
      return _match;
    }
  });

  // Render inline math: $ ... $ or \( ... \)
  text = text.replace(
    /(?:^|(?<=[\s([{"']))\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$(?=$|[\s.,!?;:)\]}"'])|\\\(([\s\S]+?)\\\)/g,
    (_match, expr1, expr2) => {
      const expr = (expr1 ?? expr2 ?? '').trim();
      if (!expr) return _match;
      // Avoid matching currency like $100
      if (/^\d+([.,]\d+)?$/.test(expr)) {
        return _match;
      }
      const placeholder = `@@MATH_INLINE_${counter++}@@`;
      try {
        const rendered = `<span class="markdown-math-inline">${katex.renderToString(expr, {
          displayMode: false,
          throwOnError: false,
          output: 'htmlAndMathml',
        })}</span>`;
        mathPlaceholders.push({ placeholder, rendered });
        return placeholder;
      } catch {
        return _match;
      }
    }
  );

  // Restore code blocks before Marked runs
  for (let i = codePlaceholders.length - 1; i >= 0; i--) {
    const { placeholder, raw } = codePlaceholders[i];
    text = text.replace(placeholder, () => raw);
  }

  return {
    processedMarkdown: text,
    restoreMath: (html: string) => {
      let result = html;
      for (const { placeholder, rendered } of mathPlaceholders) {
        result = result.replace(`<p>${placeholder}</p>`, () => rendered);
        result = result.replace(placeholder, () => rendered);
      }
      return result;
    },
  };
}

/**
 * Resolves a relative link inside a markdown document to a project route or asset URL
 */
export function resolveMarkdownHref(
  href: string,
  projectId: string,
  currentDocFilePath: string,
  allFiles: string[]
): string {
  if (!href) return href;
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#')
  ) {
    return href;
  }

  // Separate hash/query
  const hashIdx = href.indexOf('#');
  const hash = hashIdx !== -1 ? href.slice(hashIdx) : '';
  const pathPart = hashIdx !== -1 ? href.slice(0, hashIdx) : href;

  if (!pathPart) return href;

  // Compute relative path from currentDocFilePath directory
  const currentDirSegments = currentDocFilePath.split('/').slice(0, -1);
  const rawSegments = pathPart.startsWith('/')
    ? pathPart.replace(/^\/+/, '').split('/')
    : [...currentDirSegments, ...pathPart.split('/')];

  const resolvedSegments: string[] = [];
  for (const seg of rawSegments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      resolvedSegments.pop();
    } else {
      resolvedSegments.push(seg);
    }
  }

  const targetPath = resolvedSegments.join('/');

  // Check if target is a markdown file or matches a markdown file in the project
  const isMd =
    targetPath.toLowerCase().endsWith('.md') ||
    targetPath.toLowerCase().endsWith('.markdown') ||
    allFiles.some(
      (f) =>
        f.toLowerCase() === `${targetPath.toLowerCase()}.md` ||
        f.toLowerCase() === `${targetPath.toLowerCase()}/index.md` ||
        f.toLowerCase() === `${targetPath.toLowerCase()}/readme.md`
    );

  if (isMd) {
    const cleanRoute = filePathToRoutePath(targetPath);
    const routeSuffix = cleanRoute ? `/${cleanRoute}` : '';
    return `/${projectId}${routeSuffix}${hash}`;
  }

  // Check if it's a static asset in the project
  const matchingAsset = allFiles.find((f) => f.toLowerCase() === targetPath.toLowerCase());
  if (matchingAsset) {
    return `/api/projects/${projectId}/${matchingAsset}${hash}`;
  }

  return `/${projectId}/${targetPath}${hash}`;
}

/**
 * Resolves an image src inside a markdown document to the project asset endpoint
 */
export function resolveMarkdownImageSrc(
  src: string,
  projectId: string,
  currentDocFilePath: string
): string {
  if (!src) return src;
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('/api/projects/')
  ) {
    return src;
  }

  const currentDirSegments = currentDocFilePath.split('/').slice(0, -1);
  const rawSegments = src.startsWith('/')
    ? src.replace(/^\/+/, '').split('/')
    : [...currentDirSegments, ...src.split('/')];

  const resolvedSegments: string[] = [];
  for (const seg of rawSegments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      resolvedSegments.pop();
    } else {
      resolvedSegments.push(seg);
    }
  }

  return `/api/projects/${projectId}/${resolvedSegments.join('/')}`;
}

/**
 * Converts a markdown file path (e.g. "docs/getting-started.md" or "README.md")
 * into a clean route path relative to /[projectId].
 */
export function filePathToRoutePath(filePath: string): string {
  let clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  clean = clean.replace(/\.(md|markdown)$/i, '');

  if (clean.toLowerCase() === 'index' || clean.toLowerCase() === 'readme') {
    return '';
  }

  if (clean.toLowerCase().endsWith('/index')) {
    clean = clean.slice(0, -'/index'.length);
  } else if (clean.toLowerCase().endsWith('/readme')) {
    clean = clean.slice(0, -'/readme'.length);
  }

  return clean;
}

/**
 * Renders Markdown string into rich HTML with:
 * - GitHub Flavored Markdown (GFM)
 * - GitHub-style alerts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
 * - Syntax-highlighted code blocks (highlight.js) + copy button metadata
 * - KaTeX math expressions (inline & block)
 * - Mermaid diagram blocks
 * - Extracted Table of Contents (TOC) with anchor IDs
 */
export function renderMarkdownDocument(
  rawMarkdown: string,
  options?: {
    projectId?: string;
    currentFilePath?: string;
    allFiles?: string[];
    fallbackTitle?: string;
  }
): RenderedMarkdownDocument {
  const { frontmatter, content } = parseFrontmatter(rawMarkdown);
  const { processedMarkdown, restoreMath } = extractAndRenderMath(content);

  const toc: TocHeading[] = [];
  const slugCounts = new Map<string, number>();
  let firstH1Title: string | null = null;

  const markedInstance = new Marked({
    gfm: true,
    breaks: false,
  });

  markedInstance.use({
    renderer: {
      heading({ tokens, depth }) {
        const rawHtml = this.parser.parseInline(tokens);
        const plainText = rawHtml.replace(/<[^>]*>/g, '').trim();

        if (depth === 1 && !firstH1Title) {
          firstH1Title = plainText;
        }

        const baseSlug = slugifyHeading(plainText);
        const count = slugCounts.get(baseSlug) ?? 0;
        slugCounts.set(baseSlug, count + 1);
        const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

        if (depth >= 1 && depth <= 4) {
          toc.push({ id, text: plainText, level: depth });
        }

        return `<h${depth} id="${id}" class="markdown-heading group scroll-mt-20">
      <a href="#${id}" class="heading-anchor" aria-label="Link to ${escapeHtml(plainText)}">#</a>
      ${rawHtml}
    </h${depth}>\n`;
      },

      code({ text, lang }) {
        const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();

        if (language === 'mermaid') {
          const encoded = Buffer.from(text, 'utf-8').toString('base64');
          return `<div class="mermaid-wrapper my-6 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div class="mermaid-diagram flex justify-center overflow-x-auto" data-mermaid="${encoded}">
          <pre class="mermaid text-xs font-mono text-muted-foreground">${escapeHtml(text)}</pre>
        </div>
      </div>\n`;
        }

        if (language === 'math' || language === 'latex' || language === 'katex') {
          try {
            const renderedMath = katex.renderToString(text.trim(), {
              displayMode: true,
              throwOnError: false,
              output: 'htmlAndMathml',
            });
            return `<div class="markdown-math-block my-4 overflow-x-auto py-2">${renderedMath}</div>\n`;
          } catch {
            // Fallback to code block
          }
        }

        let highlighted = '';
        let validLang = language;
        try {
          if (language && hljs.getLanguage(language)) {
            highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
          } else {
            const auto = hljs.highlightAuto(text);
            highlighted = auto.value;
            if (!validLang && auto.language) {
              validLang = auto.language;
            }
          }
        } catch {
          highlighted = escapeHtml(text);
        }

        const displayLang = validLang || 'text';
        const encodedRaw = Buffer.from(text, 'utf-8').toString('base64');

        return `<div class="code-block-wrapper my-5 overflow-hidden rounded-xl border border-border bg-zinc-950 text-zinc-100 shadow-xs">
      <div class="code-block-header flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-400">
        <span class="font-mono uppercase tracking-wider text-[11px] text-zinc-400">${escapeHtml(displayLang)}</span>
        <button type="button" class="copy-code-btn inline-flex items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-800/70 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white" data-code="${encodedRaw}" aria-label="Copy code to clipboard">
          <span class="copy-label">Copy</span>
        </button>
      </div>
      <pre class="overflow-x-auto p-4 text-sm leading-relaxed font-mono"><code class="hljs language-${escapeHtml(displayLang)}">${highlighted}</code></pre>
    </div>\n`;
      },

      blockquote({ tokens }) {
        const innerHtml = this.parser.parse(tokens);

        // Support GitHub-style alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
        const alertMatch = innerHtml.match(
          /^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br\s*\/?>|\n|\s)?([\s\S]*)$/i
        );
        if (alertMatch) {
          const alertType = alertMatch[1].toUpperCase();
          const restContent = `<p>${alertMatch[2]}`;
          const alertMeta: Record<string, { label: string; className: string; icon: string }> = {
            NOTE: {
              label: 'Note',
              className: 'border-blue-500/40 bg-blue-500/5 text-foreground',
              icon: 'ℹ️',
            },
            TIP: {
              label: 'Tip',
              className: 'border-emerald-500/40 bg-emerald-500/5 text-foreground',
              icon: '💡',
            },
            IMPORTANT: {
              label: 'Important',
              className: 'border-purple-500/40 bg-purple-500/5 text-foreground',
              icon: '❗',
            },
            WARNING: {
              label: 'Warning',
              className: 'border-amber-500/40 bg-amber-500/5 text-foreground',
              icon: '⚠️',
            },
            CAUTION: {
              label: 'Caution',
              className: 'border-red-500/40 bg-red-500/5 text-foreground',
              icon: '🚨',
            },
          };
          const meta = alertMeta[alertType] || alertMeta.NOTE;
          return `<div class="markdown-alert my-4 rounded-xl border-l-4 p-4 ${meta.className}" role="note">
        <div class="mb-1.5 flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true">${meta.icon}</span>
          <span>${meta.label}</span>
        </div>
        <div class="markdown-alert-body text-sm leading-relaxed">${restContent}</div>
      </div>\n`;
        }

        return `<blockquote class="markdown-blockquote my-4 border-l-4 border-border pl-4 italic text-muted-foreground">${innerHtml}</blockquote>\n`;
      },

      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const resolvedHref =
          options?.projectId && options?.currentFilePath
            ? resolveMarkdownHref(
                href,
                options.projectId,
                options.currentFilePath,
                options.allFiles || []
              )
            : href;
        const isExternal =
          resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://');
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${escapeHtml(resolvedHref)}"${titleAttr}${externalAttrs}>${text}</a>`;
      },

      image({ href, title, text }) {
        const resolvedSrc =
          options?.projectId && options?.currentFilePath
            ? resolveMarkdownImageSrc(href, options.projectId, options.currentFilePath)
            : href;
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(resolvedSrc)}" alt="${escapeHtml(text || '')}"${titleAttr} class="my-4 max-w-full rounded-lg border border-border" loading="lazy" />`;
      },
    },
  });

  const rawRendered = markedInstance.parse(processedMarkdown) as string;
  const html = restoreMath(rawRendered);

  const title =
    frontmatter.title ||
    firstH1Title ||
    options?.fallbackTitle ||
    (options?.currentFilePath ? formatDocTitleFromPath(options.currentFilePath) : 'Document');

  return {
    title,
    description: frontmatter.description,
    frontmatter,
    html,
    toc,
  };
}

/**
 * Formats a human-readable title from a markdown file path
 */
export function formatDocTitleFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  const withoutExt = fileName.replace(/\.(md|markdown)$/i, '');
  if (withoutExt.toLowerCase() === 'index' || withoutExt.toLowerCase() === 'readme') {
    const parentSegments = filePath.split('/').slice(0, -1);
    if (parentSegments.length > 0) {
      const parent = parentSegments[parentSegments.length - 1];
      return parent
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Overview';
  }
  return withoutExt
    .replace(/^\d+[-_]/, '') // strip numeric ordering prefix like 01-intro
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves which Markdown file in `files` matches a requested route path array
 * (e.g. `[]` -> `index.md` or `README.md` or first `.md` file;
 *  `['docs', 'getting-started']` -> `docs/getting-started.md` or `getting-started.md` when all docs share a common `docs/` prefix)
 */
export function resolveMarkdownFileForRoute(
  files: string[],
  routeSegments: string[]
): string | null {
  const mdFiles = files.filter((f) => /\.(md|markdown)$/i.test(f));
  if (mdFiles.length === 0) return null;

  const requestedRoute = routeSegments
    .join('/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.(md|markdown)$/i, '');

  // Root route []
  if (!requestedRoute) {
    const preferredOrder = [
      'index.md',
      'readme.md',
      'index.markdown',
      'readme.markdown',
      'docs/index.md',
      'docs/readme.md',
    ];
    for (const candidate of preferredOrder) {
      const match = mdFiles.find((f) => f.toLowerCase() === candidate);
      if (match) return match;
    }
    // Check if there's any top-level .md file
    const topLevel = mdFiles.filter((f) => !f.includes('/'));
    if (topLevel.length > 0) {
      return topLevel.sort()[0];
    }
    return mdFiles.sort()[0];
  }

  const reqLower = requestedRoute.toLowerCase();

  // Direct match against filePathToRoutePath
  for (const file of mdFiles) {
    if (filePathToRoutePath(file).toLowerCase() === reqLower) {
      return file;
    }
  }

  // Exact filename match (e.g. if route included .md or matched without extension)
  for (const file of mdFiles) {
    const noExt = file.replace(/\.(md|markdown)$/i, '').toLowerCase();
    if (noExt === reqLower) {
      return file;
    }
  }

  // Also support stripped `docs/` prefix (e.g. file is `docs/getting-started.md` and user visits `/getting-started`)
  for (const file of mdFiles) {
    const cleanRoute = filePathToRoutePath(file).toLowerCase();
    if (cleanRoute === `docs/${reqLower}`) {
      return file;
    }
  }

  return null;
}

/**
 * Builds an ordered list of navigation items for all Markdown files in a project
 */
export function buildDocsetNavigation(
  files: string[],
  titlesByFile?: Record<string, string>
): DocNavItem[] {
  const mdFiles = files
    .filter((f) => /\.(md|markdown)$/i.test(f))
    .sort((a, b) => {
      const routeA = filePathToRoutePath(a);
      const routeB = filePathToRoutePath(b);
      if (routeA === '') return -1;
      if (routeB === '') return 1;
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

  return mdFiles.map((filePath) => {
    const routePath = filePathToRoutePath(filePath);
    const segments = filePath.split('/');
    const section =
      segments.length > 1
        ? segments
            .slice(0, -1)
            .join(' / ')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined;

    return {
      title: titlesByFile?.[filePath] || formatDocTitleFromPath(filePath),
      filePath,
      routePath,
      section,
    };
  });
}
