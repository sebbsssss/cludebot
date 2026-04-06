import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/responses.dart';
import 'package:clude_mobile/features/settings/history_providers.dart';
import 'package:clude_mobile/features/settings/history_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

const _usageRecords = [
  UsageRecord(
    date: '2026-03-30',
    promptTokens: 12400,
    completionTokens: 3100,
    costUsdc: 0.0023,
    conversationCount: 4,
  ),
];

const _topupRecords = [
  TopupRecord(
    id: 'tip_001',
    amountUsdc: 10.0,
    chain: 'solana',
    txHash: 'abc123def456789',
    status: 'confirmed',
    createdAt: '2026-03-29T14:22:00Z',
  ),
  TopupRecord(
    id: 'tip_002',
    amountUsdc: 25.0,
    chain: 'base',
    txHash: null,
    status: 'pending',
    createdAt: '2026-03-28T10:00:00Z',
  ),
];

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  Widget buildSubject({
    AsyncValue<List<UsageRecord>>? usageOverride,
    AsyncValue<List<TopupRecord>>? topupOverride,
  }) {
    return ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(mockClient),
        if (usageOverride != null)
          usageHistoryProvider.overrideWith((ref) {
            return usageOverride.when(
              data: (d) => Future.value(d),
              loading: () => Future.delayed(const Duration(days: 1), () => <UsageRecord>[]),
              error: (e, _) => Future.error(e ?? 'error'),
            );
          }),
        if (topupOverride != null)
          topupHistoryProvider.overrideWith((ref) {
            return topupOverride.when(
              data: (d) => Future.value(d),
              loading: () => Future.delayed(const Duration(days: 1), () => <TopupRecord>[]),
              error: (e, _) => Future.error(e ?? 'error'),
            );
          }),
      ],
      child: const MaterialApp(
        home: HistoryScreen(),
      ),
    );
  }

  group('HistoryScreen', () {
    testWidgets('shows two tabs', (tester) async {
      when(() => mockClient.getUsageHistory())
          .thenAnswer((_) async => <UsageRecord>[]);
      when(() => mockClient.getTopupHistory())
          .thenAnswer((_) async => <TopupRecord>[]);

      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Usage'), findsOneWidget);
      expect(find.text('Top-ups'), findsOneWidget);
    });

    testWidgets('shows usage records with date, tokens, cost', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data(_usageRecords),
        topupOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      expect(find.text('2026-03-30'), findsOneWidget);
      expect(find.textContaining('15500'), findsOneWidget); // total tokens
      expect(find.textContaining('0.0023'), findsOneWidget);
    });

    testWidgets('shows empty state for usage tab', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No usage records yet.'), findsOneWidget);
    });

    testWidgets('shows error with Retry for usage tab', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: AsyncValue.error(Exception('Server error'), StackTrace.current),
        topupOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Server error'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('shows topup records with amount, chain, status',
        (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: const AsyncValue.data(_topupRecords),
      ));
      await tester.pumpAndSettle();

      // Switch to Top-ups tab
      await tester.tap(find.text('Top-ups'));
      await tester.pumpAndSettle();

      expect(find.textContaining('10.00'), findsOneWidget);
      expect(find.text('Confirmed'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
    });

    testWidgets('shows empty state for topups tab', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Top-ups'));
      await tester.pumpAndSettle();

      expect(find.text('No top-ups yet.'), findsOneWidget);
    });

    testWidgets('shows error with Retry for topups tab', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: AsyncValue.error(Exception('Network error'), StackTrace.current),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Top-ups'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Network error'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('topup row shows dash for null tx_hash', (tester) async {
      await tester.pumpWidget(buildSubject(
        usageOverride: const AsyncValue.data([]),
        topupOverride: const AsyncValue.data(_topupRecords),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Top-ups'));
      await tester.pumpAndSettle();

      // The second record has null tx_hash — should show "—" in subtitle
      expect(find.textContaining('—'), findsOneWidget);
    });
  });
}
