/**
 * Theme & chrome-color manager.
 *
 * Owns `themeParams`, `colorScheme`, `headerColor`, `backgroundColor` and
 * `bottomBarColor` - i.e. everything the original script updates whenever a
 * `theme_changed` event arrives or the developer calls one of the
 * `set*Color` setters.
 */

import { WebAppKernel } from '../core/kernel';
import { isColorDark, parseColorToHex, sessionStorageGet, sessionStorageSet } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { ColorScheme, DefaultColors, ThemeParams } from '../types';

type ColorKey = 'bg_color' | 'secondary_bg_color';

export class ThemeManager {
  private themeParams: ThemeParams = {};
  private _colorScheme: ColorScheme = 'light';

  private backgroundColorValue: string | ColorKey = 'bg_color';
  private appBackgroundColor: string | null = null;

  private headerColorKey: ColorKey | null = 'bg_color';
  private headerColorValue: string | null = null;
  private appHeaderColorKey: ColorKey | null = null;
  private appHeaderColorValue: string | null = null;

  private bottomBarColorValue: string | ColorKey | 'bottom_bar_bg_color' = 'bottom_bar_bg_color';
  private appBottomBarColor: string | null = null;

  /** Called after every bottom-bar color update, e.g. to refresh the debug bar. */
  onBottomBarColorApplied: (() => void) | null = null;

  constructor(private readonly kernel: WebAppKernel) {
    const storedTheme = sessionStorageGet<ThemeParams>('themeParams');
    const rawTheme = kernel.initParams.tgWebAppThemeParams;
    if (rawTheme && rawTheme.length) {
      try {
        const parsed = JSON.parse(rawTheme);
        if (parsed) this.setThemeParams(parsed);
      } catch (e) {
        // ignore malformed payload
      }
    }
    if (storedTheme) {
      this.setThemeParams(storedTheme);
    }

    const storedColors = sessionStorageGet<DefaultColors>('defaultColors');
    const rawColors = kernel.initParams.tgWebAppDefaultColors;
    if (rawColors && rawColors.length) {
      try {
        const parsed = JSON.parse(rawColors);
        if (parsed) this.setDefaultColors(parsed);
      } catch (e) {
        // ignore malformed payload
      }
    }
    if (storedColors) {
      this.setDefaultColors(storedColors);
    }
  }

  get colorScheme(): ColorScheme {
    return this._colorScheme;
  }

  getThemeParams(): ThemeParams {
    return this.themeParams;
  }

  setThemeParams(theme: ThemeParams): void {
    // temp iOS fix
    if (theme.bg_color == '#1c1c1d' && theme.bg_color == theme.secondary_bg_color) {
      theme.secondary_bg_color = '#2c2c2e';
    }
    for (const key in theme) {
      const color = parseColorToHex(theme[key]);
      if (color) {
        this.themeParams[key] = color;
        if (key == 'bg_color') {
          this._colorScheme = isColorDark(color) ? 'dark' : 'light';
          this.kernel.setCssProperty('color-scheme', this._colorScheme);
        }
        const cssKey = 'theme-' + key.split('_').join('-');
        this.kernel.setCssProperty(cssKey, color);
      }
    }
    sessionStorageSet('themeParams', this.themeParams);
  }

  setDefaultColors(defColors: DefaultColors): void {
    if (this._colorScheme == 'dark') {
      if (defColors.bg_dark_color) {
        this.backgroundColorValue = defColors.bg_dark_color;
      }
      if (defColors.header_dark_color) {
        this.headerColorKey = null;
        this.headerColorValue = defColors.header_dark_color;
      }
    } else {
      if (defColors.bg_color) {
        this.backgroundColorValue = defColors.bg_color;
      }
      if (defColors.header_color) {
        this.headerColorKey = null;
        this.headerColorValue = defColors.header_color;
      }
    }
    sessionStorageSet('defaultColors', defColors);
  }

  // ---------------------------------------------------------------------
  // Header color
  // ---------------------------------------------------------------------

  getHeaderColor(): string | null | undefined {
    if (this.headerColorKey == 'secondary_bg_color') {
      return this.themeParams.secondary_bg_color;
    } else if (this.headerColorKey == 'bg_color') {
      return this.themeParams.bg_color;
    }
    return this.headerColorValue;
  }

