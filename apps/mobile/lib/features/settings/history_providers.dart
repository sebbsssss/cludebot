import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client_provider.dart';
import '../../core/api/models/responses.dart';

final usageHistoryProvider = FutureProvider<List<UsageRecord>>((ref) {
  return ref.read(apiClientProvider).getUsageHistory();
});

final topupHistoryProvider = FutureProvider<List<TopupRecord>>((ref) {
  return ref.read(apiClientProvider).getTopupHistory();
});
