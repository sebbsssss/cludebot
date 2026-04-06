import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/memory_summary.dart';
import 'package:clude_mobile/features/memory/recent_memories_provider.dart';
import 'package:clude_mobile/features/memory/recent_memories_state.dart';

class MockApiClient extends Mock implements ApiClient {}

List<MemorySummary> _generateItems(int count, {int startId = 1}) {
  return List.generate(
    count,
    (i) => MemorySummary(
      id: startId + i,
      memoryType: 'episodic',
      summary: 'Memory summary ${startId + i}',
      importance: 0.7,
      createdAt: '2026-03-30T10:00:00Z',
    ),
  );
}

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  ProviderContainer createContainer({bool skipInit = false}) {
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(mockClient),
        recentMemoriesProvider.overrideWith(
          (ref) => RecentMemoriesNotifier(ref, skipInit: skipInit),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('RecentMemoriesNotifier', () {
    test('fetch sets items on success', () async {
      final items = _generateItems(20);
      when(() => mockClient.getRecentMemories(limit: 20, offset: 0))
          .thenAnswer((_) async => items);

      final container = createContainer(skipInit: true);
      final notifier = container.read(recentMemoriesProvider.notifier);
      await notifier.fetch();

      final state = container.read(recentMemoriesProvider);
      expect(state.items.length, 20);
      expect(state.isLoading, false);
      expect(state.hasMore, true);
      expect(state.error, isNull);
    });

    test('fetch sets error on failure', () async {
      when(() => mockClient.getRecentMemories(limit: 20, offset: 0))
          .thenThrow(Exception('Server error'));

      final container = createContainer(skipInit: true);
      final notifier = container.read(recentMemoriesProvider.notifier);
      await notifier.fetch();

      final state = container.read(recentMemoriesProvider);
      expect(state.error, isNotNull);
      expect(state.isLoading, false);
      expect(state.items, isEmpty);
    });

    test('hasMore is false when fewer than 20 items returned', () async {
      final items = _generateItems(15);
      when(() => mockClient.getRecentMemories(limit: 20, offset: 0))
          .thenAnswer((_) async => items);

      final container = createContainer(skipInit: true);
      final notifier = container.read(recentMemoriesProvider.notifier);
      await notifier.fetch();

      final state = container.read(recentMemoriesProvider);
      expect(state.items.length, 15);
      expect(state.hasMore, false);
    });

    test('loadMore appends items', () async {
      final page1 = _generateItems(20, startId: 1);
      final page2 = _generateItems(10, startId: 21);

      when(() => mockClient.getRecentMemories(limit: 20, offset: 0))
          .thenAnswer((_) async => page1);
      when(() => mockClient.getRecentMemories(limit: 20, offset: 20))
          .thenAnswer((_) async => page2);

      final container = createContainer(skipInit: true);
      final notifier = container.read(recentMemoriesProvider.notifier);
      await notifier.fetch();
      await notifier.loadMore();

      final state = container.read(recentMemoriesProvider);
      expect(state.items.length, 30);
      expect(state.hasMore, false); // page2 had <20 items
    });

    test('loadMore does nothing when hasMore is false', () async {
      final items = _generateItems(10);
      when(() => mockClient.getRecentMemories(limit: 20, offset: 0))
          .thenAnswer((_) async => items);

      final container = createContainer(skipInit: true);
      final notifier = container.read(recentMemoriesProvider.notifier);
      await notifier.fetch();

      // hasMore should be false since <20 items
      await notifier.loadMore();

      // Should not have called API again
      verify(() => mockClient.getRecentMemories(limit: 20, offset: 0)).called(1);
      verifyNever(() => mockClient.getRecentMemories(limit: 20, offset: 10));
    });

    test('skipInit prevents auto-fetch', () async {
      final container = createContainer(skipInit: true);

      final state = container.read(recentMemoriesProvider);
      expect(state.isLoading, true);
      expect(state.items, isEmpty);
      verifyNever(() => mockClient.getRecentMemories(limit: any(named: 'limit'), offset: any(named: 'offset')));
    });
  });
}
