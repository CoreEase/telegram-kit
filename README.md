# telegram-kit

A complete toolkit for building on top of Telegram: Mini Apps SDK (React hooks + a provider), a Bot API client for the server, a zero-dependency `.tgs`/Lottie sticker player, a standards-compliant QR code encoder, and small utilities for Markdown/HTML formatting, deep links, and keyboards.

It's framework-agnostic where it can be — plain JS, Node, or a `<script>` tag all work — and gives you React bindings where that actually helps (Mini Apps hooks, the sticker player, the QR component).

## Why this exists

Telegram Mini Apps and Bot API projects usually end up gluing together the same handful of things: reading `window.Telegram.WebApp`, validating `initData` on the server, building inline keyboards by hand, escaping MarkdownV2, and so on. `telegram-kit` bundles all of that behind a typed, documented API so you don't have to rebuild it for every project.

## Installation

```bash
npm install telegram-kit
```

React is an optional peer dependency — you only need it if you use the hooks, the provider, or the sticker/QR components. Everything else (bot client, QR encoding, formatting, links, server-side validation) works in plain Node or the browser with no React involved.

## Package structure

The source is organized by what the code *does*, not by which npm subpath exports it:

```
src/
  core/      Telegram WebApp runtime access, CDN script loader, dev/mock mode,
             and server-side initData verification
  react/     Hooks and the TelegramProvider for React-based Mini Apps
  ui/        QR code generation/rendering and the Lottie/TGS sticker players
  utils/     MarkdownV2/HTML formatting, deep links, inline & reply keyboards
  bot/       The Bot API client, update dispatcher, and long-polling helper
  types/     Shared TypeScript types for the WebApp and the Bot API
  _internal/ Implementation details (QR encoding math, the Lottie rendering
             engine, gzip inflate, HMAC verification, etc.) — not part of the
             public API and can change without notice
```

None of this affects how you import the package — see the sections below for that. It's just how the codebase itself is laid out, in case you're browsing the source or opening a PR.

## Quick start — Mini App (React)

Wrap your app once:

```tsx
import { TelegramProvider, useTelegram } from 'telegram-kit';

function App() {
  return (
    <TelegramProvider options={{ autoExpand: true }}>
      <Home />
    </TelegramProvider>
  );
}

function Home() {
  const { user, colorScheme, inTelegram } = useTelegram();

  if (!inTelegram) return <p>Open this from a Telegram chat.</p>;

  return <p>Hey {user?.first_name}, you're on {colorScheme} mode.</p>;
}
```

`TelegramProvider` calls `WebApp.ready()`, expands the window, reads the current user, and tracks the color scheme for you. `options` also accepts `onReady`, `onUserReady`, `loadingComponent`, `notInTelegramComponent`, `allowOutsideTelegram`, `autoDisableVerticalSwipes`, and `autoEnableClosingConfirmation`.

From there, the hooks cover most of the WebApp surface:

```tsx
import {
  useTelegramMainButton,
  useTelegramBackButton,
  useHapticFeedback,
  useShowConfirm,
  useCloudStorage,
} from 'telegram-kit';

function CheckoutButton() {
  const haptic = useHapticFeedback();
  const confirm = useShowConfirm();

  useTelegramMainButton({
    text: 'Confirm order',
    onClick: async () => {
      if (await confirm('Place this order?')) {
        haptic.notification('success');
      }
    },
  });

  return null;
}
```

There are around 40 hooks in total — main/back/settings buttons, cloud/device/secure storage, biometrics, accelerometer/gyroscope, viewport and safe-area, fullscreen, theme, clipboard, QR scanning, and more. They're all exported from the package root, so your editor's autocomplete is the fastest way to browse them.

## Core (no React required)

Everything the hooks are built on is also available directly, for vanilla JS, Vue, or anywhere else:

```ts
import { getWebApp, isInTelegram, haptic, cloudStorage, dialog } from 'telegram-kit';

if (isInTelegram()) {
  await dialog.showConfirm('Continue?');
  await cloudStorage.setItem('draft', JSON.stringify(formState));
  haptic.impact('medium');
}
```

This module also has `openTelegramLink`, `openInvoice`, `shareToStory`, `requestContact`, `scanQr`, `downloadFile`, `getUserDisplayName`, `getUserAvatarUrl`, and the rest of the WebApp surface as plain functions.

## Bot API (server-side)

```ts
import { TelegramBot, Dispatcher, TelegramPoller } from 'telegram-kit/bot';

const bot = new TelegramBot({ token: process.env.BOT_TOKEN! });

const dispatcher = new Dispatcher()
  .onCommand('start', (msg) => bot.sendMessage({ chat_id: msg.chat.id, text: 'Welcome!' }))
  .onMessage((msg) => bot.sendMessage({ chat_id: msg.chat.id, text: `You said: ${msg.text}` }));

const poller = new TelegramPoller(
  (params) => bot.getUpdates(params),
  dispatcher.toHandler()
);

poller.start();
```

`TelegramBot` covers the Bot API methods (`sendMessage`, `sendPhoto`, `editMessageText`, `answerCallbackQuery`, `setWebhook`, and so on) with typed params and typed responses, and throws a `TelegramApiError` (with `errorCode` and `description`) when the API rejects a call. If you'd rather run a webhook than long polling, call `dispatcher.toHandler()(update)` from your HTTP handler instead of using `TelegramPoller`.

## Verifying `initData` on the server

Never trust `initData` on the client — always verify it server-side before treating it as an authenticated user:

```ts
import { validateInitData } from 'telegram-kit/server';

const result = await validateInitData(initDataFromClient, process.env.BOT_TOKEN!, {
  maxAgeSeconds: 3600,
});

if (!result.valid) {
  // result.reason: 'invalid_hash' | 'expired' | 'missing_hash' | 'malformed'
  throw new Error('Invalid Telegram session');
}

// result.user, result.startParam, result.authDate are ready to use
```

There's also a synchronous `validateInitDataSync` if you're not in an async context — same options, same result shape.

## QR codes

A zero-dependency ISO/IEC 18004 encoder plus a styled React component:

```tsx
import { QRCode, encodeQRCode, qrCodeToSVG } from 'telegram-kit/qr';

// as a component
<QRCode value="https://t.me/your_bot" size={256} dotColor="#111" logo="/logo.png" />

// or just get raw SVG / matrix data, no React needed
const svg = qrCodeToSVG('https://t.me/your_bot', { size: 512, color: '#000' });
const { modules } = encodeQRCode('https://t.me/your_bot', { errorCorrectionLevel: 'M' });
```

`QRCode` supports custom dot/corner shapes, a logo with automatic size clamping so it never breaks scannability, rounded corners, and a `downloadQRCode(svgRef.current, { format: 'png' | 'svg' })` helper for exporting it.

## Animated stickers (TGS / Lottie)

```tsx
import { TgsPlayer } from 'telegram-kit/tgs';

<TgsPlayer src="/stickers/wave.tgs" autoplay loop style={{ width: 128, height: 128 }} />
```

`TgsPlayer` validates that the file is actually a Telegram-compliant animated sticker (set `strict={false}` to skip that check). If you're rendering a plain Lottie JSON animation instead of a `.tgs` file, use `LottiePlayer` from `telegram-kit/lottie` — same props, no TGS validation. Both are also reachable from `telegram-kit/animation`.

## Formatting messages (MarkdownV2 / HTML)

Hand-escaping MarkdownV2 is a common source of bugs (it has more reserved characters than people expect). This builds the string for you instead:

```ts
import { md, html } from 'telegram-kit/format';

const text = md.text('Hello ', md.bold(user.first_name), '! Your order ', md.code(orderId), ' is ready.');
await bot.sendMessage({ chat_id, text: text.toString(), parse_mode: 'MarkdownV2' });
```

Both `md` and `html` support `bold`, `italic`, `underline`, `strikethrough`, `spoiler`, `code`, `pre`, `link`, `mentionUser`, and `customEmoji`; `html` additionally has `blockquote` and `expandableBlockquote`. Everything you pass in is escaped automatically unless it's already a formatted fragment, so nesting `md.bold(md.italic('x'))` works as expected. `TELEGRAM_TEXT_LIMITS` and `truncateText` are there for staying under Telegram's length limits (surrogate-pair-safe).

## Deep links

```ts
import { buildStartLink, buildStartAppLink, parseTelegramLink } from 'telegram-kit/links';

buildStartLink({ botUsername: 'your_bot', data: 'ref_42' });
// -> https://t.me/your_bot?start=cmVmXzQy

buildStartAppLink({ botUsername: 'your_bot', appName: 'shop', startParam: 'sku_123' });
// -> https://t.me/your_bot/shop?startapp=sku_123

parseTelegramLink('https://t.me/your_bot/shop?startapp=sku_123');
// -> { type: 'mini-app', username: 'your_bot', appName: 'shop', startParam: 'sku_123' }
```

`start`/`startapp` parameters only allow `A-Z a-z 0-9 _ -` and 64 characters max — pass `data` and it gets base64url-encoded for you; pass `startParam` directly if it's already a valid short slug.

## Keyboards

```ts
import { InlineKeyboardBuilder, ReplyKeyboardBuilder } from 'telegram-kit/keyboards';

const keyboard = new InlineKeyboardBuilder()
  .text('Yes', 'confirm:yes').text('No', 'confirm:no')
  .row()
  .url('Docs', 'https://example.com')
  .build();

await bot.sendMessage({ chat_id, text: 'Confirm?', reply_markup: keyboard });
```

`InlineKeyboardBuilder.columns(buttons, perRow)` is a shortcut for grid layouts. `removeKeyboard()` and `forceReply()` cover the remaining reply-markup types.

## Developing outside Telegram

`WebApp` doesn't exist outside a Telegram client, which makes local development painful. `installDevMode()` patches in a mock so `getWebApp()` and the hooks work in a regular browser tab:

```ts
import { installDevMode } from 'telegram-kit/dev';

if (process.env.NODE_ENV === 'development') {
  installDevMode({ user: { id: 1, first_name: 'Dev' } });
}
```

Don't ship this in production — gate it behind an environment check like above.

## Using it without a bundler

There's also a plain browser build that exposes everything under a `TelegramKit` global:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script src="https://unpkg.com/telegram-kit/dist/browser.global.js"></script>
<script>
  const { encodeQRCode, buildStartLink, isInTelegram } = TelegramKit;
</script>
```

This build includes core, QR, formatting, links, keyboards, dev mode, and the CDN loader — not the React-dependent pieces, since there's no React in a plain `<script>` context.

## TypeScript

Everything is written in TypeScript and ships its own `.d.ts` files — no `@types` package needed. The full Bot API type surface (`Message`, `Update`, `InlineKeyboardMarkup`, every `SendXParams` type, etc.) is exported from `telegram-kit/bot` and `telegram-kit` directly.

## License

MIT
