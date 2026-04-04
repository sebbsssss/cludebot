import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:clude_mobile/core/api/api_client.dart';
import 'package:clude_mobile/core/api/api_client_provider.dart';
import 'package:clude_mobile/core/api/models/conversation.dart';
import 'package:clude_mobile/core/api/models/message.dart';
import 'package:clude_mobile/features/chat/chat_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

final _detail = ConversationDetail(
  id: 'test-123',
  ownerWallet: 'wallet-1',
  title: 'Test Chat',
  model: 'claude-3',
  messageCount: 1,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  messages: [
    const Message(
      id: 'msg-1',
      conversationId: 'test-123',
      role: 'user',
      content: 'Hello',
      createdAt: '2026-04-01T00:00:00Z',
    ),
  ],
  hasMore: false,
);

void main() {
  late MockApiClient mockClient;

  setUp(() {
    mockClient = MockApiClient();
    when(() => mockClient.getConversation(any(), before: any(named: 'before')))
        .thenAnswer((_) async => _detail);
  });

  group('ActiveChatScreen lifecycle', () {
    Widget buildSubject({String conversationId = 'test-123'}) {
      return ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(mockClient),
        ],
        child: MaterialApp(
          home: ActiveChatScreen(conversationId: conversationId),
        ),
      );
    }

    testWidgets('is a ConsumerStatefulWidget', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      expect(find.text('Test Chat'), findsOneWidget);

      final element = tester.element(find.byType(ActiveChatScreen));
      expect(element.widget, isA<ConsumerStatefulWidget>());
    });

    testWidgets('renders with conversation title after load', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      expect(find.text('Test Chat'), findsOneWidget);
    });

    testWidgets('handles pause lifecycle without error', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();

      expect(find.text('Test Chat'), findsOneWidget);
    });

    testWidgets('handles resume lifecycle without error', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      // Follow valid lifecycle transitions: resumed → inactive → hidden → paused → hidden → inactive → resumed
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(find.text('Test Chat'), findsOneWidget);
    });
  });
}
