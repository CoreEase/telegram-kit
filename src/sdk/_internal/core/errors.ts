
export enum WebAppErrorName {
  MethodUnsupported = 'WebAppMethodUnsupported',
  DataInvalid = 'WebAppDataInvalid',
  InlineModeDisabled = 'WebAppInlineModeDisabled',
  InlineQueryInvalid = 'WebAppInlineQueryInvalid',
  InlineChooseChatTypesInvalid = 'WebAppInlineChooseChatTypesInvalid',
  InlineChooseChatTypeInvalid = 'WebAppInlineChooseChatTypeInvalid',
  TgUrlInvalid = 'WebAppTgUrlInvalid',
  InvoiceUrlInvalid = 'WebAppInvoiceUrlInvalid',
  InvoiceOpened = 'WebAppInvoiceOpened',
  PopupOpened = 'WebAppPopupOpened',
  PopupParamInvalid = 'WebAppPopupParamInvalid',
  ScanQrPopupOpened = 'WebAppScanQrPopupOpened',
  ScanQrPopupParamInvalid = 'WebAppScanQrPopupParamInvalid',
  WriteAccessRequested = 'WebAppWriteAccessRequested',
  ContactRequested = 'WebAppContactRequested',
  DownloadFilePopupOpened = 'WebAppDownloadFilePopupOpened',
  DownloadFileParamInvalid = 'WebAppDownloadFileParamInvalid',
  MediaUrlInvalid = 'WebAppMediaUrlInvalid',
  ShareToStoryParamInvalid = 'WebAppShareToStoryParamInvalid',
  ShareMessageOpened = 'WebAppShareMessageOpened',
  RequestChatOpened = 'WebAppRequestChatOpened',
  EmojiStatusRequested = 'WebAppEmojiStatusRequested',
  EmojiStatusAccessRequested = 'WebAppEmojiStatusAccessRequested',
  HeaderColorInvalid = 'WebAppHeaderColorInvalid',
  HeaderColorKeyInvalid = 'WebAppHeaderColorKeyInvalid',
  BackgroundColorInvalid = 'WebAppBackgroundColorInvalid',
  BottomBarColorInvalid = 'WebAppBottomBarColorInvalid',
  BottomButtonParamInvalid = 'WebAppBottomButtonParamInvalid',
  HapticImpactStyleInvalid = 'WebAppHapticImpactStyleInvalid',
  HapticNotificationTypeInvalid = 'WebAppHapticNotificationTypeInvalid',
  HapticFeedbackTypeInvalid = 'WebAppHapticFeedbackTypeInvalid',
  BiometricManagerNotInited = 'WebAppBiometricManagerNotInited',
  BiometricManagerBiometricsNotAvailable = 'WebAppBiometricManagerBiometricsNotAvailable',
  BiometricManagerAccessRequested = 'WebAppBiometricManagerAccessRequested',
  BiometricManagerBiometricAccessNotGranted = 'WebAppBiometricManagerBiometricAccessNotGranted',
  BiometricManagerAuthenticationRequested = 'WebAppBiometricManagerAuthenticationRequested',
  BiometricManagerTokenInvalid = 'WebAppBiometricManagerTokenInvalid',
  BiometricManagerTokenUpdateRequested = 'WebAppBiometricManagerTokenUpdateRequested',
  BiometricManagerBiometricsAccessNotRequested = 'WebAppBiometricManagerBiometricsAccessNotRequested',
  BiometricRequestAccessParamInvalid = 'WebAppBiometricRequestAccessParamInvalid',
  LocationManagerNotInited = 'WebAppLocationManagerNotInited',
  LocationManagerLocationNotAvailable = 'WebAppLocationManagerLocationNotAvailable',
  LocationManagerLocationAccessNotRequested = 'WebAppLocationManagerLocationAccessNotRequested',
  CallbackIdGenerateFailed = 'WebAppCallbackIdGenerateFailed',
}

export class WebAppError extends Error {
  constructor(name: WebAppErrorName) {
    super(name);
    this.name = name;
    this.message = name;
    Object.setPrototypeOf(this, WebAppError.prototype);
  }
}

export function throwWebAppError(name: WebAppErrorName): never {
  throw new WebAppError(name);
}
