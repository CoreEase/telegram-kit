import { TelegramApiError } from '../../types/bot';
import type {
  User,
  Chat,
  ChatFullInfo,
  ChatMember,
  ChatInviteLink,
  Message,
  MessageId,
  File,
  UserProfilePhotos,
  Update,
  WebhookInfo,
  Poll,
  Sticker,
  StickerSet,
  ForumTopic,
  GameHighScore,
  BotDescription,
  BotShortDescription,
  BotName,
  BotCommand,
  BotCommandScope,
  MenuButton,
  ReactionType,
  InlineQueryResult,
  InputSticker,
  Gifts,
  StarTransactions,
  BusinessConnection,
  UserChatBoosts,
  PreparedInlineMessage,
  SendMessageParams,
  SendPhotoParams,
  SendAudioParams,
  SendDocumentParams,
  SendVideoParams,
  SendAnimationParams,
  SendVoiceParams,
  SendVideoNoteParams,
  SendStickerParams,
  SendLocationParams,
  SendVenueParams,
  SendContactParams,
  SendPollParams,
  SendDiceParams,
  SendChatActionParams,
  SendMediaGroupParams,
  SendInvoiceParams,
  SendGameParams,
  SendPaidMediaParams,
  ForwardMessageParams,
  ForwardMessagesParams,
  CopyMessageParams,
  CopyMessagesParams,
  EditMessageTextParams,
  EditMessageCaptionParams,
  EditMessageMediaParams,
  EditMessageReplyMarkupParams,
  DeleteMessageParams,
  DeleteMessagesParams,
  PinChatMessageParams,
  UnpinChatMessageParams,
  BanChatMemberParams,
  UnbanChatMemberParams,
  RestrictChatMemberParams,
  PromoteChatMemberParams,
  CreateInvoiceLinkParams,
  SetMyCommandsParams,
  GetMyCommandsParams,
  DeleteMyCommandsParams,
  SetMessageReactionParams,
  GetUpdatesParams,
  SetWebhookParams,
  DeleteWebhookParams,
  AnswerCallbackQueryParams,
  AnswerInlineQueryParams,
  AnswerWebAppQueryParams,
  AnswerShippingQueryParams,
  AnswerPreCheckoutQueryParams,
  GetUserProfilePhotosParams,
  CreateChatInviteLinkParams,
  EditChatInviteLinkParams,
  RevokeChatInviteLinkParams,
  SetGameScoreParams,
  GetGameHighScoresParams,
  CreateForumTopicParams,
  EditForumTopicParams,
  CreateNewStickerSetParams,
  AddStickerToSetParams,
  GetBusinessConnectionParams,
  SetChatStickerSetParams,
  DeleteChatStickerSetParams,
  CreateChatSubscriptionInviteLinkParams,
  EditChatSubscriptionInviteLinkParams,
  GetAvailableGiftsParams,
  SendGiftParams,
  SetUserEmojiStatusParams,
  VerifyUserParams,
  RemoveUserVerificationParams,
  VerifyChatParams,
  RemoveChatVerificationParams,
  ReadBusinessMessageParams,
  DeleteBusinessMessagesParams,
  AllowUserMessagesParams,
  DisallowUserMessagesParams,
  GetUserChatBoostsParams,
  GetStarTransactionsParams,
  RefundStarPaymentParams,
  SavePreparedInlineMessageParams,
  TelegramApiResponse,
  ResponseParameters,
  ReplyMarkup,
  SendLivePhotoParams,
  SendMessageDraftParams,
  GetUserProfileAudiosParams,
  SetChatMemberTagParams,
  AnswerChatJoinRequestQueryParams,
  SendChatJoinRequestWebAppParams,
  GetUserPersonalChatMessagesParams,
  AnswerGuestQueryParams,
  GetManagedBotTokenParams,
  ReplaceManagedBotTokenParams,
  GetManagedBotAccessSettingsParams,
  SetManagedBotAccessSettingsParams,
  SetMyProfilePhotoParams,
  RemoveMyProfilePhotoParams,
  GiftPremiumSubscriptionParams,
  GetUserGiftsParams,
  GetChatGiftsParams,
  RepostStoryParams,
  SavePreparedKeyboardButtonParams,
  EditEphemeralMessageTextParams,
  EditEphemeralMessageMediaParams,
  EditEphemeralMessageCaptionParams,
  EditEphemeralMessageReplyMarkupParams,
  ApproveSuggestedPostParams,
  DeclineSuggestedPostParams,
  DeleteEphemeralMessageParams,
  DeleteMessageReactionParams,
  DeleteAllMessageReactionsParams,
  SendRichMessageParams,
  SendRichMessageDraftParams,
  GetMyStarBalanceParams,
  UserProfileAudios,
  BotAccessSettings,
  PreparedKeyboardButton,
  SentGuestMessage,
  OwnedGifts,
  StarAmount,
} from '../../types/bot';

