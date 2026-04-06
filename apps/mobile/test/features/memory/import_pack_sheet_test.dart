import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/features/memory/import_pack_notifier.dart';
import 'package:clude_mobile/features/memory/import_pack_sheet.dart';
import 'package:clude_mobile/features/memory/import_pack_state.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
  });

  Widget buildSubject({ImportPackState? initialState}) {
    return ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(mockClient),
        if (initialState != null)
          importPackNotifierProvider.overrideWith(
            (ref) => ImportPackNotifier(ref)
              ..setStateForTest(initialState),
          ),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () => showModalBottomSheet(
                context: context,
                builder: (_) => const ImportPackSheet(),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
  }

  group('ImportPackSheet', () {
    testWidgets('shows two import options in idle state', (tester) async {
      await tester.pumpWidget(buildSubject(
        initialState: const ImportPackState.idle(),
      ));
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('From File'), findsOneWidget);
      expect(find.text('Paste from Clipboard'), findsOneWidget);
    });

    testWidgets('shows importing progress', (tester) async {
      await tester.pumpWidget(buildSubject(
        initialState: const ImportPackState.importing(),
      ));
      await tester.tap(find.text('Open'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Importing memories...'), findsOneWidget);
    });

    testWidgets('shows success with imported count', (tester) async {
      await tester.pumpWidget(buildSubject(
        initialState: const ImportPackState.success(imported: 42),
      ));
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Imported 42 memories'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('shows error with retry button', (tester) async {
      await tester.pumpWidget(buildSubject(
        initialState: const ImportPackState.error(message: 'Server error'),
      ));
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Server error'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