  setHeaderColor(color: string): void {
    if (!this.kernel.warnIfUnsupported('6.1', 'Header color')) {
      return;
    }
    if (!this.kernel.versionAtLeast('6.9')) {
      if (this.themeParams.bg_color && this.themeParams.bg_color == color) {
        color = 'bg_color';
      } else if (this.themeParams.secondary_bg_color && this.themeParams.secondary_bg_color == color) {
        color = 'secondary_bg_color';
      }
    }
    let headColor: string | false | null = null;
    let colorKey: ColorKey | null = null;
    if (color == 'bg_color' || color == 'secondary_bg_color') {
      colorKey = color;
    } else if (this.kernel.versionAtLeast('6.9')) {
      headColor = parseColorToHex(color);
      if (!headColor) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Header color format is invalid', color);
        throwWebAppError(WebAppErrorName.HeaderColorInvalid);
      }
    }
    if (!this.kernel.versionAtLeast('6.9') && colorKey != 'bg_color' && colorKey != 'secondary_bg_color') {
      // eslint-disable-next-line no-console
      console.error(
        "[@core-ease/telegram-kit] Header color key should be one of Telegram.WebApp.themeParams.bg_color, Telegram.WebApp.themeParams.secondary_bg_color, 'bg_color', 'secondary_bg_color'",
        color
      );
      throwWebAppError(WebAppErrorName.HeaderColorKeyInvalid);
    }
    this.headerColorKey = colorKey;
    this.headerColorValue = headColor || null;
    this.updateHeaderColor();
  }

  updateHeaderColor(): void {
    if (this.appHeaderColorKey != this.headerColorKey || this.appHeaderColorValue != this.headerColorValue) {
      this.appHeaderColorKey = this.headerColorKey;
      this.appHeaderColorValue = this.headerColorValue;
      if (this.appHeaderColorValue) {
        this.kernel.webView.postEvent('web_app_set_header_color', undefined, { color: this.appHeaderColorValue });
      } else {
        this.kernel.webView.postEvent('web_app_set_header_color', undefined, { color_key: this.appHeaderColorKey });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Background color
  // ---------------------------------------------------------------------

  getBackgroundColor(): string | undefined {
    if (this.backgroundColorValue == 'secondary_bg_color') {
      return this.themeParams.secondary_bg_color;
    } else if (this.backgroundColorValue == 'bg_color') {
      return this.themeParams.bg_color;
    }
    return this.backgroundColorValue as string;
  }

  setBackgroundColor(color: string): void {
    if (!this.kernel.warnIfUnsupported('6.1', 'Background color')) {
      return;
    }
    let bgColor: string | ColorKey;
    if (color == 'bg_color' || color == 'secondary_bg_color') {
      bgColor = color;
    } else {
      const parsed = parseColorToHex(color);
      if (!parsed) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Background color format is invalid', color);
        throwWebAppError(WebAppErrorName.BackgroundColorInvalid);
      }
      bgColor = parsed as string;
    }
    this.backgroundColorValue = bgColor;
    this.updateBackgroundColor();
  }

  updateBackgroundColor(): void {
    const color = this.getBackgroundColor();
    if (this.appBackgroundColor != color) {
      this.appBackgroundColor = color ?? null;
      this.kernel.webView.postEvent('web_app_set_background_color', undefined, { color });
    }
  }

  // ---------------------------------------------------------------------
  // Bottom bar color
  // ---------------------------------------------------------------------

  getBottomBarColor(): string {
    if (this.bottomBarColorValue == 'bottom_bar_bg_color') {
      return this.themeParams.bottom_bar_bg_color || this.themeParams.secondary_bg_color || '#ffffff';
    } else if (this.bottomBarColorValue == 'secondary_bg_color') {
      return this.themeParams.secondary_bg_color as string;
    } else if (this.bottomBarColorValue == 'bg_color') {
      return this.themeParams.bg_color as string;
    }
    return this.bottomBarColorValue as string;
  }

  setBottomBarColor(color: string): void {
    if (!this.kernel.warnIfUnsupported('7.10', 'Bottom bar color')) {
      return;
    }
    let bgColor: string;
    if (color == 'bg_color' || color == 'secondary_bg_color' || color == 'bottom_bar_bg_color') {
      bgColor = color;
    } else {
      const parsed = parseColorToHex(color);
      if (!parsed) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Bottom bar color format is invalid', color);
        throwWebAppError(WebAppErrorName.BottomBarColorInvalid);
      }
      bgColor = parsed as string;
    }
    this.bottomBarColorValue = bgColor;
    this.updateBottomBarColor();
  }

  updateBottomBarColor(): void {
    const color = this.getBottomBarColor();
    if (this.appBottomBarColor != color) {
      this.appBottomBarColor = color;
      this.kernel.webView.postEvent('web_app_set_bottom_bar_color', undefined, { color });
    }
    this.onBottomBarColorApplied?.();
  }
}
