export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
  can_connect_to_business?: boolean;
  has_main_web_app?: boolean;
}

export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export interface Chat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
}

export interface ChatFullInfo extends Chat {
  photo?: ChatPhoto;
  active_usernames?: string[];
  available_reactions?: ReactionType[];
  accent_color_id?: number;
  max_reaction_count?: number;
  bio?: string;
  has_private_forwards?: boolean;
  has_restricted_voice_and_video_messages?: boolean;
  join_to_send_messages?: boolean;
  join_by_request?: boolean;
  description?: string;
  invite_link?: string;
  pinned_message?: Message;
  permissions?: ChatPermissions;
  slow_mode_delay?: number;
  unrestrict_boost_count?: number;
  message_auto_delete_time?: number;
  has_aggressive_anti_spam_enabled?: boolean;
  has_hidden_members?: boolean;
  has_protected_content?: boolean;
  has_visible_history?: boolean;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  custom_emoji_sticker_set_name?: string;
  linked_chat_id?: number;
  location?: ChatLocation;
  background_custom_emoji_id?: string;
  profile_accent_color_id?: number;
  profile_background_custom_emoji_id?: string;
  emoji_status_custom_emoji_id?: string;
  emoji_status_expiration_date?: number;
  business_intro?: BusinessIntro;
  business_location?: BusinessLocation;
  business_opening_hours?: BusinessOpeningHours;
  personal_chat?: Chat;
  birthdate?: Birthdate;
}

export interface Message {
  message_id: number;
  message_thread_id?: number;
  from?: User;
  sender_chat?: Chat;
  sender_boost_count?: number;
  sender_business_bot?: User;
  date: number;
  business_connection_id?: string;
  chat: Chat;
  forward_origin?: MessageOrigin;
  is_topic_message?: boolean;
  is_automatic_forward?: boolean;
  reply_to_message?: Message;
  external_reply?: ExternalReplyInfo;
  quote?: TextQuote;
  reply_to_story?: Story;
  via_bot?: User;
  edit_date?: number;
  has_protected_content?: boolean;
  is_from_offline?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
  effect_id?: string;
  animation?: Animation;
  audio?: Audio;
  document?: Document;
  paid_media?: PaidMediaInfo;
  photo?: PhotoSize[];
  sticker?: Sticker;
  story?: Story;
  video?: Video;
  video_note?: VideoNote;
  voice?: Voice;
  caption?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_media_spoiler?: boolean;
  contact?: Contact;
  dice?: Dice;
  game?: Game;
  poll?: Poll;
  venue?: Venue;
  location?: Location;
  new_chat_members?: User[];
  left_chat_member?: User;
  new_chat_title?: string;
  new_chat_photo?: PhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: Message;
  invoice?: Invoice;
  successful_payment?: SuccessfulPayment;
  refunded_payment?: RefundedPayment;
  users_shared?: UsersShared;
  chat_shared?: ChatShared;
  web_app_data?: WebAppData;
  giveaway_created?: GiveawayCreated;
  giveaway?: Giveaway;
  giveaway_winners?: GiveawayWinners;
  giveaway_completed?: GiveawayCompleted;
  boost_added?: ChatBoostAdded;
  chat_background_set?: ChatBackground;
  proximity_alert_triggered?: ProximityAlertTriggered;
  video_chat_scheduled?: VideoChatScheduled;
  video_chat_started?: VideoChatStarted;
  video_chat_ended?: VideoChatEnded;
  video_chat_participants_invited?: VideoChatParticipantsInvited;
  forum_topic_created?: ForumTopicCreated;
  forum_topic_edited?: ForumTopicEdited;
  forum_topic_closed?: ForumTopicClosed;
  forum_topic_reopened?: ForumTopicReopened;
  general_forum_topic_hidden?: GeneralForumTopicHidden;
  general_forum_topic_unhidden?: GeneralForumTopicUnhidden;
  message_auto_delete_timer_changed?: MessageAutoDeleteTimerChanged;
  write_access_allowed?: WriteAccessAllowed;
  connected_website?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface MessageId {
  message_id: number;
}

export interface MessageEntity {
  type:
    | 'mention'
    | 'hashtag'
    | 'cashtag'
    | 'bot_command'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'spoiler'
    | 'blockquote'
    | 'expandable_blockquote'
    | 'code'
    | 'pre'
    | 'text_link'
    | 'text_mention'
    | 'custom_emoji';
  offset: number;
  length: number;
  url?: string;
  user?: User;
  language?: string;
  custom_emoji_id?: string;
}

export interface PhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface Audio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: PhotoSize;
}

export interface Document {
  file_id: string;
  file_unique_id: string;
  thumbnail?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface Video {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: PhotoSize;
  cover?: PhotoSize[];
  start_timestamp?: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface Animation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface Voice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface VideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  thumbnail?: PhotoSize;
  file_size?: number;
}

export interface Sticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  thumbnail?: PhotoSize;
  emoji?: string;
  set_name?: string;
  premium_animation?: File;
  mask_position?: MaskPosition;
  custom_emoji_id?: string;
  needs_repainting?: boolean;
  file_size?: number;
}

export interface MaskPosition {
  point: 'forehead' | 'eyes' | 'mouth' | 'chin';
  x_shift: number;
  y_shift: number;
  scale: number;
}

export interface StickerSet {
  name: string;
  title: string;
  sticker_type: 'regular' | 'mask' | 'custom_emoji';
  stickers: Sticker[];
  thumbnail?: PhotoSize;
}

