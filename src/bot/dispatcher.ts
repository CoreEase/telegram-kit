import type {
  Update,
  Message,
  CallbackQuery,
  InlineQuery,
  ChosenInlineResult,
  ShippingQuery,
  PreCheckoutQuery,
  PollAnswer,
  ChatMemberUpdated,
  ChatJoinRequest,
  ChatBoostUpdated,
  ChatBoostRemoved,
  MessageReactionUpdated,
  MessageReactionCountUpdated,
  BusinessConnection,
  PaidMediaPurchased,
  Poll,
  BusinessMessagesDeleted,
} from '../types/bot';

export type MessageFilter = (message: Message) => boolean | Promise<boolean>;
export type UpdateHandler = (update: Update) => void | Promise<void>;

export interface MessageHandler {
  filter?: MessageFilter;
  handler: (message: Message) => void | Promise<void>;
}

export interface DispatcherOptions {
  onError?: (error: Error, update: Update) => void;
  botUsername?: string;
}

export class Dispatcher {
  private readonly messageHandlers: MessageHandler[] = [];
  private readonly editedMessageHandlers: MessageHandler[] = [];
  private readonly channelPostHandlers: MessageHandler[] = [];
  private readonly editedChannelPostHandlers: MessageHandler[] = [];
  private readonly businessMessageHandlers: MessageHandler[] = [];
  private readonly editedBusinessMessageHandlers: MessageHandler[] = [];
  private readonly deletedBusinessMessagesHandlers: Array<{
    handler: (event: BusinessMessagesDeleted) => void | Promise<void>;
  }> = [];
  private readonly pollHandlers: Array<{
    handler: (poll: Poll) => void | Promise<void>;
  }> = [];
  private readonly callbackQueryHandlers: Array<{
    pattern?: string | RegExp;
    handler: (query: CallbackQuery) => void | Promise<void>;
  }> = [];
  private readonly inlineQueryHandlers: Array<{
    handler: (query: InlineQuery) => void | Promise<void>;
  }> = [];
  private readonly chosenInlineResultHandlers: Array<{
    handler: (result: ChosenInlineResult) => void | Promise<void>;
  }> = [];
  private readonly shippingQueryHandlers: Array<{
    handler: (query: ShippingQuery) => void | Promise<void>;
  }> = [];
  private readonly preCheckoutQueryHandlers: Array<{
    handler: (query: PreCheckoutQuery) => void | Promise<void>;
  }> = [];
  private readonly pollAnswerHandlers: Array<{
    handler: (answer: PollAnswer) => void | Promise<void>;
  }> = [];
  private readonly myChatMemberHandlers: Array<{
    handler: (update: ChatMemberUpdated) => void | Promise<void>;
  }> = [];
  private readonly chatMemberHandlers: Array<{
    handler: (update: ChatMemberUpdated) => void | Promise<void>;
  }> = [];
  private readonly chatJoinRequestHandlers: Array<{
    handler: (request: ChatJoinRequest) => void | Promise<void>;
  }> = [];
  private readonly chatBoostHandlers: Array<{
    handler: (boost: ChatBoostUpdated) => void | Promise<void>;
  }> = [];
  private readonly removedChatBoostHandlers: Array<{
    handler: (boost: ChatBoostRemoved) => void | Promise<void>;
  }> = [];
  private readonly messageReactionHandlers: Array<{
    handler: (reaction: MessageReactionUpdated) => void | Promise<void>;
  }> = [];
  private readonly businessConnectionHandlers: Array<{
    handler: (connection: BusinessConnection) => void | Promise<void>;
  }> = [];
  private readonly purchasedPaidMediaHandlers: Array<{
    handler: (media: PaidMediaPurchased) => void | Promise<void>;
  }> = [];
  private readonly messageReactionCountHandlers: Array<{
    handler: (reaction: MessageReactionCountUpdated) => void | Promise<void>;
  }> = [];

  private botUsername: string | undefined;

  constructor(private readonly options: DispatcherOptions = {}) {
    this.botUsername = options.botUsername?.replace(/^@/, '');
  }

  setBotUsername(username: string): this {
    this.botUsername = username.replace(/^@/, '');
    return this;
  }

  onMessage(handler: (message: Message) => void | Promise<void>, filter?: MessageFilter): this {
    this.messageHandlers.push({ handler, filter });
    return this;
  }

