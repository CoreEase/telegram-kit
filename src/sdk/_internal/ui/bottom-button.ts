/**
 * `Telegram.WebApp.MainButton` / `Telegram.WebApp.SecondaryButton`.
 *
 * Both buttons share 100% of their behavior in the original SDK
 * (`BottomButtonConstructor(type)`); this class keeps that single
 * implementation and is instantiated twice by the WebApp aggregator.
 */

import { WebAppKernel } from '../core/kernel';
import { parseColorToHex, strTrim } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import { DebugBottomBar } from './debug-bottom-bar';
import type { ThemeManager } from '../theme/theme-manager';
import type { BottomButtonPosition, VoidCallback } from '../types';

export type BottomButtonType = 'main' | 'secondary';

interface ButtonParamsWire {
  is_visible: boolean;
  is_active?: boolean;
  is_progress_visible?: boolean;
  icon_custom_emoji_id?: string;
  text?: string;
  color?: string;
  text_color?: string;
  has_shine_effect?: boolean;
  position?: BottomButtonPosition;
}

export interface SetBottomButtonParams {
  text?: string;
  color?: string | false | null;
  text_color?: string | false | null;
  is_visible?: boolean;
  is_active?: boolean;
  has_shine_effect?: boolean;
  position?: BottomButtonPosition;
  icon_custom_emoji_id?: string | false | null;
}

export class BottomButton {
  readonly type: BottomButtonType;

  private isVisibleValue = false;
  private isActiveValue = true;
  private hasShineEffectValue = false;
  private isProgressVisibleValue = false;
  private iconCustomEmojiIdValue: string | false = false;
  private textValue: string;
  private colorValue: string | false = false;
  private textColorValue: string | false = false;
  private positionValue: BottomButtonPosition = 'left';

  private curButtonState: string | null = null;

  private readonly isMain: boolean;
  private readonly setupEventName: string;
  private readonly nativePressEventName: string;
  private readonly webViewEventName: string;
  private readonly defaultText: string;
  private readonly defaultColor: () => string;
  private readonly defaultTextColor: () => string;

  constructor(
    type: BottomButtonType,
    private readonly kernel: WebAppKernel,
    private readonly theme: ThemeManager,
    private readonly debugBar: DebugBottomBar
  ) {
    this.type = type;
    this.isMain = type === 'main';

    if (this.isMain) {
      this.setupEventName = 'web_app_setup_main_button';
      this.nativePressEventName = 'main_button_pressed';
      this.webViewEventName = 'mainButtonClicked';
      this.defaultText = 'Continue';
      this.defaultColor = () => theme.getThemeParams().button_color || '#2481cc';
      this.defaultTextColor = () => theme.getThemeParams().button_text_color || '#ffffff';
    } else {
      this.setupEventName = 'web_app_setup_secondary_button';
      this.nativePressEventName = 'secondary_button_pressed';
      this.webViewEventName = 'secondaryButtonClicked';
      this.defaultText = 'Cancel';
      this.defaultColor = () => theme.getBottomBarColor();
      this.defaultTextColor = () => theme.getThemeParams().button_color || '#2481cc';
    }
    this.textValue = this.defaultText;

    kernel.webView.onEvent(this.nativePressEventName, this.handlePressed);
    debugBar.registerButton(type, this.handlePressed);
  }

  private handlePressed = (): void => {
    if (this.isActiveValue) {
      this.kernel.receiveWebViewEvent(this.webViewEventName);
    }
  };

  // ---------------------------------------------------------------------
  // Public property accessors (mirrors Object.defineProperty in original)
  // ---------------------------------------------------------------------

  get iconCustomEmojiId(): string | false {
    return this.iconCustomEmojiIdValue;
  }
  set iconCustomEmojiId(val: string | false) {
    this.setParams({ icon_custom_emoji_id: val });
  }

  get text(): string {
    return this.textValue;
  }
  set text(val: string) {
    this.setParams({ text: val });
  }

  get color(): string {
    return this.colorValue || this.defaultColor();
  }
  set color(val: string) {
    this.setParams({ color: val });
  }

  get textColor(): string {
    return this.textColorValue || this.defaultTextColor();
  }
  set textColor(val: string) {
    this.setParams({ text_color: val });
  }

  get isVisible(): boolean {
    return this.isVisibleValue;
  }
  set isVisible(val: boolean) {
    this.setParams({ is_visible: val });
  }

  get isProgressVisible(): boolean {
    return this.isProgressVisibleValue;
  }

  get isActive(): boolean {
    return this.isActiveValue;
  }
  set isActive(val: boolean) {
    this.setParams({ is_active: val });
  }

  get hasShineEffect(): boolean {
    return this.hasShineEffectValue;
  }
  set hasShineEffect(val: boolean) {
    this.setParams({ has_shine_effect: val });
  }

