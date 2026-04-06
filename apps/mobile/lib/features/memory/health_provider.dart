import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client_provider.dart';
import '../../core/api/models/memory_summary.dart';

final healthMemoriesProvider = FutureProvider<List<MemorySummary>>((ref) async {
  final items =
      await ref.read(apiClientProvider).getRecentMemories(limit: 50, offset: 0);
  final sorted = List<MemorySummary>.from(items)
    ..sort((a, b) => a.decay.compareTo(b.decay));
  return sorted;
});