export interface Contact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface Location {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface Venue {
  location: Location;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
}

export interface Dice {
  emoji: string;
  value: number;
}

export interface Poll {
  id: string;
  question: string;
  question_entities?: MessageEntity[];
  options: PollOption[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: 'regular' | 'quiz';
  allows_multiple_answers: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_entities?: MessageEntity[];
  open_period?: number;
  close_date?: number;
}

export interface PollOption {
  text: string;
  text_entities?: MessageEntity[];
  voter_count: number;
}

export interface File {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface UserProfilePhotos {
  total_count: number;
  photos: PhotoSize[][];
}

export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  channel_post?: Message;
  edited_channel_post?: Message;
  business_connection?: BusinessConnection;
  business_message?: Message;
  edited_business_message?: Message;
  deleted_business_messages?: BusinessMessagesDeleted;
  message_reaction?: MessageReactionUpdated;
  message_reaction_count?: MessageReactionCountUpdated;
  inline_query?: InlineQuery;
  chosen_inline_result?: ChosenInlineResult;
  callback_query?: CallbackQuery;
  shipping_query?: ShippingQuery;
  pre_checkout_query?: PreCheckoutQuery;
  purchased_paid_media?: PaidMediaPurchased;
  poll?: Poll;
  poll_answer?: PollAnswer;
  my_chat_member?: ChatMemberUpdated;
  chat_member?: ChatMemberUpdated;
  chat_join_request?: ChatJoinRequest;
  chat_boost?: ChatBoostUpdated;
  removed_chat_boost?: ChatBoostRemoved;
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface CallbackQuery {
  id: string;
  from: User;
  message?: Message;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface InlineQuery {
  id: string;
  from: User;
  query: string;
  offset: string;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  location?: Location;
}

export interface ChosenInlineResult {
  result_id: string;
  from: User;
  location?: Location;
  inline_message_id?: string;
  query: string;
}

export interface ShippingQuery {
  id: string;
  from: User;
  invoice_payload: string;
  shipping_address: ShippingAddress;
}

export interface PreCheckoutQuery {
  id: string;
  from: User;
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: OrderInfo;
}

export interface PollAnswer {
  poll_id: string;
  voter_chat?: Chat;
  user?: User;
  option_ids: number[];
}

export interface ChatMemberUpdated {
  chat: Chat;
  from: User;
  date: number;
  old_chat_member: ChatMember;
  new_chat_member: ChatMember;
  invite_link?: ChatInviteLink;
  via_join_request?: boolean;
  via_chat_folder_invite_link?: boolean;
}

export type ChatMember =
  | ChatMemberOwner
  | ChatMemberAdministrator
  | ChatMemberMember
  | ChatMemberRestricted
  | ChatMemberLeft
  | ChatMemberBanned;

export interface ChatMemberOwner {
  status: 'creator';
  user: User;
  is_anonymous: boolean;
  custom_title?: string;
}

export interface ChatMemberAdministrator {
  status: 'administrator';
  user: User;
  can_be_edited: boolean;
  is_anonymous: boolean;
  can_manage_chat: boolean;
  can_delete_messages: boolean;
  can_manage_video_chats: boolean;
  can_restrict_members: boolean;
  can_promote_members: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_post_stories: boolean;
  can_edit_stories: boolean;
  can_delete_stories: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  custom_title?: string;
}

export interface ChatMemberMember {
  status: 'member';
  user: User;
  until_date?: number;
}

export interface ChatMemberRestricted {
  status: 'restricted';
  user: User;
  is_member: boolean;
  can_send_messages: boolean;
  can_send_audios: boolean;
  can_send_documents: boolean;
  can_send_photos: boolean;
  can_send_videos: boolean;
  can_send_video_notes: boolean;
  can_send_voice_notes: boolean;
  can_send_polls: boolean;
  can_send_other_messages: boolean;
  can_add_web_page_previews: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_pin_messages: boolean;
  can_manage_topics: boolean;
  until_date: number;
}

export interface ChatMemberLeft {
  status: 'left';
  user: User;
}

export interface ChatMemberBanned {
  status: 'kicked';
  user: User;
  until_date: number;
}

export interface ChatJoinRequest {
  chat: Chat;
  from: User;
  user_chat_id: number;
  date: number;
  bio?: string;
  invite_link?: ChatInviteLink;
}

export interface ChatPhoto {
  small_file_id: string;
  small_file_unique_id: string;
  big_file_id: string;
  big_file_unique_id: string;
}

export interface ChatInviteLink {
  invite_link: string;
  creator: User;
  creates_join_request: boolean;
  is_primary: boolean;
  is_revoked: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
  subscription_period?: number;
  subscription_price?: number;
}

export interface ChatPermissions {
  can_send_messages?: boolean;
  can_send_audios?: boolean;
  can_send_documents?: boolean;
  can_send_photos?: boolean;
  can_send_videos?: boolean;
  can_send_video_notes?: boolean;
  can_send_voice_notes?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
}

export interface ChatLocation {
  location: Location;
  address: string;
}

export interface ChatAdministratorRights {
  is_anonymous?: boolean;
  can_manage_chat?: boolean;
  can_delete_messages?: boolean;
  can_manage_video_chats?: boolean;
  can_restrict_members?: boolean;
  can_promote_members?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_post_stories?: boolean;
  can_edit_stories?: boolean;
  can_delete_stories?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: WebAppInfo;
  login_url?: LoginUrl;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  switch_inline_query_chosen_chat?: SwitchInlineQueryChosenChat;
  copy_text?: CopyTextButton;
  callback_game?: CallbackGame;
  pay?: boolean;
}

export interface WebAppInfo {
  url: string;
}

export interface LoginUrl {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_access?: boolean;
}

export interface SwitchInlineQueryChosenChat {
  query?: string;
  allow_user_chats?: boolean;
  allow_bot_chats?: boolean;
  allow_group_chats?: boolean;
  allow_channel_chats?: boolean;
}

export interface CopyTextButton {
  text: string;
}

export interface CallbackGame {}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  is_persistent?: boolean;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface KeyboardButton {
  text: string;
  request_users?: KeyboardButtonRequestUsers;
  request_chat?: KeyboardButtonRequestChat;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: KeyboardButtonPollType;
  web_app?: WebAppInfo;
}

export interface KeyboardButtonRequestUsers {
  request_id: number;
  user_is_bot?: boolean;
  user_is_premium?: boolean;
  max_quantity?: number;
  request_name?: boolean;
  request_username?: boolean;
  request_photo?: boolean;
}

export interface KeyboardButtonRequestChat {
  request_id: number;
  chat_is_channel: boolean;
  chat_is_forum?: boolean;
  chat_has_username?: boolean;
  chat_is_created?: boolean;
  user_administrator_rights?: ChatAdministratorRights;
  bot_administrator_rights?: ChatAdministratorRights;
  bot_is_member?: boolean;
  request_title?: boolean;
  request_username?: boolean;
  request_photo?: boolean;
}

export interface KeyboardButtonPollType {
  type?: 'quiz' | 'regular';
}

export interface ReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export interface ForceReply {
  force_reply: true;
  input_field_placeholder?: string;
  selective?: boolean;
}

export type ReplyMarkup =
  | InlineKeyboardMarkup
  | ReplyKeyboardMarkup
  | ReplyKeyboardRemove
  | ForceReply;

export interface ReplyParameters {
  message_id: number;
  chat_id?: number | string;
  allow_sending_without_reply?: boolean;
  quote?: string;
  quote_parse_mode?: string;
  quote_entities?: MessageEntity[];
  quote_position?: number;
}

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface BotCommand {
  command: string;
  description: string;
}

export type BotCommandScope =
  | BotCommandScopeDefault
  | BotCommandScopeAllPrivateChats
  | BotCommandScopeAllGroupChats
  | BotCommandScopeAllChatAdministrators
  | BotCommandScopeChat
  | BotCommandScopeChatAdministrators
  | BotCommandScopeChatMember;

export interface BotCommandScopeDefault { type: 'default'; }
export interface BotCommandScopeAllPrivateChats { type: 'all_private_chats'; }
export interface BotCommandScopeAllGroupChats { type: 'all_group_chats'; }
export interface BotCommandScopeAllChatAdministrators { type: 'all_chat_administrators'; }
export interface BotCommandScopeChat { type: 'chat'; chat_id: number | string; }
export interface BotCommandScopeChatAdministrators { type: 'chat_administrators'; chat_id: number | string; }
export interface BotCommandScopeChatMember { type: 'chat_member'; chat_id: number | string; user_id: number; }

export type MenuButton = MenuButtonCommands | MenuButtonWebApp | MenuButtonDefault;
export interface MenuButtonCommands { type: 'commands'; }
export interface MenuButtonWebApp { type: 'web_app'; text: string; web_app: WebAppInfo; }
export interface MenuButtonDefault { type: 'default'; }

export interface BotDescription { description: string; }
export interface BotShortDescription { short_description: string; }
export interface BotName { name: string; }

export type ReactionType = ReactionTypeEmoji | ReactionTypeCustomEmoji | ReactionTypePaid;
export interface ReactionTypeEmoji { type: 'emoji'; emoji: string; }
export interface ReactionTypeCustomEmoji { type: 'custom_emoji'; custom_emoji_id: string; }
export interface ReactionTypePaid { type: 'paid'; }

export interface MessageReactionUpdated {
  chat: Chat;
  message_id: number;
  user?: User;
  actor_chat?: Chat;
  date: number;
  old_reaction: ReactionType[];
  new_reaction: ReactionType[];
}

export interface MessageReactionCountUpdated {
  chat: Chat;
  message_id: number;
  date: number;
  reactions: ReactionCount[];
}

export interface ReactionCount {
  type: ReactionType;
  total_count: number;
}

export interface Invoice {
  title: string;
  description: string;
  start_parameter: string;
  currency: string;
  total_amount: number;
}

export interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  subscription_expiration_date?: number;
  is_recurring?: boolean;
  is_first_recurring?: boolean;
  shipping_option_id?: string;
  order_info?: OrderInfo;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export interface RefundedPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id?: string;
}

export interface OrderInfo {
  name?: string;
  phone_number?: string;
  email?: string;
  shipping_address?: ShippingAddress;
}

export interface ShippingAddress {
  country_code: string;
  state: string;
  city: string;
  street_line1: string;
  street_line2: string;
  post_code: string;
}

export interface ShippingOption {
  id: string;
  title: string;
  prices: LabeledPrice[];
}

export interface LabeledPrice {
  label: string;
  amount: number;
}

export interface PaidMediaInfo {
  star_count: number;
  paid_media: PaidMedia[];
}

export type PaidMedia = PaidMediaPreview | PaidMediaPhoto | PaidMediaVideo;
export interface PaidMediaPreview { type: 'preview'; width?: number; height?: number; duration?: number; }
export interface PaidMediaPhoto { type: 'photo'; photo: PhotoSize[]; }
export interface PaidMediaVideo { type: 'video'; video: Video; }

export interface PaidMediaPurchased {
  from: User;
  paid_media_payload: string;
}

export interface Game {
  title: string;
  description: string;
  photo: PhotoSize[];
  text?: string;
  text_entities?: MessageEntity[];
  animation?: Animation;
}

export interface GameHighScore {
  position: number;
  user: User;
  score: number;
}

export interface Story {
  chat: Chat;
  id: number;
}

export interface BusinessConnection {
  id: string;
  user: User;
  user_chat_id: number;
  date: number;
  can_reply: boolean;
  is_enabled: boolean;
}

export interface BusinessMessagesDeleted {
  business_connection_id: string;
  chat: Chat;
  message_ids: number[];
}

export interface ExternalReplyInfo {
  origin: MessageOrigin;
  chat?: Chat;
  message_id?: number;
  link_preview_options?: LinkPreviewOptions;
  animation?: Animation;
  audio?: Audio;
  document?: Document;
  paid_media?: PaidMediaInfo;
  photo?: PhotoSize[];
  sticker?: Sticker;
  story?: Story;
  video?: Video;
  video_note?: VideoNote;
  voice?: Voice;
  has_media_spoiler?: boolean;
  contact?: Contact;
  dice?: Dice;
  game?: Game;
  invoice?: Invoice;
  location?: Location;
  poll?: Poll;
  venue?: Venue;
}

export interface TextQuote {
  text: string;
  entities?: MessageEntity[];
  position: number;
  is_manual?: boolean;
}

export type MessageOrigin =
  | MessageOriginUser
  | MessageOriginHiddenUser
  | MessageOriginChat
  | MessageOriginChannel;

export interface MessageOriginUser { type: 'user'; date: number; sender_user: User; }
export interface MessageOriginHiddenUser { type: 'hidden_user'; date: number; sender_user_name: string; }
export interface MessageOriginChat { type: 'chat'; date: number; sender_chat: Chat; author_signature?: string; }
export interface MessageOriginChannel { type: 'channel'; date: number; chat: Chat; message_id: number; author_signature?: string; }

export interface ChatBoostUpdated { chat: Chat; boost: ChatBoost; }
export interface ChatBoostRemoved { chat: Chat; boost_id: string; remove_date: number; source: ChatBoostSource; }
export interface ChatBoost { boost_id: string; add_date: number; expiration_date: number; source: ChatBoostSource; }
export type ChatBoostSource = ChatBoostSourcePremium | ChatBoostSourceGiftCode | ChatBoostSourceGiveaway;
export interface ChatBoostSourcePremium { source: 'premium'; user: User; }
export interface ChatBoostSourceGiftCode { source: 'gift_code'; user: User; }
export interface ChatBoostSourceGiveaway { source: 'giveaway'; giveaway_message_id: number; user?: User; prize_star_count?: number; is_unclaimed?: boolean; }

export interface InlineQueryResultsButton {
  text: string;
  web_app?: WebAppInfo;
  start_parameter?: string;
}

export type InlineQueryResult =
  | InlineQueryResultArticle
  | InlineQueryResultPhoto
  | InlineQueryResultGif
  | InlineQueryResultMpeg4Gif
  | InlineQueryResultVideo
  | InlineQueryResultAudio
  | InlineQueryResultVoice
  | InlineQueryResultDocument
  | InlineQueryResultLocation
  | InlineQueryResultVenue
  | InlineQueryResultContact
  | InlineQueryResultGame
  | InlineQueryResultCachedPhoto
  | InlineQueryResultCachedGif
  | InlineQueryResultCachedMpeg4Gif
  | InlineQueryResultCachedSticker
  | InlineQueryResultCachedDocument
  | InlineQueryResultCachedVideo
  | InlineQueryResultCachedVoice
  | InlineQueryResultCachedAudio;

export interface InlineQueryResultBase {
  id: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface InputMessageContent {
  message_text?: string;
  parse_mode?: string;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
}

export interface InlineQueryResultArticle extends InlineQueryResultBase {
  type: 'article';
  title: string;
  input_message_content: InputMessageContent;
  url?: string;
  hide_url?: boolean;
  description?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface InlineQueryResultPhoto extends InlineQueryResultBase {
  type: 'photo';
  photo_url: string;
  thumbnail_url: string;
  photo_width?: number;
  photo_height?: number;
  title?: string;
  description?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultGif extends InlineQueryResultBase {
  type: 'gif';
  gif_url: string;
  gif_width?: number;
  gif_height?: number;
  gif_duration?: number;
  thumbnail_url: string;
  thumbnail_mime_type?: string;
  title?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultMpeg4Gif extends InlineQueryResultBase {
  type: 'mpeg4_gif';
  mpeg4_url: string;
  mpeg4_width?: number;
  mpeg4_height?: number;
  mpeg4_duration?: number;
  thumbnail_url: string;
  thumbnail_mime_type?: string;
  title?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultVideo extends InlineQueryResultBase {
  type: 'video';
  video_url: string;
  mime_type: string;
  thumbnail_url: string;
  title: string;
  caption?: string;
  parse_mode?: string;
  video_width?: number;
  video_height?: number;
  video_duration?: number;
  description?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultAudio extends InlineQueryResultBase {
  type: 'audio';
  audio_url: string;
  title: string;
  caption?: string;
  parse_mode?: string;
  performer?: string;
  audio_duration?: number;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultVoice extends InlineQueryResultBase {
  type: 'voice';
  voice_url: string;
  title: string;
  caption?: string;
  parse_mode?: string;
  voice_duration?: number;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultDocument extends InlineQueryResultBase {
  type: 'document';
  title: string;
  caption?: string;
  parse_mode?: string;
  document_url: string;
  mime_type: string;
  description?: string;
  input_message_content?: InputMessageContent;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface InlineQueryResultLocation extends InlineQueryResultBase {
  type: 'location';
  latitude: number;
  longitude: number;
  title: string;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
  input_message_content?: InputMessageContent;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface InlineQueryResultVenue extends InlineQueryResultBase {
  type: 'venue';
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
  input_message_content?: InputMessageContent;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface InlineQueryResultContact extends InlineQueryResultBase {
  type: 'contact';
  phone_number: string;
  first_name: string;
  last_name?: string;
  vcard?: string;
  input_message_content?: InputMessageContent;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
}

export interface InlineQueryResultGame extends InlineQueryResultBase {
  type: 'game';
  game_short_name: string;
}

export interface InlineQueryResultCachedPhoto extends InlineQueryResultBase {
  type: 'photo';
  photo_file_id: string;
  title?: string;
  description?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedGif extends InlineQueryResultBase {
  type: 'gif';
  gif_file_id: string;
  title?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedMpeg4Gif extends InlineQueryResultBase {
  type: 'mpeg4_gif';
  mpeg4_file_id: string;
  title?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedSticker extends InlineQueryResultBase {
  type: 'sticker';
  sticker_file_id: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedDocument extends InlineQueryResultBase {
  type: 'document';
  title: string;
  document_file_id: string;
  description?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedVideo extends InlineQueryResultBase {
  type: 'video';
  video_file_id: string;
  title: string;
  description?: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedVoice extends InlineQueryResultBase {
  type: 'voice';
  voice_file_id: string;
  title: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedAudio extends InlineQueryResultBase {
  type: 'audio';
  audio_file_id: string;
  caption?: string;
  parse_mode?: string;
  input_message_content?: InputMessageContent;
}

export interface SendCommonParams {
  chat_id: number | string;
  message_thread_id?: number;
  business_connection_id?: string;
  disable_notification?: boolean;
  protect_content?: boolean;
  allow_paid_broadcast?: boolean;
  reply_parameters?: ReplyParameters;
  reply_markup?: ReplyMarkup;
  message_effect_id?: string;
}

export interface SendMessageParams extends SendCommonParams {
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
}

export interface SendPhotoParams extends SendCommonParams {
  photo: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
}

export interface SendAudioParams extends SendCommonParams {
  audio: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  duration?: number;
  performer?: string;
  title?: string;
  thumbnail?: string;
}

export interface SendDocumentParams extends SendCommonParams {
  document: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  disable_content_type_detection?: boolean;
}

export interface SendVideoParams extends SendCommonParams {
  video: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  cover?: string;
  start_timestamp?: number;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
  supports_streaming?: boolean;
}

export interface SendAnimationParams extends SendCommonParams {
  animation: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
}

export interface SendVoiceParams extends SendCommonParams {
  voice: string;
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  caption_entities?: MessageEntity[];
  duration?: number;
}

export interface SendVideoNoteParams extends SendCommonParams {
  video_note: string;
  duration?: number;
  length?: number;
  thumbnail?: string;
}

export interface SendStickerParams extends SendCommonParams {
  sticker: string;
  emoji?: string;
}

export interface SendLocationParams extends SendCommonParams {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface SendVenueParams extends SendCommonParams {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
}

export interface SendContactParams extends SendCommonParams {
  phone_number: string;
  first_name: string;
  last_name?: string;
  vcard?: string;
}

export interface SendPollParams extends SendCommonParams {
  question: string;
  question_parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  question_entities?: MessageEntity[];
  options: InputPollOption[];
  is_anonymous?: boolean;
  type?: 'quiz' | 'regular';
  allows_multiple_answers?: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_parse_mode?: string;
  explanation_entities?: MessageEntity[];
  open_period?: number;
  close_date?: number;
  is_closed?: boolean;
}

export interface InputPollOption {
  text: string;
  text_parse_mode?: string;
  text_entities?: MessageEntity[];
}

export interface SendDiceParams extends SendCommonParams {
  emoji?: '🎲' | '🎯' | '🏀' | '⚽' | '🎳' | '🎰';
}

export interface SendChatActionParams {
  chat_id: number | string;
  message_thread_id?: number;
  business_connection_id?: string;
  action:
    | 'typing'
    | 'upload_photo'
    | 'record_video'
    | 'upload_video'
    | 'record_voice'
    | 'upload_voice'
    | 'upload_document'
    | 'choose_sticker'
    | 'find_location'
    | 'record_video_note'
    | 'upload_video_note';
}

export interface ForwardMessageParams {
  chat_id: number | string;
  message_thread_id?: number;
  from_chat_id: number | string;
  message_id: number;
  video_start_timestamp?: number;
  disable_notification?: boolean;
  protect_content?: boolean;
}

export interface ForwardMessagesParams {
  chat_id: number | string;
  message_thread_id?: number;
  from_chat_id: number | string;
  message_ids: number[];
  disable_notification?: boolean;
  protect_content?: boolean;
}

export interface CopyMessageParams {
  chat_id: number | string;
  message_thread_id?: number;
  from_chat_id: number | string;
  message_id: number;
  video_start_timestamp?: number;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  disable_notification?: boolean;
  protect_content?: boolean;
  allow_paid_broadcast?: boolean;
  reply_parameters?: ReplyParameters;
  reply_markup?: ReplyMarkup;
}

export interface CopyMessagesParams {
  chat_id: number | string;
  message_thread_id?: number;
  from_chat_id: number | string;
  message_ids: number[];
  disable_notification?: boolean;
  protect_content?: boolean;
  remove_caption?: boolean;
}

export interface InputMediaPhoto {
  type: 'photo';
  media: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
}

export interface InputMediaVideo {
  type: 'video';
  media: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  width?: number;
  height?: number;
  duration?: number;
  supports_streaming?: boolean;
  has_spoiler?: boolean;
}

export interface InputMediaAnimation {
  type: 'animation';
  media: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  width?: number;
  height?: number;
  duration?: number;
  has_spoiler?: boolean;
}

export interface InputMediaAudio {
  type: 'audio';
  media: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  duration?: number;
  performer?: string;
  title?: string;
}

export interface InputMediaDocument {
  type: 'document';
  media: string;
  thumbnail?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  disable_content_type_detection?: boolean;
}

export type InputMedia =
  | InputMediaPhoto
  | InputMediaVideo
  | InputMediaAnimation
  | InputMediaAudio
  | InputMediaDocument;

export interface SendMediaGroupParams {
  chat_id: number | string;
  message_thread_id?: number;
  business_connection_id?: string;
  media: InputMedia[];
  disable_notification?: boolean;
  protect_content?: boolean;
  allow_paid_broadcast?: boolean;
  message_effect_id?: string;
  reply_parameters?: ReplyParameters;
}

export interface EditMessageTextParams {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  business_connection_id?: string;
  text: string;
  parse_mode?: string;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
  reply_markup?: InlineKeyboardMarkup;
}

export interface EditMessageCaptionParams {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  business_connection_id?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  reply_markup?: InlineKeyboardMarkup;
}

export interface EditMessageMediaParams {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  business_connection_id?: string;
  media: InputMedia;
  reply_markup?: InlineKeyboardMarkup;
}

export interface EditMessageReplyMarkupParams {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
  business_connection_id?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface DeleteMessageParams {
  chat_id: number | string;
  message_id: number;
}

export interface DeleteMessagesParams {
  chat_id: number | string;
  message_ids: number[];
}

export interface PinChatMessageParams {
  chat_id: number | string;
  message_id: number;
  business_connection_id?: string;
  disable_notification?: boolean;
}

export interface UnpinChatMessageParams {
  chat_id: number | string;
  message_id?: number;
  business_connection_id?: string;
}

export interface BanChatMemberParams {
  chat_id: number | string;
  user_id: number;
  until_date?: number;
  revoke_messages?: boolean;
}

export interface UnbanChatMemberParams {
  chat_id: number | string;
  user_id: number;
  only_if_banned?: boolean;
}

export interface RestrictChatMemberParams {
  chat_id: number | string;
  user_id: number;
  permissions: ChatPermissions;
  use_independent_chat_permissions?: boolean;
  until_date?: number;
}

export interface PromoteChatMemberParams {
  chat_id: number | string;
  user_id: number;
  is_anonymous?: boolean;
  can_manage_chat?: boolean;
  can_delete_messages?: boolean;
  can_manage_video_chats?: boolean;
  can_restrict_members?: boolean;
  can_promote_members?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_post_stories?: boolean;
  can_edit_stories?: boolean;
  can_delete_stories?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
}

export interface SendInvoiceParams extends SendCommonParams {
  title: string;
  description: string;
  payload: string;
  provider_token?: string;
  currency: string;
  prices: LabeledPrice[];
  max_tip_amount?: number;
  suggested_tip_amounts?: number[];
  start_parameter?: string;
  provider_data?: string;
  photo_url?: string;
  photo_size?: number;
  photo_width?: number;
  photo_height?: number;
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;
  send_phone_number_to_provider?: boolean;
  send_email_to_provider?: boolean;
  is_flexible?: boolean;
}

export interface CreateInvoiceLinkParams {
  title: string;
  description: string;
  payload: string;
  provider_token?: string;
  currency: string;
  prices: LabeledPrice[];
  subscription_period?: number;
  max_tip_amount?: number;
  suggested_tip_amounts?: number[];
  provider_data?: string;
  photo_url?: string;
  photo_size?: number;
  photo_width?: number;
  photo_height?: number;
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;
  send_phone_number_to_provider?: boolean;
  send_email_to_provider?: boolean;
  is_flexible?: boolean;
}

export interface SetMyCommandsParams {
  commands: BotCommand[];
  scope?: BotCommandScope;
  language_code?: string;
}

export interface GetMyCommandsParams {
  scope?: BotCommandScope;
  language_code?: string;
}

export interface DeleteMyCommandsParams {
  scope?: BotCommandScope;
  language_code?: string;
}

export interface SetMessageReactionParams {
  chat_id: number | string;
  message_id: number;
  reaction?: ReactionType[];
  is_big?: boolean;
}

export interface GetUpdatesParams {
  offset?: number;
  limit?: number;
  timeout?: number;
  allowed_updates?: string[];
}

export interface SetWebhookParams {
  url: string;
  certificate?: string;
  ip_address?: string;
  max_connections?: number;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
  secret_token?: string;
}

export interface DeleteWebhookParams {
  drop_pending_updates?: boolean;
}

export interface AnswerCallbackQueryParams {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

export interface AnswerInlineQueryParams {
  inline_query_id: string;
  results: InlineQueryResult[];
  cache_time?: number;
  is_personal?: boolean;
  next_offset?: string;
  button?: InlineQueryResultsButton;
}

export interface AnswerWebAppQueryParams {
  web_app_query_id: string;
  result: InlineQueryResult;
}

export interface AnswerShippingQueryParams {
  shipping_query_id: string;
  ok: boolean;
  shipping_options?: ShippingOption[];
  error_message?: string;
}

export interface AnswerPreCheckoutQueryParams {
  pre_checkout_query_id: string;
  ok: boolean;
  error_message?: string;
}

export interface GetUserProfilePhotosParams {
  user_id: number;
  offset?: number;
  limit?: number;
}

export interface CreateChatInviteLinkParams {
  chat_id: number | string;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  creates_join_request?: boolean;
}

export interface EditChatInviteLinkParams extends CreateChatInviteLinkParams {
  invite_link: string;
}

export interface RevokeChatInviteLinkParams {
  chat_id: number | string;
  invite_link: string;
}

export interface SendGameParams {
  chat_id: number;
  message_thread_id?: number;
  business_connection_id?: string;
  game_short_name: string;
  disable_notification?: boolean;
  protect_content?: boolean;
  allow_paid_broadcast?: boolean;
  message_effect_id?: string;
  reply_parameters?: ReplyParameters;
  reply_markup?: InlineKeyboardMarkup;
}

export interface SetGameScoreParams {
  user_id: number;
  score: number;
  force?: boolean;
  disable_edit_message?: boolean;
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
}

export interface GetGameHighScoresParams {
  user_id: number;
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
}

export interface CreateForumTopicParams {
  chat_id: number | string;
  name: string;
  icon_color?: number;
  icon_custom_emoji_id?: string;
}

export interface EditForumTopicParams {
  chat_id: number | string;
  message_thread_id: number;
  name?: string;
  icon_custom_emoji_id?: string;
}

export interface ForumTopic {
  message_thread_id: number;
  name: string;
  icon_color: number;
  icon_custom_emoji_id?: string;
}

export interface InputSticker {
  sticker: string;
  format: 'static' | 'animated' | 'video';
  emoji_list: string[];
  mask_position?: MaskPosition;
  keywords?: string[];
}

export interface CreateNewStickerSetParams {
  user_id: number;
  name: string;
  title: string;
  stickers: InputSticker[];
  sticker_type?: 'regular' | 'mask' | 'custom_emoji';
  needs_repainting?: boolean;
}

export interface AddStickerToSetParams {
  user_id: number;
  name: string;
  sticker: InputSticker;
}

export interface UsersShared {
  request_id: number;
  users: SharedUser[];
}

export interface SharedUser {
  user_id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo?: PhotoSize[];
}

export interface ChatShared {
  request_id: number;
  chat_id: number;
  title?: string;
  username?: string;
  photo?: PhotoSize[];
}

export interface WebAppData {
  data: string;
  button_text: string;
}

export interface GiveawayCreated {
  prize_star_count?: number;
}

export interface Giveaway {
  chats: Chat[];
  winners_selection_date: number;
  winner_count: number;
  only_new_members?: boolean;
  has_public_winners?: boolean;
  prize_description?: string;
  country_codes?: string[];
  prize_star_count?: number;
  premium_subscription_month_count?: number;
}

export interface GiveawayWinners {
  chat: Chat;
  giveaway_message_id: number;
  winners_selection_date: number;
  winner_count: number;
  winners: User[];
  additional_chat_count?: number;
  prize_star_count?: number;
  premium_subscription_month_count?: number;
  unclaimed_prize_count?: number;
  only_new_members?: boolean;
  was_refunded?: boolean;
  prize_description?: string;
}

export interface GiveawayCompleted {
  winner_count: number;
  unclaimed_prize_count?: number;
  giveaway_message?: Message;
  is_star_giveaway?: boolean;
}

export interface ChatBoostAdded {
  boost_count: number;
}

export interface ChatBackground {
  type: BackgroundType;
}

export type BackgroundType =
  | BackgroundTypeFill
  | BackgroundTypeWallpaper
  | BackgroundTypePattern
  | BackgroundTypeChatTheme;

export interface BackgroundTypeFill {
  type: 'fill';
  fill: BackgroundFill;
  dark_theme_dimming: number;
}

export interface BackgroundTypeWallpaper {
  type: 'wallpaper';
  document: Document;
  dark_theme_dimming: number;
  is_blurred?: boolean;
  is_moving?: boolean;
}

export interface BackgroundTypePattern {
  type: 'pattern';
  document: Document;
  fill: BackgroundFill;
  intensity: number;
  is_inverted?: boolean;
  is_moving?: boolean;
}

export interface BackgroundTypeChatTheme {
  type: 'chat_theme';
  theme_name: string;
}

export type BackgroundFill =
  | BackgroundFillSolid
  | BackgroundFillGradient
  | BackgroundFillFreeformGradient;

export interface BackgroundFillSolid { type: 'solid'; color: number; }
export interface BackgroundFillGradient { type: 'gradient'; top_color: number; bottom_color: number; rotation_angle: number; }
export interface BackgroundFillFreeformGradient { type: 'freeform_gradient'; colors: number[]; }

export interface ProximityAlertTriggered {
  traveler: User;
  watcher: User;
  distance: number;
}

export interface VideoChatScheduled {
  start_date: number;
}

export interface VideoChatStarted {}

export interface VideoChatEnded {
  duration: number;
}

export interface VideoChatParticipantsInvited {
  users: User[];
}

export interface ForumTopicCreated {
  name: string;
  icon_color: number;
  icon_custom_emoji_id?: string;
}

export interface ForumTopicEdited {
  name?: string;
  icon_custom_emoji_id?: string;
}

export interface ForumTopicClosed {}
export interface ForumTopicReopened {}
export interface GeneralForumTopicHidden {}
export interface GeneralForumTopicUnhidden {}

export interface MessageAutoDeleteTimerChanged {
  message_auto_delete_time: number;
}

export interface WriteAccessAllowed {
  from_request?: boolean;
  web_app_name?: string;
  from_attachment_menu?: boolean;
}

export interface BusinessIntro {
  title?: string;
  message?: string;
  sticker?: Sticker;
}

export interface BusinessLocation {
  address: string;
  location?: Location;
}

export interface BusinessOpeningHours {
  time_zone_name: string;
  opening_hours: BusinessOpeningHoursInterval[];
}

export interface BusinessOpeningHoursInterval {
  opening_minute: number;
  closing_minute: number;
}

export interface Birthdate {
  day: number;
  month: number;
  year?: number;
}

export interface Gift {
  id: string;
  sticker: Sticker;
  star_count: number;
  total_count?: number;
  remaining_count?: number;
  upgrade_star_count?: number;
}

export interface Gifts {
  gifts: Gift[];
}

export interface StarTransaction {
  id: string;
  amount: number;
  nanostar_amount?: number;
  date: number;
  source?: TransactionPartner;
  receiver?: TransactionPartner;
}

export interface StarTransactions {
  transactions: StarTransaction[];
}

export type TransactionPartner =
  | TransactionPartnerUser
  | TransactionPartnerFragment
  | TransactionPartnerTelegramAds
  | TransactionPartnerTelegramApi
  | TransactionPartnerOther;

export interface TransactionPartnerUser {
  type: 'user';
  user: User;
  affiliate?: AffiliateInfo;
  invoice_payload?: string;
  subscription_period?: number;
  paid_media?: PaidMedia[];
  paid_media_payload?: string;
  gift?: Gift;
}

export interface TransactionPartnerFragment { type: 'fragment'; withdrawal_state?: RevenueWithdrawalState; }
export interface TransactionPartnerTelegramAds { type: 'telegram_ads'; }
export interface TransactionPartnerTelegramApi { type: 'telegram_api'; request_count: number; }
export interface TransactionPartnerOther { type: 'other'; }

export interface AffiliateInfo {
  affiliate_user?: User;
  affiliate_chat?: Chat;
  commission_per_mille: number;
  amount: number;
  nanostar_amount?: number;
}

export interface RevenueWithdrawalState {
  type: 'pending' | 'succeeded' | 'failed';
  date?: number;
  url?: string;
}

export interface PaidMediaPurchased {
  from: User;
  paid_media_payload: string;
}

export interface BusinessConnection {
  id: string;
  user: User;
  user_chat_id: number;
  date: number;
  can_reply: boolean;
  is_enabled: boolean;
}

export interface UserChatBoosts {
  boosts: ChatBoost[];
}

export interface SendPaidMediaParams {
  business_connection_id?: string;
  chat_id: number | string;
  star_count: number;
  media: InputPaidMedia[];
  payload?: string;
  caption?: string;
  parse_mode?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  disable_notification?: boolean;
  protect_content?: boolean;
  reply_parameters?: ReplyParameters;
  reply_markup?: ReplyMarkup;
  allow_paid_broadcast?: boolean;
}

export interface InputPaidMedia {
  type: 'photo' | 'video';
  media: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  supports_streaming?: boolean;
}

export interface GetBusinessConnectionParams {
  business_connection_id: string;
}

export interface SetChatStickerSetParams {
  chat_id: number | string;
  sticker_set_name: string;
}

export interface DeleteChatStickerSetParams {
  chat_id: number | string;
}

export interface CreateChatSubscriptionInviteLinkParams {
  chat_id: number | string;
  name?: string;
  subscription_period: number;
  subscription_price: number;
}

export interface EditChatSubscriptionInviteLinkParams {
  chat_id: number | string;
  invite_link: string;
  name?: string;
}

export interface GetAvailableGiftsParams {}

export interface SendGiftParams {
  user_id: number;
  gift_id: string;
  pay_for_upgrade?: boolean;
  text?: string;
  text_parse_mode?: string;
  text_entities?: MessageEntity[];
}

export interface SetUserEmojiStatusParams {
  user_id: number;
  emoji_status_custom_emoji_id?: string;
  emoji_status_expiration_date?: number;
}

export interface VerifyUserParams {
  user_id: number;
  custom_description?: string;
}

export interface RemoveUserVerificationParams {
  user_id: number;
}

export interface VerifyChatParams {
  chat_id: number | string;
  custom_description?: string;
}

export interface RemoveChatVerificationParams {
  chat_id: number | string;
}

export interface ReadBusinessMessageParams {
  business_connection_id: string;
  chat_id: number;
  message_id: number;
}

export interface DeleteBusinessMessagesParams {
  business_connection_id: string;
  message_ids: number[];
}

export interface AllowUserMessagesParams {
  user_id: number;
}

export interface DisallowUserMessagesParams {
  user_id: number;
}

export interface GetUserChatBoostsParams {
  chat_id: number | string;
  user_id: number;
}

export interface GetStarTransactionsParams {
  offset?: number;
  limit?: number;
}

export interface RefundStarPaymentParams {
  user_id: number;
  telegram_payment_charge_id: string;
}

export interface SavePreparedInlineMessageParams {
  user_id: number;
  result: InlineQueryResult;
  allow_user_chats?: boolean;
  allow_bot_chats?: boolean;
  allow_group_chats?: boolean;
  allow_channel_chats?: boolean;
}

export interface PreparedInlineMessage {
  id: string;
  expiration_date: number;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: ResponseParameters;
}

export interface ResponseParameters {
  migrate_to_chat_id?: number;
  retry_after?: number;
}

export class TelegramApiError extends Error {
  constructor(
    public readonly errorCode: number,
    public readonly description: string,
    public readonly parameters?: ResponseParameters
  ) {
    super(`Telegram API error ${errorCode}: ${description}`);
    this.name = 'TelegramApiError';
  }
}