  onCommand(command: string, handler: (message: Message) => void | Promise<void>): this {
    const commandFilter: MessageFilter = (msg) => {
      const text = msg.text?.trim() ?? '';
      const cmd = text.split(' ')[0];
      if (cmd === `/${command}`) return true;
      if (this.botUsername && cmd === `/${command}@${this.botUsername}`) return true;
      return false;
    };
    this.messageHandlers.push({ handler, filter: commandFilter });
    return this;
  }

  onEditedMessage(handler: (message: Message) => void | Promise<void>, filter?: MessageFilter): this {
    this.editedMessageHandlers.push({ handler, filter });
    return this;
  }

  onChannelPost(handler: (message: Message) => void | Promise<void>, filter?: MessageFilter): this {
    this.channelPostHandlers.push({ handler, filter });
    return this;
  }

  onEditedChannelPost(
    handler: (message: Message) => void | Promise<void>,
    filter?: MessageFilter
  ): this {
    this.editedChannelPostHandlers.push({ handler, filter });
    return this;
  }

  onBusinessMessage(
    handler: (message: Message) => void | Promise<void>,
    filter?: MessageFilter
  ): this {
    this.businessMessageHandlers.push({ handler, filter });
    return this;
  }

  onEditedBusinessMessage(
    handler: (message: Message) => void | Promise<void>,
    filter?: MessageFilter
  ): this {
    this.editedBusinessMessageHandlers.push({ handler, filter });
    return this;
  }

  onDeletedBusinessMessages(
    handler: (event: BusinessMessagesDeleted) => void | Promise<void>
  ): this {
    this.deletedBusinessMessagesHandlers.push({ handler });
    return this;
  }

  onPoll(handler: (poll: Poll) => void | Promise<void>): this {
    this.pollHandlers.push({ handler });
    return this;
  }

  onCallbackQuery(
    handler: (query: CallbackQuery) => void | Promise<void>,
    pattern?: string | RegExp
  ): this {
    this.callbackQueryHandlers.push({ handler, pattern });
    return this;
  }

  onInlineQuery(handler: (query: InlineQuery) => void | Promise<void>): this {
    this.inlineQueryHandlers.push({ handler });
    return this;
  }

  onChosenInlineResult(handler: (result: ChosenInlineResult) => void | Promise<void>): this {
    this.chosenInlineResultHandlers.push({ handler });
    return this;
  }

  onShippingQuery(handler: (query: ShippingQuery) => void | Promise<void>): this {
    this.shippingQueryHandlers.push({ handler });
    return this;
  }

  onPreCheckoutQuery(handler: (query: PreCheckoutQuery) => void | Promise<void>): this {
    this.preCheckoutQueryHandlers.push({ handler });
    return this;
  }

  onPollAnswer(handler: (answer: PollAnswer) => void | Promise<void>): this {
    this.pollAnswerHandlers.push({ handler });
    return this;
  }

  onMyChatMember(handler: (update: ChatMemberUpdated) => void | Promise<void>): this {
    this.myChatMemberHandlers.push({ handler });
    return this;
  }

  onChatMember(handler: (update: ChatMemberUpdated) => void | Promise<void>): this {
    this.chatMemberHandlers.push({ handler });
    return this;
  }

  onChatJoinRequest(handler: (request: ChatJoinRequest) => void | Promise<void>): this {
    this.chatJoinRequestHandlers.push({ handler });
    return this;
  }

  onChatBoost(handler: (boost: ChatBoostUpdated) => void | Promise<void>): this {
    this.chatBoostHandlers.push({ handler });
    return this;
  }

  onRemovedChatBoost(handler: (boost: ChatBoostRemoved) => void | Promise<void>): this {
    this.removedChatBoostHandlers.push({ handler });
    return this;
  }

  onMessageReaction(handler: (reaction: MessageReactionUpdated) => void | Promise<void>): this {
    this.messageReactionHandlers.push({ handler });
    return this;
  }

  onBusinessConnection(handler: (connection: BusinessConnection) => void | Promise<void>): this {
    this.businessConnectionHandlers.push({ handler });
    return this;
  }

  onPurchasedPaidMedia(handler: (media: PaidMediaPurchased) => void | Promise<void>): this {
    this.purchasedPaidMediaHandlers.push({ handler });
    return this;
  }

