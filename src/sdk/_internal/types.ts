/**
 * Shared type definitions for the Telegram WebApp SDK port.
 *
 * These types describe the wire format exchanged with the native Telegram
 * client (postEvent/receiveEvent payloads) as well as the public-facing
 * shapes exposed to the Mini App developer. Kept in one file so every
 * module (core, ui, features, theme) can depend on a single source of truth.
 */

/** Generic string-keyed dictionary used for loosely-typed event payloads. */
export type AnyRecord = Record<string, any>;

/** Callback signature used throughout the SDK for fire-and-forget events. */
export type VoidCallback = (...args: any[]) => void;

/** Handler used internally by the WebView event bus. */
export type EventHandler = (eventType: string, eventData: any) => void;

/** Raw key/value hash-params parsed from `location.hash`. */
export interface InitParams extends AnyRecord {
  _path?: string;
  tgWebAppData?: string;
  tgWebAppThemeParams?: string;
  tgWebAppDefaultColors?: string;
  tgWebAppVersion?: string;
  tgWebAppPlatform?: string;
  tgWebAppFullscreen?: string;
  tgWebAppShowSettings?: string;
  tgWebAppBotInline?: string;
  tgWebAppDebug?: string;
}

/** Theme color palette pushed by the Telegram client. */
export interface ThemeParams extends AnyRecord {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  section_separator_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

/** Default (fallback) colors sent alongside theme params. */
export interface DefaultColors {
  bg_color?: string;
  bg_dark_color?: string;
  header_color?: string;
  header_dark_color?: string;
}

export type ColorScheme = 'light' | 'dark';

export interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** `Telegram.WebApp.initDataUnsafe` shape - untrusted, parsed client-side. */
export interface WebAppInitDataUnsafe extends AnyRecord {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: WebAppChat;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date?: string;
  hash?: string;
  signature?: string;
}

export interface WebAppUser extends AnyRecord {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface WebAppChat extends AnyRecord {
  id: number;
  type: string;
  title: string;
  username?: string;
  photo_url?: string;
}

/** Button position for the SecondaryButton relative to the MainButton. */
export type BottomButtonPosition = 'left' | 'right' | 'top' | 'bottom';

export interface BottomButtonParams {
  is_visible?: boolean;
  is_active?: boolean;
  is_progress_visible?: boolean;
  icon_custom_emoji_id?: string | false | null;
  text?: string;
  color?: string | false | null;
  text_color?: string | false | null;
  has_shine_effect?: boolean;
  position?: BottomButtonPosition;
}

export type PopupButtonType = 'default' | 'ok' | 'close' | 'cancel' | 'destructive';

export interface PopupButton {
  id?: string | number;
  type?: PopupButtonType;
  text?: string;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

export interface ScanQrPopupParams {
  text?: string;
}

export interface OpenLinkOptions {
  try_instant_view?: boolean;
  try_browser?: string;
}

export interface OpenTelegramLinkOptions {
  force_request?: boolean;
}

export interface CloseOptions {
  return_back?: boolean;
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotificationType = 'error' | 'success' | 'warning';

export type HomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';

export type BiometricType = 'unknown' | 'finger' | 'face';

export interface BiometricRequestAccessParams {
  reason?: string;
}

export interface BiometricAuthenticateParams {
  reason?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  course: number | null;
  speed: number | null;
  horizontal_accuracy: number | null;
  vertical_accuracy: number | null;
  course_accuracy: number | null;
  speed_accuracy: number | null;
}

export interface MotionSensorStartParams {
  refresh_rate?: number;
}

export interface DeviceOrientationStartParams extends MotionSensorStartParams {
  need_absolute?: boolean;
}

export interface DownloadFileParams {
  url: string;
  file_name: string;
}

export interface ShareToStoryWidgetLink {
  url: string;
  name?: string;
}

export interface ShareToStoryParams {
  text?: string;
  widget_link?: ShareToStoryWidgetLink;
}

/** Two-way callback shape shared by storage-like features (err-first). */
export type ErrCallback<T = any> = (error: string | null, result?: T) => void;

/** Generic result callback for CloudStorage.getItems(). */
export type ItemsCallback = ErrCallback<Record<string, string>>;
