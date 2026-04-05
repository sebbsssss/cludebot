import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/responses.dart';
import 'package:clude_mobile/features/memory/import_pack_notifier.dart';
import 'package:clude_mobile/features/memory/import_pack_state.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  ProviderContainer createContainer() {
    return ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(mockClient),
      ],
    );
  }

  group('ImportPackNotifier', () {
    test('starts in idle state', () {
      final container = createContainer();
      addTearDown(container.dispose);

      expect(
          container.read(importPackNotifierProvider), const ImportPackState.idle());
    });

    test('pasteFromClipboard imports valid JSON pack', () async {
      final pack = {'memories': [{'content': 'test'}]};
      SystemChannels.platform.setMockMethodCallHandler((call) async {
        if (call.method == 'Clipboard.getData') {
          return {'text': jsonEncode(pack)};
        }
        return null;
      });

      when(() => mockClient.importMemoryPack(any()))
          .thenAnswer((_) async => const ImportResult(imported: 1));

      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      await notifier.pasteFromClipboard();

      final state = container.read(importPackNotifierProvider);
      expect(state, isA<ImportPackSuccess>());
      expect((state as ImportPackSuccess).imported, 1);

      SystemChannels.platform.setMockMethodCallHandler(null);
    });

    test('pasteFromClipboard shows error for empty clipboard', () async {
      SystemChannels.platform.setMockMethodCallHandler((call) async {
        if (call.method == 'Clipboard.getData') return {'text': ''};
        return null;
      });

      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      await notifier.pasteFromClipboard();

      final state = container.read(importPackNotifierProvider);
      expect(state, isA<ImportPackError>());
      expect((state as ImportPackError).message, contains('empty'));

      SystemChannels.platform.setMockMethodCallHandler(null);
    });

    test('pasteFromClipboard shows error for invalid JSON', () async {
      SystemChannels.platform.setMockMethodCallHandler((call) async {
        if (call.method == 'Clipboard.getData') {
          return {'text': 'not json at all'};
        }
        return null;
      });

      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      await notifier.pasteFromClipboard();

      final state = container.read(importPackNotifierProvider);
      expect(state, isA<ImportPackError>());
      expect((state as ImportPackError).message, contains('valid JSON'));

      SystemChannels.platform.setMockMethodCallHandler(null);
    });

    test('pasteFromClipboard shows error for non-object JSON', () async {
      SystemChannels.platform.setMockMethodCallHandler((call) async {
        if (call.method == 'Clipboard.getData') return {'text': '"just a string"'};
        return null;
      });

      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      await notifier.pasteFromClipboard();

      final state = container.read(importPackNotifierProvider);
      expect(state, isA<ImportPackError>());

      SystemChannels.platform.setMockMethodCallHandler(null);
    });

    test('shows error on API failure', () async {
      final pack = {'memories': [{'content': 'test'}]};
      SystemChannels.platform.setMockMethodCallHandler((call) async {
        if (call.method == 'Clipboard.getData') {
          return {'text': jsonEncode(pack)};
        }
        return null;
      });

      when(() => mockClient.importMemoryPack(any()))
          .thenAnswer((_) async => throw Exception('Server error'));

      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      await notifier.pasteFromClipboard();

      final state = container.read(importPackNotifierProvider);
      expect(state, isA<ImportPackError>());

      SystemChannels.platform.setMockMethodCallHandler(null);
    });

    test('reset returns to idle', () {
      final container = createContainer();
      addTearDown(container.dispose);

      final notifier = container.read(importPackNotifierProvider.notifier);
      notifier.setStateForTest(
          const ImportPackState.error(message: 'something'));
      notifier.reset();

      expect(
          container.read(importPackNotifierProvider), const ImportPackState.idle());
    });
  });
}