  onMessageReactionCount(handler: (reaction: MessageReactionCountUpdated) => void | Promise<void>): this {
    this.messageReactionCountHandlers.push({ handler });
    return this;
  }

  async dispatch(update: Update): Promise<void> {
    try {
      if (update.message) {
        await this._runMessageHandlers(update.message, this.messageHandlers);
      } else if (update.edited_message) {
        await this._runMessageHandlers(update.edited_message, this.editedMessageHandlers);
      } else if (update.channel_post) {
        await this._runMessageHandlers(update.channel_post, this.channelPostHandlers);
      } else if (update.edited_channel_post) {
        await this._runMessageHandlers(update.edited_channel_post, this.editedChannelPostHandlers);
      } else if (update.business_message) {
        await this._runMessageHandlers(update.business_message, this.businessMessageHandlers);
      } else if (update.edited_business_message) {
        await this._runMessageHandlers(
          update.edited_business_message,
          this.editedBusinessMessageHandlers
        );
      } else if (update.deleted_business_messages) {
        for (const { handler } of this.deletedBusinessMessagesHandlers) {
          await handler(update.deleted_business_messages);
        }
      } else if (update.poll) {
        for (const { handler } of this.pollHandlers) {
          await handler(update.poll);
        }
      } else if (update.callback_query) {
        await this._runCallbackQueryHandlers(update.callback_query);
      } else if (update.inline_query) {
        for (const { handler } of this.inlineQueryHandlers) {
          await handler(update.inline_query);
        }
      } else if (update.chosen_inline_result) {
        for (const { handler } of this.chosenInlineResultHandlers) {
          await handler(update.chosen_inline_result);
        }
      } else if (update.shipping_query) {
        for (const { handler } of this.shippingQueryHandlers) {
          await handler(update.shipping_query);
        }
      } else if (update.pre_checkout_query) {
        for (const { handler } of this.preCheckoutQueryHandlers) {
          await handler(update.pre_checkout_query);
        }
      } else if (update.poll_answer) {
        for (const { handler } of this.pollAnswerHandlers) {
          await handler(update.poll_answer);
        }
      } else if (update.my_chat_member) {
        for (const { handler } of this.myChatMemberHandlers) {
          await handler(update.my_chat_member);
        }
      } else if (update.chat_member) {
        for (const { handler } of this.chatMemberHandlers) {
          await handler(update.chat_member);
        }
      } else if (update.chat_join_request) {
        for (const { handler } of this.chatJoinRequestHandlers) {
          await handler(update.chat_join_request);
        }
      } else if (update.chat_boost) {
        for (const { handler } of this.chatBoostHandlers) {
          await handler(update.chat_boost);
        }
      } else if (update.removed_chat_boost) {
        for (const { handler } of this.removedChatBoostHandlers) {
          await handler(update.removed_chat_boost);
        }
      } else if (update.message_reaction) {
        for (const { handler } of this.messageReactionHandlers) {
          await handler(update.message_reaction);
        }
      } else if (update.message_reaction_count) {
        for (const { handler } of this.messageReactionCountHandlers) {
          await handler(update.message_reaction_count);
        }
      } else if (update.business_connection) {
        for (const { handler } of this.businessConnectionHandlers) {
          await handler(update.business_connection);
        }
      } else if (update.purchased_paid_media) {
        for (const { handler } of this.purchasedPaidMediaHandlers) {
          await handler(update.purchased_paid_media);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError?.(error, update);
    }
  }

  private async _runMessageHandlers(
    message: Message,
    handlers: MessageHandler[]
  ): Promise<void> {
    for (const { handler, filter } of handlers) {
      if (filter) {
        const passes = await Promise.resolve(filter(message));
        if (!passes) continue;
      }
      await handler(message);
    }
  }

  private async _runCallbackQueryHandlers(query: CallbackQuery): Promise<void> {
    for (const { handler, pattern } of this.callbackQueryHandlers) {
      if (pattern !== undefined) {
        const data = query.data ?? '';
        const matches =
          typeof pattern === 'string' ? data === pattern : pattern.test(data);
        if (!matches) continue;
      }
      await handler(query);
    }
  }

  toHandler(): (update: Update) => Promise<void> {
    return (update: Update) => this.dispatch(update);
  }
}
