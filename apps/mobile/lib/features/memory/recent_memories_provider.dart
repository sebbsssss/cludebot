import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client_provider.dart';
import 'recent_memories_state.dart';

const _pageSize = 20;

final recentMemoriesProvider =
    StateNotifierProvider<RecentMemoriesNotifier, RecentMemoriesState>(
  (ref) => RecentMemoriesNotifier(ref),
);

class RecentMemoriesNotifier extends StateNotifier<RecentMemoriesState> {
  RecentMemoriesNotifier(this._ref, {bool skipInit = false})
      : super(const RecentMemoriesState()) {
    if (!skipInit) fetch();
  }

  final Ref _ref;

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final client = _ref.read(apiClientProvider);
      final items = await client.getRecentMemories(limit: _pageSize, offset: 0);
      if (!mounted) return;
      state = RecentMemoriesState(
        items: items,
        isLoading: false,
        hasMore: items.length >= _pageSize,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoadingMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final client = _ref.read(apiClientProvider);
      final newItems = await client.getRecentMemories(
        limit: _pageSize,
        offset: state.items.length,
      );
      if (!mounted) return;
      state = state.copyWith(
        items: [...state.items, ...newItems],
        isLoadingMore: false,
        hasMore: newItems.length >= _pageSize,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(isLoadingMore: false);
    }
  }

  Future<void> refresh() => fetch();

  @visibleForTesting
  void setStateForTest(RecentMemoriesState newState) {
    state = newState;
  }
}
