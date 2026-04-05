import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'import_pack_notifier.dart';

class ImportPackSheet extends ConsumerWidget {
  const ImportPackSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(importPackNotifierProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: state.map(
        idle: (_) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.file_open),
              title: const Text('From File'),
              onTap: () {
                ref.read(importPackNotifierProvider.notifier).pickFile();
              },
            ),
            ListTile(
              leading: const Icon(Icons.content_paste),
              title: const Text('Paste from Clipboard'),
              onTap: () {
                ref.read(importPackNotifierProvider.notifier).pasteFromClipboard();
              },
            ),
          ],
        ),
        picking: (_) => const SizedBox(
          height: 80,
          child: Center(child: CircularProgressIndicator()),
        ),
        importing: (_) => SizedBox(
          height: 80,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 12),
                Text(
                  'Importing memories...',
                  style: TextStyle(color: colorScheme.onSurface.withAlpha(150)),
                ),
              ],
            ),
          ),
        ),
        success: (s) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, size: 48, color: colorScheme.primary),
            const SizedBox(height: 12),
            Text(
              'Imported ${s.imported} memories',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                ref.read(importPackNotifierProvider.notifier).reset();
                Navigator.of(context).pop();
              },
              child: const Text('Done'),
            ),
          ],
        ),
        error: (s) => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: colorScheme.error),
            const SizedBox(height: 12),
            Text(s.message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () =>
                  ref.read(importPackNotifierProvider.notifier).retry(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
