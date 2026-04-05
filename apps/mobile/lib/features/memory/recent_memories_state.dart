import 'package:freezed_annotation/freezed_annotation.dart';

import '../../core/api/models/memory_summary.dart';

part 'recent_memories_state.freezed.dart';

@freezed
class RecentMemoriesState with _$RecentMemoriesState {
  const factory RecentMemoriesState({
    @Default([]) List<MemorySummary> items,
    @Default(true) bool isLoading,
    @Default(false) bool isLoadingMore,
    @Default(true) bool hasMore,
    String? error,
  }) = _RecentMemoriesState;
}