export { TelegramApiError } from '../../types/bot';

export interface TelegramBotOptions {
  token: string;
  apiBase?: string;
  timeout?: number;
}

export class TelegramBot {
  private readonly apiBase: string;
  private readonly timeout: number;

  constructor(options: TelegramBotOptions) {
    const { token, apiBase = 'https://api.telegram.org', timeout = 30000 } = options;
    this.apiBase = `${apiBase}/bot${token}`;
    this.timeout = timeout;
  }

  private async request<T>(method: string, params?: unknown): Promise<T> {
    const url = `${this.apiBase}/${method}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: params != null ? JSON.stringify(params) : undefined,
        signal: controller.signal,
      });

      const data: TelegramApiResponse<T> = await res.json();

      if (!data.ok) {
        throw new TelegramApiError(
          data.error_code ?? res.status,
          data.description ?? 'Unknown error',
          data.parameters as ResponseParameters | undefined
        );
      }

      return data.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  getUpdates(params?: GetUpdatesParams): Promise<Update[]> {
    return this.request<Update[]>('getUpdates', params);
  }

  setWebhook(params: SetWebhookParams): Promise<true> {
    return this.request<true>('setWebhook', params);
  }

  deleteWebhook(params?: DeleteWebhookParams): Promise<true> {
    return this.request<true>('deleteWebhook', params);
  }

  getWebhookInfo(): Promise<WebhookInfo> {
    return this.request<WebhookInfo>('getWebhookInfo');
  }

  getMe(): Promise<User> {
    return this.request<User>('getMe');
  }

  logOut(): Promise<true> {
    return this.request<true>('logOut');
  }

  close(): Promise<true> {
    return this.request<true>('close');
  }

  setMyDescription(params?: { description?: string; language_code?: string }): Promise<true> {
    return this.request<true>('setMyDescription', params);
  }

  getMyDescription(params?: { language_code?: string }): Promise<BotDescription> {
    return this.request<BotDescription>('getMyDescription', params);
  }

  setMyShortDescription(params?: { short_description?: string; language_code?: string }): Promise<true> {
    return this.request<true>('setMyShortDescription', params);
  }

  getMyShortDescription(params?: { language_code?: string }): Promise<BotShortDescription> {
    return this.request<BotShortDescription>('getMyShortDescription', params);
  }

  setMyName(params?: { name?: string; language_code?: string }): Promise<true> {
    return this.request<true>('setMyName', params);
  }

  getMyName(params?: { language_code?: string }): Promise<BotName> {
    return this.request<BotName>('getMyName', params);
  }

  sendMessage(params: SendMessageParams): Promise<Message> {
    return this.request<Message>('sendMessage', params);
  }

  forwardMessage(params: ForwardMessageParams): Promise<Message> {
    return this.request<Message>('forwardMessage', params);
  }

  forwardMessages(params: ForwardMessagesParams): Promise<MessageId[]> {
    return this.request<MessageId[]>('forwardMessages', params);
  }

  copyMessage(params: CopyMessageParams): Promise<MessageId> {
    return this.request<MessageId>('copyMessage', params);
  }

  copyMessages(params: CopyMessagesParams): Promise<MessageId[]> {
    return this.request<MessageId[]>('copyMessages', params);
  }

  sendPhoto(params: SendPhotoParams): Promise<Message> {
    return this.request<Message>('sendPhoto', params);
  }

  sendAudio(params: SendAudioParams): Promise<Message> {
    return this.request<Message>('sendAudio', params);
  }

  sendDocument(params: SendDocumentParams): Promise<Message> {
    return this.request<Message>('sendDocument', params);
  }

  sendVideo(params: SendVideoParams): Promise<Message> {
    return this.request<Message>('sendVideo', params);
  }

  sendAnimation(params: SendAnimationParams): Promise<Message> {
    return this.request<Message>('sendAnimation', params);
  }

  sendVoice(params: SendVoiceParams): Promise<Message> {
    return this.request<Message>('sendVoice', params);
  }

  sendVideoNote(params: SendVideoNoteParams): Promise<Message> {
    return this.request<Message>('sendVideoNote', params);
  }

  sendSticker(params: SendStickerParams): Promise<Message> {
    return this.request<Message>('sendSticker', params);
  }

  sendMediaGroup(params: SendMediaGroupParams): Promise<Message[]> {
    return this.request<Message[]>('sendMediaGroup', params);
  }

  sendLocation(params: SendLocationParams): Promise<Message> {
    return this.request<Message>('sendLocation', params);
  }

  sendVenue(params: SendVenueParams): Promise<Message> {
    return this.request<Message>('sendVenue', params);
  }

  sendContact(params: SendContactParams): Promise<Message> {
    return this.request<Message>('sendContact', params);
  }

  sendPoll(params: SendPollParams): Promise<Message> {
    return this.request<Message>('sendPoll', params);
  }

  sendDice(params: SendDiceParams): Promise<Message> {
    return this.request<Message>('sendDice', params);
  }

  sendChatAction(params: SendChatActionParams): Promise<true> {
    return this.request<true>('sendChatAction', params);
  }

  setMessageReaction(params: SetMessageReactionParams): Promise<true> {
    return this.request<true>('setMessageReaction', params);
  }

  editMessageText(params: EditMessageTextParams): Promise<Message | true> {
    return this.request<Message | true>('editMessageText', params);
  }

  editMessageCaption(params: EditMessageCaptionParams): Promise<Message | true> {
    return this.request<Message | true>('editMessageCaption', params);
  }

  editMessageMedia(params: EditMessageMediaParams): Promise<Message | true> {
    return this.request<Message | true>('editMessageMedia', params);
  }

  editMessageReplyMarkup(params: EditMessageReplyMarkupParams): Promise<Message | true> {
    return this.request<Message | true>('editMessageReplyMarkup', params);
  }

  stopPoll(params: { chat_id: number | string; message_id: number; business_connection_id?: string; reply_markup?: ReplyMarkup }): Promise<Poll> {
    return this.request<Poll>('stopPoll', params);
  }

  deleteMessage(params: DeleteMessageParams): Promise<true> {
    return this.request<true>('deleteMessage', params);
  }

  deleteMessages(params: DeleteMessagesParams): Promise<true> {
    return this.request<true>('deleteMessages', params);
  }

  pinChatMessage(params: PinChatMessageParams): Promise<true> {
    return this.request<true>('pinChatMessage', params);
  }

  unpinChatMessage(params: UnpinChatMessageParams): Promise<true> {
    return this.request<true>('unpinChatMessage', params);
  }

  unpinAllChatMessages(params: { chat_id: number | string; business_connection_id?: string }): Promise<true> {
    return this.request<true>('unpinAllChatMessages', params);
  }

  getFile(params: { file_id: string }): Promise<File> {
    return this.request<File>('getFile', params);
  }

  getUserProfilePhotos(params: GetUserProfilePhotosParams): Promise<UserProfilePhotos> {
    return this.request<UserProfilePhotos>('getUserProfilePhotos', params);
  }

  getChat(params: { chat_id: number | string }): Promise<ChatFullInfo> {
    return this.request<ChatFullInfo>('getChat', params);
  }

  getChatAdministrators(params: { chat_id: number | string }): Promise<ChatMember[]> {
    return this.request<ChatMember[]>('getChatAdministrators', params);
  }

  getChatMemberCount(params: { chat_id: number | string }): Promise<number> {
    return this.request<number>('getChatMemberCount', params);
  }

  getChatMember(params: { chat_id: number | string; user_id: number }): Promise<ChatMember> {
    return this.request<ChatMember>('getChatMember', params);
  }

  banChatMember(params: BanChatMemberParams): Promise<true> {
    return this.request<true>('banChatMember', params);
  }

  unbanChatMember(params: UnbanChatMemberParams): Promise<true> {
    return this.request<true>('unbanChatMember', params);
  }

  restrictChatMember(params: RestrictChatMemberParams): Promise<true> {
    return this.request<true>('restrictChatMember', params);
  }

  promoteChatMember(params: PromoteChatMemberParams): Promise<true> {
    return this.request<true>('promoteChatMember', params);
  }

  setChatAdministratorCustomTitle(params: { chat_id: number | string; user_id: number; custom_title: string }): Promise<true> {
    return this.request<true>('setChatAdministratorCustomTitle', params);
  }

  banChatSenderChat(params: { chat_id: number | string; sender_chat_id: number }): Promise<true> {
    return this.request<true>('banChatSenderChat', params);
  }

  unbanChatSenderChat(params: { chat_id: number | string; sender_chat_id: number }): Promise<true> {
    return this.request<true>('unbanChatSenderChat', params);
  }

  setChatPermissions(params: { chat_id: number | string; permissions: Record<string, boolean>; use_independent_chat_permissions?: boolean }): Promise<true> {
    return this.request<true>('setChatPermissions', params);
  }

  exportChatInviteLink(params: { chat_id: number | string }): Promise<string> {
    return this.request<string>('exportChatInviteLink', params);
  }

  createChatInviteLink(params: CreateChatInviteLinkParams): Promise<ChatInviteLink> {
    return this.request<ChatInviteLink>('createChatInviteLink', params);
  }

  editChatInviteLink(params: EditChatInviteLinkParams): Promise<ChatInviteLink> {
    return this.request<ChatInviteLink>('editChatInviteLink', params);
  }

  revokeChatInviteLink(params: RevokeChatInviteLinkParams): Promise<ChatInviteLink> {
    return this.request<ChatInviteLink>('revokeChatInviteLink', params);
  }

  approveChatJoinRequest(params: { chat_id: number | string; user_id: number }): Promise<true> {
    return this.request<true>('approveChatJoinRequest', params);
  }

  declineChatJoinRequest(params: { chat_id: number | string; user_id: number }): Promise<true> {
    return this.request<true>('declineChatJoinRequest', params);
  }

  setChatPhoto(params: { chat_id: number | string; photo: string }): Promise<true> {
    return this.request<true>('setChatPhoto', params);
  }

  deleteChatPhoto(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('deleteChatPhoto', params);
  }

  setChatTitle(params: { chat_id: number | string; title: string }): Promise<true> {
    return this.request<true>('setChatTitle', params);
  }

  setChatDescription(params: { chat_id: number | string; description?: string }): Promise<true> {
    return this.request<true>('setChatDescription', params);
  }

  leaveChat(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('leaveChat', params);
  }

  setMyCommands(params: SetMyCommandsParams): Promise<true> {
    return this.request<true>('setMyCommands', params);
  }

  getMyCommands(params?: GetMyCommandsParams): Promise<BotCommand[]> {
    return this.request<BotCommand[]>('getMyCommands', params);
  }

  deleteMyCommands(params?: DeleteMyCommandsParams): Promise<true> {
    return this.request<true>('deleteMyCommands', params);
  }

  getChatMenuButton(params?: { chat_id?: number }): Promise<MenuButton> {
    return this.request<MenuButton>('getChatMenuButton', params);
  }

  setChatMenuButton(params?: { chat_id?: number; menu_button?: MenuButton }): Promise<true> {
    return this.request<true>('setChatMenuButton', params);
  }

  setMyDefaultAdministratorRights(params?: { rights?: Record<string, boolean>; for_channels?: boolean }): Promise<true> {
    return this.request<true>('setMyDefaultAdministratorRights', params);
  }

  getMyDefaultAdministratorRights(params?: { for_channels?: boolean }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('getMyDefaultAdministratorRights', params);
  }

  answerCallbackQuery(params: AnswerCallbackQueryParams): Promise<true> {
    return this.request<true>('answerCallbackQuery', params);
  }

  answerInlineQuery(params: AnswerInlineQueryParams): Promise<true> {
    return this.request<true>('answerInlineQuery', params);
  }

  answerWebAppQuery(params: AnswerWebAppQueryParams): Promise<{ inline_message_id: string }> {
    return this.request<{ inline_message_id: string }>('answerWebAppQuery', params);
  }

  answerShippingQuery(params: AnswerShippingQueryParams): Promise<true> {
    return this.request<true>('answerShippingQuery', params);
  }

  answerPreCheckoutQuery(params: AnswerPreCheckoutQueryParams): Promise<true> {
    return this.request<true>('answerPreCheckoutQuery', params);
  }

  sendInvoice(params: SendInvoiceParams): Promise<Message> {
    return this.request<Message>('sendInvoice', params);
  }

  createInvoiceLink(params: CreateInvoiceLinkParams): Promise<string> {
    return this.request<string>('createInvoiceLink', params);
  }

  getStickerSet(params: { name: string }): Promise<StickerSet> {
    return this.request<StickerSet>('getStickerSet', params);
  }

  getCustomEmojiStickers(params: { custom_emoji_ids: string[] }): Promise<Sticker[]> {
    return this.request<Sticker[]>('getCustomEmojiStickers', params);
  }

  createNewStickerSet(params: CreateNewStickerSetParams): Promise<true> {
    return this.request<true>('createNewStickerSet', params);
  }

  addStickerToSet(params: AddStickerToSetParams): Promise<true> {
    return this.request<true>('addStickerToSet', params);
  }

  setStickerPositionInSet(params: { sticker: string; position: number }): Promise<true> {
    return this.request<true>('setStickerPositionInSet', params);
  }

  deleteStickerFromSet(params: { sticker: string }): Promise<true> {
    return this.request<true>('deleteStickerFromSet', params);
  }

  replaceStickerInSet(params: { user_id: number; name: string; old_sticker: string; sticker: InputSticker }): Promise<true> {
    return this.request<true>('replaceStickerInSet', params);
  }

  setStickerEmojiList(params: { sticker: string; emoji_list: string[] }): Promise<true> {
    return this.request<true>('setStickerEmojiList', params);
  }

  setStickerKeywords(params: { sticker: string; keywords?: string[] }): Promise<true> {
    return this.request<true>('setStickerKeywords', params);
  }

  setStickerMaskPosition(params: { sticker: string; mask_position?: Record<string, unknown> }): Promise<true> {
    return this.request<true>('setStickerMaskPosition', params);
  }

  setStickerSetTitle(params: { name: string; title: string }): Promise<true> {
    return this.request<true>('setStickerSetTitle', params);
  }

  setStickerSetThumbnail(params: { name: string; user_id: number; thumbnail?: string; format: string }): Promise<true> {
    return this.request<true>('setStickerSetThumbnail', params);
  }

  setCustomEmojiStickerSetThumbnail(params: { name: string; custom_emoji_id?: string }): Promise<true> {
    return this.request<true>('setCustomEmojiStickerSetThumbnail', params);
  }

  deleteStickerSet(params: { name: string }): Promise<true> {
    return this.request<true>('deleteStickerSet', params);
  }

  sendGame(params: SendGameParams): Promise<Message> {
    return this.request<Message>('sendGame', params);
  }

  setGameScore(params: SetGameScoreParams): Promise<Message | true> {
    return this.request<Message | true>('setGameScore', params);
  }

  getGameHighScores(params: GetGameHighScoresParams): Promise<GameHighScore[]> {
    return this.request<GameHighScore[]>('getGameHighScores', params);
  }

  createForumTopic(params: CreateForumTopicParams): Promise<ForumTopic> {
    return this.request<ForumTopic>('createForumTopic', params);
  }

  editForumTopic(params: EditForumTopicParams): Promise<true> {
    return this.request<true>('editForumTopic', params);
  }

  closeForumTopic(params: { chat_id: number | string; message_thread_id: number }): Promise<true> {
    return this.request<true>('closeForumTopic', params);
  }

  reopenForumTopic(params: { chat_id: number | string; message_thread_id: number }): Promise<true> {
    return this.request<true>('reopenForumTopic', params);
  }

  deleteForumTopic(params: { chat_id: number | string; message_thread_id: number }): Promise<true> {
    return this.request<true>('deleteForumTopic', params);
  }

  unpinAllForumTopicMessages(params: { chat_id: number | string; message_thread_id: number }): Promise<true> {
    return this.request<true>('unpinAllForumTopicMessages', params);
  }

  hideGeneralForumTopic(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('hideGeneralForumTopic', params);
  }

  unhideGeneralForumTopic(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('unhideGeneralForumTopic', params);
  }

  unpinAllGeneralForumTopicMessages(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('unpinAllGeneralForumTopicMessages', params);
  }

  setMyStarTransactionWithdrawalLimit(params: { daily_limit: number }): Promise<true> {
    return this.request<true>('setMyStarTransactionWithdrawalLimit', params);
  }

  getStarTransactions(params?: GetStarTransactionsParams): Promise<StarTransactions> {
    return this.request<StarTransactions>('getStarTransactions', params);
  }

  refundStarPayment(params: RefundStarPaymentParams): Promise<true> {
    return this.request<true>('refundStarPayment', params);
  }

  sendPaidMedia(params: SendPaidMediaParams): Promise<Message> {
    return this.request<Message>('sendPaidMedia', params);
  }

  getBusinessConnection(params: GetBusinessConnectionParams): Promise<BusinessConnection> {
    return this.request<BusinessConnection>('getBusinessConnection', params);
  }

  setChatStickerSet(params: SetChatStickerSetParams): Promise<true> {
    return this.request<true>('setChatStickerSet', params);
  }

  deleteChatStickerSet(params: DeleteChatStickerSetParams): Promise<true> {
    return this.request<true>('deleteChatStickerSet', params);
  }

  createChatSubscriptionInviteLink(params: CreateChatSubscriptionInviteLinkParams): Promise<ChatInviteLink> {
    return this.request<ChatInviteLink>('createChatSubscriptionInviteLink', params);
  }

  editChatSubscriptionInviteLink(params: EditChatSubscriptionInviteLinkParams): Promise<ChatInviteLink> {
    return this.request<ChatInviteLink>('editChatSubscriptionInviteLink', params);
  }

  getAvailableGifts(_params?: GetAvailableGiftsParams): Promise<Gifts> {
    return this.request<Gifts>('getAvailableGifts');
  }

  sendGift(params: SendGiftParams): Promise<true> {
    return this.request<true>('sendGift', params);
  }

  setUserEmojiStatus(params: SetUserEmojiStatusParams): Promise<true> {
    return this.request<true>('setUserEmojiStatus', params);
  }

  verifyUser(params: VerifyUserParams): Promise<true> {
    return this.request<true>('verifyUser', params);
  }

  removeUserVerification(params: RemoveUserVerificationParams): Promise<true> {
    return this.request<true>('removeUserVerification', params);
  }

  verifyChat(params: VerifyChatParams): Promise<true> {
    return this.request<true>('verifyChat', params);
  }

  removeChatVerification(params: RemoveChatVerificationParams): Promise<true> {
    return this.request<true>('removeChatVerification', params);
  }

  readBusinessMessage(params: ReadBusinessMessageParams): Promise<true> {
    return this.request<true>('readBusinessMessage', params);
  }

  deleteBusinessMessages(params: DeleteBusinessMessagesParams): Promise<true> {
    return this.request<true>('deleteBusinessMessages', params);
  }

  allowUserMessages(params: AllowUserMessagesParams): Promise<true> {
    return this.request<true>('allowUserMessages', params);
  }

  disallowUserMessages(params: DisallowUserMessagesParams): Promise<true> {
    return this.request<true>('disallowUserMessages', params);
  }

  getUserChatBoosts(params: GetUserChatBoostsParams): Promise<UserChatBoosts> {
    return this.request<UserChatBoosts>('getUserChatBoosts', params);
  }

  savePreparedInlineMessage(params: SavePreparedInlineMessageParams): Promise<PreparedInlineMessage> {
    return this.request<PreparedInlineMessage>('savePreparedInlineMessage', params);
  }

  getFileDownloadUrl(filePath: string): string {
    const [base, tokenPart] = this.apiBase.split('/bot');
    return `${base}/file/bot${tokenPart}/${filePath}`;
  }

  async getFileWithUrl(fileId: string): Promise<File & { downloadUrl: string }> {
    const file = await this.getFile({ file_id: fileId });
    const downloadUrl = file.file_path ? this.getFileDownloadUrl(file.file_path) : '';
    return { ...file, downloadUrl };
  }

  editMessageLiveLocation(params: Record<string, unknown>): Promise<Message | true> {
    return this.request<Message | true>('editMessageLiveLocation', params);
  }

  stopMessageLiveLocation(params: Record<string, unknown>): Promise<Message | true> {
    return this.request<Message | true>('stopMessageLiveLocation', params);
  }

  sendChecklist(params: Record<string, unknown>): Promise<Message> {
    return this.request<Message>('sendChecklist', params);
  }

  editMessageChecklist(params: Record<string, unknown>): Promise<Message | true> {
    return this.request<Message | true>('editMessageChecklist', params);
  }

  uploadStickerFile(params: {
    user_id: number;
    sticker: unknown;
    sticker_format: 'static' | 'animated' | 'video';
  }): Promise<File> {
    return this.request<File>('uploadStickerFile', params);
  }

  setPassportDataErrors(params: {
    user_id: number;
    errors: Array<Record<string, unknown>>;
  }): Promise<true> {
    return this.request<true>('setPassportDataErrors', params);
  }

  getForumTopicIconStickers(): Promise<Sticker[]> {
    return this.request<Sticker[]>('getForumTopicIconStickers');
  }

  editGeneralForumTopic(params: { chat_id: number | string; name: string }): Promise<true> {
    return this.request<true>('editGeneralForumTopic', params);
  }

  closeGeneralForumTopic(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('closeGeneralForumTopic', params);
  }

  reopenGeneralForumTopic(params: { chat_id: number | string }): Promise<true> {
    return this.request<true>('reopenGeneralForumTopic', params);
  }

  editUserStarSubscription(params: {
    user_id: number;
    telegram_payment_charge_id: string;
    is_canceled: boolean;
  }): Promise<true> {
    return this.request<true>('editUserStarSubscription', params);
  }

  getBusinessAccountGifts(params: {
    business_connection_id: string;
    exclude_unsaved?: boolean;
    exclude_saved?: boolean;
    exclude_unlimited?: boolean;
    exclude_limited?: boolean;
    exclude_unique?: boolean;
    sort_by_price?: boolean;
    offset?: string;
    limit?: number;
  }): Promise<unknown> {
    return this.request('getBusinessAccountGifts', params);
  }

  getBusinessAccountStarBalance(params: {
    business_connection_id: string;
  }): Promise<{ amount: number }> {
    return this.request<{ amount: number }>('getBusinessAccountStarBalance', params);
  }

  convertGiftToStars(params: {
    business_connection_id: string;
    owned_gift_id: string;
  }): Promise<true> {
    return this.request<true>('convertGiftToStars', params);
  }

  upgradeGift(params: {
    business_connection_id: string;
    owned_gift_id: string;
    keep_original_details?: boolean;
    star_count?: number;
  }): Promise<true> {
    return this.request<true>('upgradeGift', params);
  }

  transferGift(params: {
    business_connection_id: string;
    owned_gift_id: string;
    new_owner_chat_id: number;
    star_count?: number;
  }): Promise<true> {
    return this.request<true>('transferGift', params);
  }

  transferBusinessAccountStars(params: {
    business_connection_id: string;
    star_count: number;
  }): Promise<true> {
    return this.request<true>('transferBusinessAccountStars', params);
  }

  setBusinessAccountName(params: {
    business_connection_id: string;
    first_name: string;
    last_name?: string;
  }): Promise<true> {
    return this.request<true>('setBusinessAccountName', params);
  }

  setBusinessAccountUsername(params: {
    business_connection_id: string;
    username?: string;
  }): Promise<true> {
    return this.request<true>('setBusinessAccountUsername', params);
  }

  setBusinessAccountBio(params: {
    business_connection_id: string;
    bio?: string;
  }): Promise<true> {
    return this.request<true>('setBusinessAccountBio', params);
  }

  setBusinessAccountProfilePhoto(params: {
    business_connection_id: string;
    photo: unknown;
    is_public?: boolean;
  }): Promise<true> {
    return this.request<true>('setBusinessAccountProfilePhoto', params);
  }

  removeBusinessAccountProfilePhoto(params: {
    business_connection_id: string;
    is_public?: boolean;
  }): Promise<true> {
    return this.request<true>('removeBusinessAccountProfilePhoto', params);
  }

  setBusinessAccountGiftSettings(params: {
    business_connection_id: string;
    show_gift_button: boolean;
    accepted_gift_types: Record<string, boolean>;
  }): Promise<true> {
    return this.request<true>('setBusinessAccountGiftSettings', params);
  }

  postStory(params: Record<string, unknown>): Promise<unknown> {
    return this.request('postStory', params);
  }

  editStory(params: Record<string, unknown>): Promise<unknown> {
    return this.request('editStory', params);
  }

  deleteStory(params: {
    business_connection_id: string;
    story_id: number;
  }): Promise<true> {
    return this.request<true>('deleteStory', params);
  }

  callMethod<T = unknown>(method: string, params?: unknown): Promise<T> {
    return this.request<T>(method, params);
  }

  sendLivePhoto(params: SendLivePhotoParams): Promise<Message> {
    return this.request<Message>('sendLivePhoto', params);
  }

  sendMessageDraft(params: SendMessageDraftParams): Promise<true> {
    return this.request<true>('sendMessageDraft', params);
  }

  getUserProfileAudios(params: GetUserProfileAudiosParams): Promise<UserProfileAudios> {
    return this.request<UserProfileAudios>('getUserProfileAudios', params);
  }

  setChatMemberTag(params: SetChatMemberTagParams): Promise<true> {
    return this.request<true>('setChatMemberTag', params);
  }

  answerChatJoinRequestQuery(params: AnswerChatJoinRequestQueryParams): Promise<true> {
    return this.request<true>('answerChatJoinRequestQuery', params);
  }

  sendChatJoinRequestWebApp(params: SendChatJoinRequestWebAppParams): Promise<true> {
    return this.request<true>('sendChatJoinRequestWebApp', params);
  }

  getUserPersonalChatMessages(params: GetUserPersonalChatMessagesParams): Promise<Message[]> {
    return this.request<Message[]>('getUserPersonalChatMessages', params);
  }

  answerGuestQuery(params: AnswerGuestQueryParams): Promise<SentGuestMessage> {
    return this.request<SentGuestMessage>('answerGuestQuery', params);
  }

  getManagedBotToken(params: GetManagedBotTokenParams): Promise<string> {
    return this.request<string>('getManagedBotToken', params);
  }

  replaceManagedBotToken(params: ReplaceManagedBotTokenParams): Promise<string> {
    return this.request<string>('replaceManagedBotToken', params);
  }

  getManagedBotAccessSettings(params: GetManagedBotAccessSettingsParams): Promise<BotAccessSettings> {
    return this.request<BotAccessSettings>('getManagedBotAccessSettings', params);
  }

  setManagedBotAccessSettings(params: SetManagedBotAccessSettingsParams): Promise<true> {
    return this.request<true>('setManagedBotAccessSettings', params);
  }

  setMyProfilePhoto(params: SetMyProfilePhotoParams): Promise<true> {
    return this.request<true>('setMyProfilePhoto', params);
  }

  removeMyProfilePhoto(params?: RemoveMyProfilePhotoParams): Promise<true> {
    return this.request<true>('removeMyProfilePhoto', params);
  }

  giftPremiumSubscription(params: GiftPremiumSubscriptionParams): Promise<true> {
    return this.request<true>('giftPremiumSubscription', params);
  }

  getUserGifts(params: GetUserGiftsParams): Promise<OwnedGifts> {
    return this.request<OwnedGifts>('getUserGifts', params);
  }

  getChatGifts(params: GetChatGiftsParams): Promise<OwnedGifts> {
    return this.request<OwnedGifts>('getChatGifts', params);
  }

  repostStory(params: RepostStoryParams): Promise<true> {
    return this.request<true>('repostStory', params);
  }

  savePreparedKeyboardButton(params: SavePreparedKeyboardButtonParams): Promise<PreparedKeyboardButton> {
    return this.request<PreparedKeyboardButton>('savePreparedKeyboardButton', params);
  }

  editEphemeralMessageText(params: EditEphemeralMessageTextParams): Promise<true> {
    return this.request<true>('editEphemeralMessageText', params);
  }

  editEphemeralMessageMedia(params: EditEphemeralMessageMediaParams): Promise<true> {
    return this.request<true>('editEphemeralMessageMedia', params);
  }

  editEphemeralMessageCaption(params: EditEphemeralMessageCaptionParams): Promise<true> {
    return this.request<true>('editEphemeralMessageCaption', params);
  }

  editEphemeralMessageReplyMarkup(params: EditEphemeralMessageReplyMarkupParams): Promise<true> {
    return this.request<true>('editEphemeralMessageReplyMarkup', params);
  }

  approveSuggestedPost(params: ApproveSuggestedPostParams): Promise<true> {
    return this.request<true>('approveSuggestedPost', params);
  }

  declineSuggestedPost(params: DeclineSuggestedPostParams): Promise<true> {
    return this.request<true>('declineSuggestedPost', params);
  }

  deleteEphemeralMessage(params: DeleteEphemeralMessageParams): Promise<true> {
    return this.request<true>('deleteEphemeralMessage', params);
  }

  deleteMessageReaction(params: DeleteMessageReactionParams): Promise<true> {
    return this.request<true>('deleteMessageReaction', params);
  }

  deleteAllMessageReactions(params: DeleteAllMessageReactionsParams): Promise<true> {
    return this.request<true>('deleteAllMessageReactions', params);
  }

  sendRichMessage(params: SendRichMessageParams): Promise<Message> {
    return this.request<Message>('sendRichMessage', params);
  }

  sendRichMessageDraft(params: SendRichMessageDraftParams): Promise<true> {
    return this.request<true>('sendRichMessageDraft', params);
  }

  getMyStarBalance(params?: GetMyStarBalanceParams): Promise<StarAmount> {
    return this.request<StarAmount>('getMyStarBalance', params);
  }
}
