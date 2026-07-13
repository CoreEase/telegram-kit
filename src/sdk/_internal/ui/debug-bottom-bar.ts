/**
 * Debug bottom bar - the little on-page mock of Telegram's native Main /
 * Secondary button bar, shown only when `tgWebAppDebug` is present in the
 * init hash params (i.e. when testing a Mini App directly in a desktop
 * browser instead of inside the real Telegram client).
 *
 * Isolated into its own module so it can be tree-shaken/omitted entirely in
 * builds that never run in debug mode, and so `BottomButton` doesn't need
 * to know anything about DOM styling.
 */

import { WebAppKernel } from '../core/kernel';
import type { BottomButtonPosition } from '../types';

export interface DebugButtonVisualState {
  is_visible?: boolean;
  is_active?: boolean;
  is_progress_visible?: boolean;
  text?: string;
  color?: string;
  text_color?: string;
  has_shine_effect?: boolean;
}

type ButtonType = 'main' | 'secondary';

interface RegisteredDebugButton {
  el: HTMLElement;
  isVisible: boolean;
  position: BottomButtonPosition;
}

const SPINNER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewport="0 0 48 48" width="48px" height="48px"><circle cx="50%" cy="50%" stroke="{COLOR}" stroke-width="2.25" stroke-linecap="round" fill="none" stroke-dashoffset="106" r="9" stroke-dasharray="56.52" rotate="-90"><animate attributeName="stroke-dashoffset" attributeType="XML" dur="360s" from="0" to="12500" repeatCount="indefinite"></animate><animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="-90 24 24" to="630 24 24" repeatCount="indefinite"></animateTransform></circle></svg>';

export class DebugBottomBar {
  readonly enabled: boolean;
  private container: HTMLElement | null = null;
  private buttons: Partial<Record<ButtonType, RegisteredDebugButton>> = {};

  /** Invoked whenever the reserved bottom-bar height changes. */
  onHeightChanged: (() => void) | null = null;

  constructor(private readonly kernel: WebAppKernel, private readonly getBottomBarColor: () => string) {
    this.enabled = !!kernel.initParams.tgWebAppDebug;
    if (!this.enabled) return;

    this.container = document.createElement('tg-bottom-bar');
    const style: Partial<CSSStyleDeclaration> = {
      display: 'flex',
      gap: '7px',
      font: '600 14px/18px sans-serif',
      width: '100%',
      background: getBottomBarColor(),
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      margin: '0',
      padding: '7px',
      textAlign: 'center',
      boxSizing: 'border-box',
      zIndex: '10000',
    };
    Object.assign(this.container.style, style);

    document.addEventListener('DOMContentLoaded', function onDomLoaded() {
      document.removeEventListener('DOMContentLoaded', onDomLoaded);
      document.body.appendChild(this_container());
    });
    const this_container = () => this.container as HTMLElement;

    const animStyle = document.createElement('style');
    animStyle.innerHTML =
      'tg-bottom-button.shine { position: relative; overflow: hidden; } ' +
      'tg-bottom-button.shine:before { content:""; position: absolute; top: 0; width: 100%; height: 100%; ' +
      'background: linear-gradient(120deg, transparent, rgba(255, 255, 255, .2), transparent); ' +
      'animation: tg-bottom-button-shine 5s ease-in-out infinite; } ' +
      '@-webkit-keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}} ' +
      '@keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}}';
    this.container.appendChild(animStyle);
  }

  /** Creates & registers a debug clone of a Main/Secondary button; returns its element. */
  registerButton(type: ButtonType, onPressed: () => void): HTMLElement | null {
    if (!this.enabled || !this.container) return null;
    const el = document.createElement('tg-bottom-button');
    const style: Partial<CSSStyleDeclaration> = {
      display: 'none',
      width: '100%',
      height: '44px',
      borderRadius: '0',
      background: 'no-repeat right center',
      padding: '13px 15px',
      textAlign: 'center',
      boxSizing: 'border-box',
    };
    Object.assign(el.style, style);
    this.container.appendChild(el);
    el.addEventListener('click', onPressed, false);
    this.buttons[type] = { el, isVisible: false, position: 'left' };
    return el;
  }

  /** Applies visual state coming from `BottomButton.buttonParams()`. */
  updateButtonVisual(type: ButtonType, params: DebugButtonVisualState & { position?: BottomButtonPosition }): void {
    const entry = this.buttons[type];
    if (!entry) return;
    const el = entry.el;
    entry.isVisible = !!params.is_visible;
    entry.position = params.position || 'left';

    if (params.is_visible) {
      el.style.display = 'block';
      el.style.opacity = params.is_active ? '1' : '0.8';
      el.style.cursor = params.is_active ? 'pointer' : 'auto';
      (el as any).disabled = !params.is_active;
      el.innerText = params.text || '';
      el.className = params.has_shine_effect ? 'shine' : '';
      el.style.backgroundImage = params.is_progress_visible
        ? `url('data:image/svg+xml,${encodeURIComponent(
            SPINNER_SVG.replace('{COLOR}', params.text_color || '#ffffff')
          )}')`
        : 'none';
      el.style.backgroundColor = params.color || '';
      el.style.color = params.text_color || '';
    } else {
      el.style.display = 'none';
    }
    this.updateBar();
  }

  private updateBar(): void {
    if (!this.enabled || !this.container) return;
    const main = this.buttons.main;
    const secondary = this.buttons.secondary;
    let height = 0;

    if ((main && main.isVisible) || (secondary && secondary.isVisible)) {
      this.container.style.display = 'flex';
      height = 58;
      if (main?.isVisible && secondary?.isVisible) {
        if (secondary.position == 'top') {
          this.container.style.flexDirection = 'column-reverse';
          height += 51;
        } else if (secondary.position == 'bottom') {
          this.container.style.flexDirection = 'column';
          height += 51;
        } else if (secondary.position == 'left') {
          this.container.style.flexDirection = 'row-reverse';
        } else if (secondary.position == 'right') {
          this.container.style.flexDirection = 'row';
        }
      }
    } else {
      this.container.style.display = 'none';
      height = 0;
    }

    this.kernel.bottomBarHeightPx = height;
    this.container.style.background = this.getBottomBarColor();
    if (document.documentElement) {
      document.documentElement.style.boxSizing = 'border-box';
      document.documentElement.style.paddingBottom = height + 'px';
    }
    this.onHeightChanged?.();
  }

  /** Called after the bottom-bar color changes so the debug bar repaints too. */
  refreshColor(): void {
    if (!this.enabled || !this.container) return;
    this.updateBar();
  }
}