  get position(): BottomButtonPosition {
    return this.positionValue;
  }
  set position(val: BottomButtonPosition) {
    if (!this.isMain) this.setParams({ position: val });
  }

  // ---------------------------------------------------------------------
  // Wire protocol
  // ---------------------------------------------------------------------

  private buttonParams(): ButtonParamsWire {
    if (!this.isVisibleValue) {
      return { is_visible: false };
    }
    const params: ButtonParamsWire = {
      is_visible: true,
      is_active: this.isActiveValue,
      is_progress_visible: this.isProgressVisibleValue,
      icon_custom_emoji_id: this.iconCustomEmojiIdValue || undefined,
      text: this.textValue,
      color: this.color,
      text_color: this.textColor,
      has_shine_effect: this.hasShineEffectValue && this.isActiveValue && !this.isProgressVisibleValue,
    };
    if (!this.isMain) {
      params.position = this.positionValue;
    }
    return params;
  }

  private updateButton(): void {
    const params = this.buttonParams();
    const state = JSON.stringify(params);
    if (this.curButtonState === state) {
      return;
    }
    this.curButtonState = state;
    this.kernel.webView.postEvent(this.setupEventName, undefined, params);
    if (this.debugBar.enabled) {
      this.debugBar.updateButtonVisual(this.type, params);
    }
  }

  setParams(params: SetBottomButtonParams): this {
    if (typeof params.icon_custom_emoji_id !== 'undefined') {
      let emojiId = params.icon_custom_emoji_id;
      if (emojiId === false || emojiId === null) {
        emojiId = '';
      }
      if (emojiId !== '' && !/^[0-9]{10,20}$/.test(emojiId)) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom button icon custom emoji is invalid', params.icon_custom_emoji_id);
        throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
      }
      this.iconCustomEmojiIdValue = emojiId || false;
    }
    if (typeof params.text !== 'undefined') {
      const text = strTrim(params.text);
      if (!text.length && !this.iconCustomEmojiIdValue) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom button text is required', params.text);
        throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
      }
      if (text.length > 64) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom button text is too long', text);
        throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
      }
      this.textValue = text;
    }
    if (typeof params.color !== 'undefined') {
      if (params.color === false || params.color === null) {
        this.colorValue = false;
      } else {
        const color = parseColorToHex(params.color);
        if (!color) {
          // eslint-disable-next-line no-console
          console.error('[@core-ease/telegram-kit] Bottom button color format is invalid', params.color);
          throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
        }
        this.colorValue = color;
      }
    }
    if (typeof params.text_color !== 'undefined') {
      if (params.text_color === false || params.text_color === null) {
        this.textColorValue = false;
      } else {
        const textColor = parseColorToHex(params.text_color);
        if (!textColor) {
          // eslint-disable-next-line no-console
          console.error('[@core-ease/telegram-kit] Bottom button text color format is invalid', params.text_color);
          throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
        }
        this.textColorValue = textColor;
      }
    }
    if (typeof params.is_visible !== 'undefined') {
      if (params.is_visible && !this.textValue.length) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom button text is required');
        throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
      }
      this.isVisibleValue = !!params.is_visible;
    }
    if (typeof params.has_shine_effect !== 'undefined') {
      this.hasShineEffectValue = !!params.has_shine_effect;
    }
    if (!this.isMain && typeof params.position !== 'undefined') {
      if (
        params.position != 'left' &&
        params.position != 'right' &&
        params.position != 'top' &&
        params.position != 'bottom'
      ) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom button posiition is invalid', params.position);
        throwWebAppError(WebAppErrorName.BottomButtonParamInvalid);
      }
      this.positionValue = params.position;
    }
    if (typeof params.is_active !== 'undefined') {
      this.isActiveValue = !!params.is_active;
    }
    this.updateButton();
    return this;
  }

  setText(text: string): this {
    return this.setParams({ text });
  }

  onClick(callback: VoidCallback): this {
    this.kernel.onWebViewEvent(this.webViewEventName, callback);
    return this;
  }

  offClick(callback: VoidCallback): this {
    this.kernel.offWebViewEvent(this.webViewEventName, callback);
    return this;
  }

  show(): this {
    return this.setParams({ is_visible: true });
  }

  hide(): this {
    return this.setParams({ is_visible: false });
  }

  enable(): this {
    return this.setParams({ is_active: true });
  }

  disable(): this {
    return this.setParams({ is_active: false });
  }

  showProgress(leaveActive?: boolean): this {
    this.isActiveValue = !!leaveActive;
    this.isProgressVisibleValue = true;
    this.updateButton();
    return this;
  }

  hideProgress(): this {
    if (!this.isActiveValue) {
      this.isActiveValue = true;
    }
    this.isProgressVisibleValue = false;
    this.updateButton();
    return this;
  }
}
