import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client_provider.dart';
import 'chat_notifier.dart';
import 'chat_state.dart';

final chatNotifierProvider = StateNotifierProvider.autoDispose
    .family<ChatNotifier, ChatState, String>((ref, conversationId) {
  // Keep the API client alive while chat is active.
  ref.watch(apiClientProvider);
  final notifier = ChatNotifier(ref);
  Future.microtask(() => notifier.loadInitial(conversationId));
  return notifier;
});
