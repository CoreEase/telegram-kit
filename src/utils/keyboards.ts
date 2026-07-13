import type {
  CopyTextButton,
  ForceReply,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  KeyboardButton,
  KeyboardButtonPollType,
  KeyboardButtonRequestChat,
  KeyboardButtonRequestUsers,
  LoginUrl,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
  SwitchInlineQueryChosenChat,
} from '../types/bot';

export class InlineKeyboardBuilder {
  private rows: InlineKeyboardButton[][] = [[]];

  private currentRow(): InlineKeyboardButton[] {
    return this.rows[this.rows.length - 1];
  }

  private add(button: InlineKeyboardButton): this {
    this.currentRow().push(button);
    return this;
  }

  text(text: string, callbackData: string): this {
    return this.add({ text, callback_data: callbackData });
  }

  url(text: string, url: string): this {
    return this.add({ text, url });
  }

  webApp(text: string, url: string): this {
    return this.add({ text, web_app: { url } });
  }
  
  login(text: string, loginUrl: string | LoginUrl): this {
    return this.add({ text, login_url: typeof loginUrl === 'string' ? { url: loginUrl } : loginUrl });
  }
  
  switchInline(text: string, query = ''): this {
    return this.add({ text, switch_inline_query: query });
  }
  
  switchInlineCurrentChat(text: string, query = ''): this {
    return this.add({ text, switch_inline_query_current_chat: query });
  }
  
  switchInlineChosenChat(text: string, query?: SwitchInlineQueryChosenChat): this {
    return this.add({ text, switch_inline_query_chosen_chat: query ?? {} });
  }
  
  copyText(text: string, copyText: string | CopyTextButton): this {
    return this.add({ text, copy_text: typeof copyText === 'string' ? { text: copyText } : copyText });
  }
  
  pay(text = 'Pay'): this {
    return this.add({ text, pay: true });
  }
  
  callbackGame(text: string): this {
    return this.add({ text, callback_game: {} });
  }

  button(button: InlineKeyboardButton): this {
    return this.add(button);
  }

  row(): this {
    if (this.currentRow().length > 0) this.rows.push([]);
    return this;
  }

  static columns(buttons: InlineKeyboardButton[], perRow: number): InlineKeyboardBuilder {
    const builder = new InlineKeyboardBuilder();
    buttons.forEach((button, i) => {
      if (i > 0 && i % perRow === 0) builder.row();
      builder.button(button);
    });
    return builder;
  }

  build(): InlineKeyboardMarkup {
    const rows = this.rows.filter((row) => row.length > 0);
    return { inline_keyboard: rows };
  }
}

export interface ReplyKeyboardBuildOptions {
  resize?: boolean;
  oneTime?: boolean;
  selective?: boolean;
  placeholder?: string;
  persistent?: boolean;
}

export class ReplyKeyboardBuilder {
  private rows: KeyboardButton[][] = [[]];

  private currentRow(): KeyboardButton[] {
    return this.rows[this.rows.length - 1];
  }

  private add(button: KeyboardButton): this {
    this.currentRow().push(button);
    return this;
  }

  text(label: string): this {
    return this.add({ text: label });
  }
  
  requestContact(label: string): this {
    return this.add({ text: label, request_contact: true });
  }
  
  requestLocation(label: string): this {
    return this.add({ text: label, request_location: true });
  }
  
  requestPoll(label: string, type?: KeyboardButtonPollType['type']): this {
    return this.add({ text: label, request_poll: { type } });
  }

  webApp(label: string, url: string): this {
    return this.add({ text: label, web_app: { url } });
  }

  requestUsers(label: string, params: KeyboardButtonRequestUsers): this {
    return this.add({ text: label, request_users: params });
  }

  requestChat(label: string, params: KeyboardButtonRequestChat): this {
    return this.add({ text: label, request_chat: params });
  }

  button(button: KeyboardButton): this {
    return this.add(button);
  }

  row(): this {
    if (this.currentRow().length > 0) this.rows.push([]);
    return this;
  }

  build(options: ReplyKeyboardBuildOptions = {}): ReplyKeyboardMarkup {
    const rows = this.rows.filter((row) => row.length > 0);
    return {
      keyboard: rows,
      resize_keyboard: options.resize ?? true,
      one_time_keyboard: options.oneTime,
      selective: options.selective,
      input_field_placeholder: options.placeholder,
      is_persistent: options.persistent,
    };
  }
}

export function removeKeyboard(selective?: boolean): ReplyKeyboardRemove {
  return { remove_keyboard: true, selective };
}

export function forceReply(options?: { placeholder?: string; selective?: boolean }): ForceReply {
  return { force_reply: true, input_field_placeholder: options?.placeholder, selective: options?.selective };
}
