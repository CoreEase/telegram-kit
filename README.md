# @core-ease/telegram-kit

A complete toolkit for building on top of Telegram: Mini Apps SDK (React hooks + a provider), a Bot API client for the server, a zero-dependency `.tgs`/Lottie sticker player, a standards-compliant QR code encoder, and small utilities for Markdown/HTML formatting, deep links, and keyboards.

It's framework-agnostic where it can be — plain JS, Node, or a `<script>` tag all work — and gives you React bindings where that actually helps (Mini Apps hooks, the sticker player, the QR component).

## Why this exists

Telegram Mini Apps and Bot API projects usually end up gluing together the same handful of things: reading `window.Telegram.WebApp`, validating `initData` on the server, building inline keyboards by hand, escaping MarkdownV2, and so on. `@core-ease/telegram-kit` bundles all of that behind a typed, documented API - with a real, working fallback for every feature when your Mini App is opened outside Telegram - so you don't have to rebuild it for every project.

## Installation

```bash
npm install @core-ease/telegram-kit
```

React is an optional peer dependency — you only need it if you use the hooks, the provider, or the sticker/QR components. Everything else (bot client, QR encoding, formatting, links, server-side validation) works in plain Node or the browser with no React involved.

## Package structure

The source is organized by what the code *does*, not by which npm subpath exports it:

```
src/
  sdk/       The full Mini Apps SDK: a faithful, modular TypeScript port of
             Telegram's official telegram-web-app.js (no CDN fetch, ever).
             Public entry: sdk/index.ts. Everything else lives under
             sdk/_internal/ (transport, kernel, theme, ui, features, sensors)
             and is an implementation detail - see sdk/README.md.
  core/      Telegram WebApp runtime access (getWebApp, haptics, storages,
             dialogs, location, biometrics, ...) - every function here gets
             the WebApp instance directly from ../sdk (never from
             window.Telegram) and has a real browser-native fallback for
             when the Mini App is opened outside Telegram. See
             core/fallback.ts for the fallback implementations and
             core/dev.ts for dev/local-testing mode.
  react/     Hooks and the TelegramProvider for React-based Mini Apps -
             every hook delegates to core/ rather than re-implementing
             its own copy of the same logic
  ui/        QR code generation/rendering and the Lottie/TGS sticker players
  utils/     MarkdownV2/HTML formatting, deep links, inline & reply keyboards
  bot/       The Bot API client, update dispatcher, and long-polling helper
  types/     Shared TypeScript types for the WebApp and the Bot API - the
             WebApp types are thin re-exports of the real ../sdk types
             instead of a hand-maintained parallel copy
  _internal/ Implementation details (QR encoding math, the Lottie rendering
             engine, gzip inflate, HMAC verification, etc.) — not part of the
             public API and can change without notice
```

None of this affects how you import the package — see the sections below for that. It's just how the codebase itself is laid out, in case you're browsing the source or opening a PR.

## Quick start — Mini App (React)

Wrap your app once:


```tsx
import { TelegramProvider, useTelegram } from '@core-ease/telegram-kit';

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
} from '@core-ease/telegram-kit';

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
import { getWebApp, isInTelegram, haptic, cloudStorage, dialog } from '@core-ease/telegram-kit';

if (isInTelegram()) {
  await dialog.showConfirm('Continue?');
  await cloudStorage.setItem('draft', JSON.stringify(formState));
  haptic.impact('medium');
}
```

This module also has `openTelegramLink`, `openInvoice`, `shareToStory`, `requestContact`, `scanQr`, `downloadFile`, `getUserDisplayName`, `getUserAvatarUrl`, and the rest of the WebApp surface as plain functions.

## Bot API (server-side)

```ts
import { TelegramBot, Dispatcher, TelegramPoller } from '@core-ease/telegram-kit/bot';

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
import { validateInitData } from '@core-ease/telegram-kit/server';

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
import { QRCode, encodeQRCode, qrCodeToSVG } from '@core-ease/telegram-kit/qr';

// as a component
<QRCode value="https://t.me/your_bot" size={256} dotColor="#111" logo="/logo.png" />

// or just get raw SVG / matrix data, no React needed
const svg = qrCodeToSVG('https://t.me/your_bot', { size: 512, color: '#000' });
const { modules } = encodeQRCode('https://t.me/your_bot', { errorCorrectionLevel: 'M' });
```

`QRCode` supports custom dot/corner shapes, a logo with automatic size clamping so it never breaks scannability, rounded corners, and a `downloadQRCode(svgRef.current, { format: 'png' | 'svg' })` helper for exporting it.

## Animated stickers (TGS / Lottie)

```tsx
import { TgsPlayer } from '@core-ease/telegram-kit/tgs';

<TgsPlayer src="/stickers/wave.tgs" autoplay loop style={{ width: 128, height: 128 }} />
```

`TgsPlayer` validates that the file is actually a Telegram-compliant animated sticker (set `strict={false}` to skip that check). If you're rendering a plain Lottie JSON animation instead of a `.tgs` file, use `LottiePlayer` from `@core-ease/telegram-kit/lottie` — same props, no TGS validation. Both are also reachable from `@core-ease/telegram-kit/animation`.

## Formatting messages (MarkdownV2 / HTML)

Hand-escaping MarkdownV2 is a common source of bugs (it has more reserved characters than people expect). This builds the string for you instead:

```ts
import { md, html } from '@core-ease/telegram-kit/format';

const text = md.text('Hello ', md.bold(user.first_name), '! Your order ', md.code(orderId), ' is ready.');
await bot.sendMessage({ chat_id, text: text.toString(), parse_mode: 'MarkdownV2' });
```

