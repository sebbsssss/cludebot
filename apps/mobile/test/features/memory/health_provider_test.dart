import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/memory_summary.dart';
import 'package:clude_mobile/features/memory/health_provider.dart';

class MockApiClient extends Mock implements ApiClient {}

final _testMemories = [
  const MemorySummary(
    id: 1,
    memoryType: 'episodic',
    summary: 'Healthy memory',
    importance: 0.8,
    createdAt: '2026-03-30T10:00:00Z',
    decay: 0.9,
  ),
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
];

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  ProviderContainer createContainer() {
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(mockClient)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('healthMemoriesProvider', () {
    test('returns memories sorted by decay ascending', () async {
      when(() => mockClient.getRecentMemories(limit: 50, offset: 0))
          .thenAnswer((_) async => _testMemories);

      final container = createContainer();
      final result = await container.read(healthMemoriesProvider.future);

      expect(result.length, 3);
      expect(result[0].decay, 0.2); // weakest first
      expect(result[1].decay, 0.4);
      expect(result[2].decay, 0.9);
    });

    test('returns error on failure', () async {
      when(() => mockClient.getRecentMemories(limit: 50, offset: 0))
          .thenThrow(Exception('Server error'));

      final container = createContainer();

      expect(
        () => container.read(healthMemoriesProvider.future),
        throwsA(isA<Exception>()),
      );
    });

    test('empty list returns empty', () async {
      when(() => mockClient.getRecentMemories(limit: 50, offset: 0))
          .thenAnswer((_) async => <MemorySummary>[]);

      final container = createContainer();
      final result = await container.read(healthMemoriesProvider.future);

      expect(result, isEmpty);
    });
  });
}
