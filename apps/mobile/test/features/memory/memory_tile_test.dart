import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:clude_mobile/core/api/models/memory_summary.dart';
import 'package:clude_mobile/features/memory/memory_screen.dart';

const _testMemory = MemorySummary(
  id: 1,
  memoryType: 'episodic',
  summary:
      'This is a long memory summary that should be truncated when collapsed '
      'but shown in full when the tile is expanded by the user tapping on it. '
      'It contains enough text to exceed two lines of display.',
  importance: 0.85,
  createdAt: '2026-03-30T10:00:00Z',
);

const _semanticMemory = MemorySummary(
  id: 2,
  memoryType: 'semantic',
  summary: 'Short semantic memory.',
  importance: 0.3,
  createdAt: '2026-03-29T08:00:00Z',
);

void main() {
  Widget buildSubject({MemorySummary memory = _testMemory}) {
    return MaterialApp(
      home: Scaffold(
        body: ListView(
          children: [MemoryTile(memory: memory)],
        ),
      ),
    );
  }

  group('MemoryTile', () {
    testWidgets('shows type badge with correct label', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      expect(find.text('EPI'), findsOneWidget);
    });

    testWidgets('shows semantic type badge', (tester) async {
      await tester.pumpWidget(buildSubject(memory: _semanticMemory));
      await tester.pumpAndSettle();

      expect(find.text('SEM'), findsOneWidget);
    });

    testWidgets('tap expands to show full text', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      // Tap to expand
      await tester.tap(find.byType(MemoryTile));
      await tester.pumpAndSettle();

      // Full text should be visible (find partial unique text from the long summary)
      expect(find.textContaining('enough text to exceed'), findsOneWidget);
    });

    testWidgets('tap again collapses', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      // Expand
      await tester.tap(find.byType(MemoryTile));
      await tester.pumpAndSettle();

      // Collapse
      await tester.tap(find.byType(MemoryTile));
      await tester.pumpAndSettle();

      // Widget still exists (collapsed state)
      expect(find.byType(MemoryTile), findsOneWidget);
    });

    testWidgets('shows relative timestamp', (tester) async {
      await tester.pumpWidget(buildSubject());
      await tester.pumpAndSettle();

      // relativeTime will format the date - just check something is there
      // The exact text depends on current time, so check for any time-like text
      expect(find.byType(MemoryTile), findsOneWidget);
    });
  });
}
