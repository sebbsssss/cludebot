import 'package:freezed_annotation/freezed_annotation.dart';

import 'models/display_message.dart';

part 'chat_state.freezed.dart';

@freezed
class ChatState with _$ChatState {
  const factory ChatState({
    @Default([]) List<SettledMessage> settled,
    StreamingMessage? streamingMsg,
    @Default(false) bool isLoadingOlder,
    @Default(true) bool hasMore,
    String? oldestTimestamp,
    String? title,
    String? model,
    String? error,
  }) = _ChatState;
}
