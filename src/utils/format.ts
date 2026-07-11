export class TelegramFormattedText {
  constructor(public readonly raw: string) {}
  toString(): string {
    return this.raw;
  }
}

type TextPart = string | TelegramFormattedText;

function isFragment(part: TextPart): part is TelegramFormattedText {
  return part instanceof TelegramFormattedText;
}

function joinParts(parts: TextPart[], escape: (text: string) => string): string {
  return parts.map((part) => (isFragment(part) ? part.raw : escape(part))).join('');
}

const MARKDOWN_V2_RESERVED = /[_*[\]()~`>#+\-=|{}.!\\]/g;
const MARKDOWN_V2_CODE_RESERVED = /[`\\]/g;
const MARKDOWN_V2_LINK_URL_RESERVED = /[)\\]/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_RESERVED, (ch) => `\\${ch}`);
}

export function escapeMarkdownV2Code(text: string): string {
  return text.replace(MARKDOWN_V2_CODE_RESERVED, (ch) => `\\${ch}`);
}

export function escapeMarkdownV2LinkUrl(url: string): string {
  return url.replace(MARKDOWN_V2_LINK_URL_RESERVED, (ch) => `\\${ch}`);
}

function createMarkdownV2Formatter() {
  const wrap = (raw: string) => new TelegramFormattedText(raw);
  const t = (parts: TextPart[]) => joinParts(parts, escapeMarkdownV2);

  return {
    escape: escapeMarkdownV2,
    escapeCode: escapeMarkdownV2Code,
    escapeLinkUrl: escapeMarkdownV2LinkUrl,
    text: (...parts: TextPart[]) => wrap(t(parts)),
    bold: (...parts: TextPart[]) => wrap(`*${t(parts)}*`),
    italic: (...parts: TextPart[]) => wrap(`_${t(parts)}_`),
    underline: (...parts: TextPart[]) => wrap(`__${t(parts)}__`),
    strikethrough: (...parts: TextPart[]) => wrap(`~${t(parts)}~`),
    spoiler: (...parts: TextPart[]) => wrap(`||${t(parts)}||`),
    code: (text: string) => wrap(`\`${escapeMarkdownV2Code(text)}\``),
    pre: (text: string, language?: string) =>
      wrap(`\`\`\`${language ?? ''}\n${escapeMarkdownV2Code(text)}\n\`\`\``),
    link: (url: string, ...parts: TextPart[]) => wrap(`[${t(parts)}](${escapeMarkdownV2LinkUrl(url)})`),
    mentionUser: (userId: number, ...parts: TextPart[]) => wrap(`[${t(parts)}](tg://user?id=${userId})`),
    customEmoji: (emojiId: string, fallbackEmoji: string) =>
      wrap(`![${escapeMarkdownV2(fallbackEmoji)}](tg://emoji?id=${emojiId})`),
    raw: (raw: string) => wrap(raw),
  };
}

export function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeHTMLAttribute(text: string): string {
  return escapeHTML(text).replace(/"/g, '&quot;');
}

function createHtmlFormatter() {
  const wrap = (raw: string) => new TelegramFormattedText(raw);
  const t = (parts: TextPart[]) => joinParts(parts, escapeHTML);

  return {
    escape: escapeHTML,
    escapeAttribute: escapeHTMLAttribute,
    text: (...parts: TextPart[]) => wrap(t(parts)),
    bold: (...parts: TextPart[]) => wrap(`<b>${t(parts)}</b>`),
    italic: (...parts: TextPart[]) => wrap(`<i>${t(parts)}</i>`),
    underline: (...parts: TextPart[]) => wrap(`<u>${t(parts)}</u>`),
    strikethrough: (...parts: TextPart[]) => wrap(`<s>${t(parts)}</s>`),
    spoiler: (...parts: TextPart[]) => wrap(`<tg-spoiler>${t(parts)}</tg-spoiler>`),
    code: (text: string) => wrap(`<code>${escapeHTML(text)}</code>`),
    pre: (text: string, language?: string) =>
      wrap(
        language
          ? `<pre><code class="language-${escapeHTMLAttribute(language)}">${escapeHTML(text)}</code></pre>`
          : `<pre>${escapeHTML(text)}</pre>`
      ),
    link: (url: string, ...parts: TextPart[]) => wrap(`<a href="${escapeHTMLAttribute(url)}">${t(parts)}</a>`),
    mentionUser: (userId: number, ...parts: TextPart[]) =>
      wrap(`<a href="tg://user?id=${userId}">${t(parts)}</a>`),
    blockquote: (...parts: TextPart[]) => wrap(`<blockquote>${t(parts)}</blockquote>`),
    expandableBlockquote: (...parts: TextPart[]) => wrap(`<blockquote expandable>${t(parts)}</blockquote>`),
    customEmoji: (emojiId: string, fallbackEmoji: string) =>
      wrap(`<tg-emoji emoji-id="${escapeHTMLAttribute(emojiId)}">${escapeHTML(fallbackEmoji)}</tg-emoji>`),
    raw: (rawHtml: string) => wrap(rawHtml),
  };
}

export const md = createMarkdownV2Formatter();
export const html = createHtmlFormatter();

export const TELEGRAM_TEXT_LIMITS = {
  MESSAGE: 4096,
  CAPTION: 1024,
  BUTTON_TEXT: 64,
  CALLBACK_DATA: 64,
  START_PARAMETER: 64,
  BOT_DESCRIPTION: 512,
  BOT_SHORT_DESCRIPTION: 120,
  CHAT_TITLE: 128,
  POLL_QUESTION: 300,
  POLL_OPTION: 100,
} as const;

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

export function truncateText(text: string, maxLength: number, ellipsis = '…'): string {
  if (text.length <= maxLength) return text;
  let cut = Math.max(0, maxLength - ellipsis.length);
  if (cut > 0 && isHighSurrogate(text.charCodeAt(cut - 1)) && isLowSurrogate(text.charCodeAt(cut))) {
    cut -= 1;
  }
  return text.slice(0, cut) + ellipsis;
}