Both `md` and `html` support `bold`, `italic`, `underline`, `strikethrough`, `spoiler`, `code`, `pre`, `link`, `mentionUser`, and `customEmoji`; `html` additionally has `blockquote` and `expandableBlockquote`. Everything you pass in is escaped automatically unless it's already a formatted fragment, so nesting `md.bold(md.italic('x'))` works as expected. `TELEGRAM_TEXT_LIMITS` and `truncateText` are there for staying under Telegram's length limits (surrogate-pair-safe).

## Deep links

```ts
import { buildStartLink, buildStartAppLink, parseTelegramLink } from '@core-ease/telegram-kit/links';

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
import { InlineKeyboardBuilder, ReplyKeyboardBuilder } from '@core-ease/telegram-kit/keyboards';

const keyboard = new InlineKeyboardBuilder()
  .text('Yes', 'confirm:yes').text('No', 'confirm:no')
  .row()
  .url('Docs', 'https://example.com')
  .build();

await bot.sendMessage({ chat_id, text: 'Confirm?', reply_markup: keyboard });
```

`InlineKeyboardBuilder.columns(buttons, perRow)` is a shortcut for grid layouts. `removeKeyboard()` and `forceReply()` cover the remaining reply-markup types.

## Developing outside Telegram

`WebApp` doesn't exist outside a Telegram client, which makes local development painful. Even without calling `installDevMode()`, every `@core-ease/telegram-kit` function already degrades to a real browser-native equivalent (see `core/fallback.ts`) - so hooks and core functions work in a regular browser tab out of the box. `installDevMode()` goes one step further and seeds a fake user/theme/session, so `getWebApp().initDataUnsafe.user`, the theme, and `isInTelegram()` all behave like a real launch too:

```ts
import { installDevMode } from '@core-ease/telegram-kit/dev';

// Call this before anything else touches getWebApp() - hooks, <TelegramProvider>,
// or any core/index.ts function. It seeds a fake user/theme/session through the
// exact same code path a real Telegram launch uses, so every feature (storage,
// haptics, dialogs, location, ...) keeps working through its browser-native
// fallback instead of hanging or warning.
if (process.env.NODE_ENV === 'development') {
  installDevMode({ user: { id: 1, first_name: 'Dev' } });
}
```

Don't ship this in production — gate it behind an environment check like above.

## Using it without a bundler

There's also a plain browser build that exposes everything under a `TelegramKit` global. It bundles the full Mini Apps SDK itself, so **no external `telegram.org` script tag is needed**:

```html
<script src="https://unpkg.com/@core-ease/telegram-kit/dist/browser.global.js"></script>
<script>
  const { encodeQRCode, buildStartLink, isInTelegram, getWebApp } = TelegramKit;
  console.log(getWebApp()?.platform);
</script>
```

This build includes core, QR, formatting, links, keyboards, dev mode, and the bundled Mini Apps SDK - not the React-dependent pieces, since there's no React in a plain `<script>` context.

## The bundled Mini Apps SDK

`@core-ease/telegram-kit` used to be a thin *type* wrapper around Telegram's own `https://telegram.org/js/telegram-web-app.js`, which you had to load yourself via a `<script>` tag. That script is now vendored in full, as a faithful line-for-line behavioral TypeScript port, under `@core-ease/telegram-kit/sdk` (source: `src/sdk/`, public entry `src/sdk/index.ts`, implementation under `src/sdk/_internal/`).

Practically, this means:

- **No CDN dependency, ever.** Just `import '@core-ease/telegram-kit'` (or `/core`, or `/hooks`) and the first call to `getWebApp()` - which every hook and core function makes for you - sets up `window.Telegram.WebApp` locally. Nothing is fetched over the network, and nothing runs eagerly just from importing the package (SSR-safe).
- **`core/`, `react/hooks.ts`, and `<TelegramProvider>` all read the SDK directly** - `getWebApp()` in `core/index.ts` gets the `WebApp` instance from `../sdk`'s `bootstrapTelegramWebApp()`, never from `window.Telegram`. Every hook delegates to `core/` instead of re-implementing its own copy of the same call.
- **Every feature has a real browser fallback.** Opened outside Telegram (or in dev mode, or against an older client), storage falls back to `localStorage`, haptics to `navigator.vibrate`, location to `navigator.geolocation`, clipboard to `navigator.clipboard`, file downloads to a plain `<a download>`, dialogs to `window.alert/confirm/prompt`, fullscreen/orientation to the standard Fullscreen/Screen Orientation APIs, and sharing to the Web Share API - see `src/core/fallback.ts`. Calls that have no meaningful browser equivalent (biometrics, emoji status, Telegram-account actions, ...) resolve predictably instead of hanging or rejecting with a console warning.
- **Every native event, version gate, and validation rule** from the official script is preserved exactly in the SDK layer itself - see `src/sdk/README.md` for the module-by-module breakdown and fidelity notes.
- **Advanced use:** if you want the typed SDK classes directly instead of going through `core/`, import from `@core-ease/telegram-kit/sdk`:

  ```ts
  import { bootstrapTelegramWebApp } from '@core-ease/telegram-kit/sdk';

  const { webApp } = bootstrapTelegramWebApp();
  webApp.MainButton.setText('Continue').show();
  ```

## TypeScript

Everything is written in TypeScript and ships its own `.d.ts` files — no `@types` package needed. The full Bot API type surface (`Message`, `Update`, `InlineKeyboardMarkup`, every `SendXParams` type, etc.) is exported from `@core-ease/telegram-kit/bot` and `@core-ease/telegram-kit` directly.

## License

MIT
