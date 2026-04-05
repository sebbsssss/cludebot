import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/responses.dart';
import 'package:clude_mobile/features/settings/history_providers.dart';

class MockApiClient extends Mock implements ApiClient {}

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

  group('usageHistoryProvider', () {
    final testRecords = [
      const UsageRecord(
        date: '2026-03-30',
        promptTokens: 12400,
        completionTokens: 3100,
        costUsdc: 0.0023,
        conversationCount: 4,
      ),
      const UsageRecord(
        date: '2026-03-29',
        promptTokens: 8000,
        completionTokens: 2000,
        costUsdc: 0.0015,
        conversationCount: 2,
      ),
    ];

    test('returns list on success', () async {
      when(() => mockClient.getUsageHistory())
          .thenAnswer((_) async => testRecords);

      final container = createContainer();
      final result = await container.read(usageHistoryProvider.future);

      expect(result, testRecords);
      expect(result.length, 2);
      expect(result.first.date, '2026-03-30');
      expect(result.first.promptTokens, 12400);
    });

    test('returns AsyncError on API failure', () async {
      when(() => mockClient.getUsageHistory())
          .thenThrow(Exception('Server error'));

      final container = createContainer();

      expect(
        () => container.read(usageHistoryProvider.future),
        throwsA(isA<Exception>()),
      );
    });

    test('invalidate re-fetches', () async {
      when(() => mockClient.getUsageHistory())
          .thenAnswer((_) async => testRecords);

      final container = createContainer();
      await container.read(usageHistoryProvider.future);

      // Update mock for second call
      when(() => mockClient.getUsageHistory())
          .thenAnswer((_) async => [testRecords.first]);

      container.invalidate(usageHistoryProvider);
      final result = await container.read(usageHistoryProvider.future);

      expect(result.length, 1);
      verify(() => mockClient.getUsageHistory()).called(2);
    });
  });

  group('topupHistoryProvider', () {
    final testTopups = [
      const TopupRecord(
        id: 'tip_001',
        amountUsdc: 10.0,
        chain: 'solana',
        txHash: 'abc123def456',
        status: 'confirmed',
        createdAt: '2026-03-29T14:22:00Z',
      ),
      const TopupRecord(
        id: 'tip_002',
        amountUsdc: 25.0,
        chain: 'base',
        txHash: null,
        status: 'pending',
        createdAt: '2026-03-28T10:00:00Z',
      ),
    ];

    test('returns list on success', () async {
      when(() => mockClient.getTopupHistory())
          .thenAnswer((_) async => testTopups);

      final container = createContainer();
      final result = await container.read(topupHistoryProvider.future);

      expect(result, testTopups);
      expect(result.length, 2);
      expect(result.first.chain, 'solana');
      expect(result.first.txHash, 'abc123def456');
      expect(result.last.txHash, isNull);
    });

    test('returns AsyncError on API failure', () async {
      when(() => mockClient.getTopupHistory())
          .thenThrow(Exception('Server error'));

      final container = createContainer();

      expect(
        () => container.read(topupHistoryProvider.future),
        throwsA(isA<Exception>()),
      );
    });

    test('invalidate re-fetches', () async {
      when(() => mockClient.getTopupHistory())
          .thenAnswer((_) async => testTopups);

      final container = createContainer();
      await container.read(topupHistoryProvider.future);

      when(() => mockClient.getTopupHistory())
          .thenAnswer((_) async => [testTopups.first]);

      container.invalidate(topupHistoryProvider);
      final result = await container.read(topupHistoryProvider.future);

      expect(result.length, 1);
      verify(() => mockClient.getTopupHistory()).called(2);
    });
  });
}
