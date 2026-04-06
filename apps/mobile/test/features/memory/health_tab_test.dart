import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/memory_stats.dart';
import 'package:clude_mobile/core/api/models/memory_summary.dart';
import 'package:clude_mobile/features/memory/health_provider.dart';
import 'package:clude_mobile/features/memory/health_tab.dart';
import 'package:clude_mobile/features/memory/memory_stats_provider.dart';

class MockApiClient extends Mock implements ApiClient {}

const _testStats = MemoryStats(
  total: 100,
  byType: {'episodic': 50, 'semantic': 30, 'procedural': 20},
  avgImportance: 0.72,
  avgDecay: 0.84,
  topTags: [],
);

final _sortedMemories = [
  const MemorySummary(
    id: 2,
    memoryType: 'semantic',
    summary: 'Weak memory',
    importance: 0.5,
    createdAt: '2026-03-29T08:00:00Z',
    decay: 0.2,
  ),
  const MemorySummary(
    id: 3,
    memoryType: 'procedural',
    summary: 'Warning memory',
    importance: 0.6,
    createdAt: '2026-03-28T15:00:00Z',
    decay: 0.4,
  ),
  const MemorySummary(
    id: 1,
    memoryType: 'episodic',
    summary: 'Healthy memory',
    importance: 0.8,
    createdAt: '2026-03-30T10:00:00Z',
    decay: 0.9,
  ),
];

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  Widget buildSubject({
    AsyncValue<MemoryStats>? statsOverride,
    AsyncValue<List<MemorySummary>>? healthOverride,
  }) {
    return ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(mockClient),
        if (statsOverride != null)
          memoryStatsProvider.overrideWith(
            (ref) => MemoryStatsNotifier(ref, skipInit: true)
              ..setStateForTest(statsOverride),
          ),
        if (healthOverride != null)
          healthMemoriesProvider.overrideWith((ref) {
            return healthOverride.when(
              data: (d) => Future.value(d),
              loading: () => Future.delayed(
                  const Duration(days: 1), () => <MemorySummary>[]),
              error: (e, _) => Future.error(e ?? 'error'),
            );
          }),
      ],
      child: const MaterialApp(
        home: Scaffold(body: HealthTab()),
      ),
    );
  }

  group('HealthTab', () {
    testWidgets('shows summary cards with avg decay and importance',
        (tester) async {
      await tester.pumpWidget(buildSubject(
        statsOverride: const AsyncValue.data(_testStats),
        healthOverride: AsyncValue.data(_sortedMemories),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Avg Decay'), findsOneWidget);
      expect(find.text('84%'), findsOneWidget);
      expect(find.text('Avg Importance'), findsOneWidget);
      expect(find.text('72%'), findsOneWidget);
    });

    testWidgets('shows memories sorted weakest-first', (tester) async {
      await tester.pumpWidget(buildSubject(
        statsOverride: const AsyncValue.data(_testStats),
        healthOverride: AsyncValue.data(_sortedMemories),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Weak memory'), findsOneWidget);
      expect(find.text('Warning memory'), findsOneWidget);
      expect(find.text('Healthy memory'), findsOneWidget);
    });

    testWidgets('shows section header text', (tester) async {
      await tester.pumpWidget(buildSubject(
        statsOverride: const AsyncValue.data(_testStats),
        healthOverride: AsyncValue.data(_sortedMemories),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Weakest memories first'), findsOneWidget);
    });

    testWidgets('shows empty state when no memories', (tester) async {
      await tester.pumpWidget(buildSubject(
        statsOverride: const AsyncValue.data(_testStats),
        healthOverride: const AsyncValue.data([]),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No memories yet'), findsOneWidget);
    });

    testWidgets('shows error with retry', (tester) async {
      await tester.pumpWidget(buildSubject(
        statsOverride: const AsyncValue.data(_testStats),
        healthOverride:
            AsyncValue.error(Exception('Server error'), StackTrace.current),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Server error'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
