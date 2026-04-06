import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models/memory_summary.dart';
import '../../shared/utils/relative_time.dart';
import 'health_provider.dart';
import 'memory_screen.dart';
import 'memory_stats_provider.dart';

Color _decayColor(double decay) {
  if (decay < 0.3) return Colors.red;
  if (decay < 0.5) return Colors.orange;
  return Colors.green;
}

const _typeBadgeLabels = <String, String>{
  'episodic': 'EPI',
  'semantic': 'SEM',
  'procedural': 'PRO',
  'self_model': 'SLF',
};

class HealthTab extends ConsumerWidget {
  const HealthTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncStats = ref.watch(memoryStatsProvider);
    final asyncMemories = ref.watch(healthMemoriesProvider);

    return CustomScrollView(
      slivers: [
        // Summary cards
        SliverToBoxAdapter(
          child: asyncStats.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (stats) => Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: _SummaryCard(
                      label: 'Avg Decay',
                      value: stats.avgDecay.clamp(0.0, 1.0),
                      color: _decayColor(stats.avgDecay),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SummaryCard(
                      label: 'Avg Importance',
                      value: stats.avgImportance.clamp(0.0, 1.0),
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Section header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Weakest memories first',
                    style: Theme.of(context).textTheme.titleSmall),
                Text('decay < 0.5 need attention',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withAlpha(100),
                        )),
              ],
            ),
          ),
        ),

        // Memory list
        ...asyncMemories.when(
          loading: () => [
            const SliverToBoxAdapter(
              child: Center(
                  child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              )),
            ),
          ],
          error: (error, _) => [
            SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      Text(error.toString(), textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () =>
                            ref.invalidate(healthMemoriesProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          data: (memories) {
            if (memories.isEmpty) {
              return [
                const SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No memories yet'),
                    ),
                  ),
                ),
              ];
            }
            return [
              SliverList.builder(
                itemCount: memories.length,
                itemBuilder: (context, index) =>
                    _HealthRow(memory: memories[index]),
              ),
            ];
          },
        ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text('${(value * 100).toStringAsFixed(0)}%',
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: value,
              color: color,
              backgroundColor: color.withAlpha(38),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthRow extends StatelessWidget {
  const _HealthRow({required this.memory});
  final MemorySummary memory;

  @override
  Widget build(BuildContext context) {
    final decay = memory.decay.clamp(0.0, 1.0);
    final decayClr = _decayColor(decay);
    final typeColor = kMemoryTypeColors[memory.memoryType] ?? Colors.grey;
    final label = _typeBadgeLabels[memory.memoryType] ??
        memory.memoryType.substring(0, 3).toUpperCase();
    final textOpacity = 0.4 + (decay * 0.6);

    return Container(
      decoration: BoxDecoration(
        color: typeColor.withAlpha(10),
        border: Border(
          left: BorderSide(color: decayClr, width: 4),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: typeColor.withAlpha(38),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                label,
                style: TextStyle(
                    fontSize: 10,
                    color: typeColor,
                    fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 8),
            // Decay score
            Text(
              decay.toStringAsFixed(2),
              style: TextStyle(
                fontSize: 12,
                color: decayClr,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Opacity(
                    opacity: textOpacity,
                    child: Text(
                      memory.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${relativeTime(memory.createdAt)} · importance ${(memory.importance * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withAlpha(100),
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
