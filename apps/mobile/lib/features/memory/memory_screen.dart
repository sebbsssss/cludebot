import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'import_pack_sheet.dart';

class MemoryPanelScreen extends ConsumerWidget {
  const MemoryPanelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Memory'),
        actions: [
          IconButton(
            icon: const Icon(Icons.download),
            tooltip: 'Import Pack',
            onPressed: () => showModalBottomSheet(
              context: context,
              builder: (_) => const ImportPackSheet(),
            ),
          ),
        ],
      ),
      body: const Center(child: Text('Memory Panel')),
    );
  }
}
