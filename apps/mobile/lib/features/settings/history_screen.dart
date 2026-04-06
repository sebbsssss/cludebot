import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/models/responses.dart';
import 'history_providers.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Usage History'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Usage'),
              Tab(text: 'Top-ups'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _UsageTab(),
            _TopupsTab(),
          ],
        ),
      ),
    );
  }
}

class _UsageTab extends ConsumerWidget {
  const _UsageTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRecords = ref.watch(usageHistoryProvider);

    return asyncRecords.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(usageHistoryProvider),
      ),
      data: (records) {
        if (records.isEmpty) {
          return const Center(child: Text('No usage records yet.'));
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(usageHistoryProvider);
            await ref.read(usageHistoryProvider.future);
          },
          child: ListView.builder(
            itemCount: records.length,
            itemBuilder: (context, index) => _UsageRow(record: records[index]),
          ),
        );
      },
    );
  }
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({required this.record});

  final UsageRecord record;

  @override
  Widget build(BuildContext context) {
    final totalTokens = record.promptTokens + record.completionTokens;
    final costFormatted = record.costUsdc.toStringAsFixed(4);

    return ListTile(
      title: Text(record.date),
      subtitle: Text('$totalTokens tokens'),
      trailing: Text(
        '\$$costFormatted',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _TopupsTab extends ConsumerWidget {
  const _TopupsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncTopups = ref.watch(topupHistoryProvider);

    return asyncTopups.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(topupHistoryProvider),
      ),
      data: (topups) {
        if (topups.isEmpty) {
          return const Center(child: Text('No top-ups yet.'));
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(topupHistoryProvider);
            await ref.read(topupHistoryProvider.future);
          },
          child: ListView.builder(
            itemCount: topups.length,
            itemBuilder: (context, index) =>
                _TopupRow(record: topups[index]),
          ),
        );
      },
    );
  }
}

class _TopupRow extends StatelessWidget {
  const _TopupRow({required this.record});

  final TopupRecord record;

  String? _explorerUrl() {
    final hash = record.txHash;
    if (hash == null || hash.isEmpty) return null;
    switch (record.chain) {
      case 'solana':
        return 'https://solscan.io/tx/$hash';
      case 'base':
        return 'https://basescan.org/tx/$hash';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final url = _explorerUrl();
    final dateFormatted = _formatDate(record.createdAt);
    final hashDisplay =
        record.txHash != null && record.txHash!.isNotEmpty
            ? '${record.txHash!.substring(0, 8)}...'
            : '—';

    final statusColor = switch (record.status) {
      'confirmed' => Colors.green,
      'pending' => Colors.orange,
      'failed' => Colors.red,
      _ => colorScheme.onSurface,
    };

    return ListTile(
      onTap: url != null
          ? () => launchUrl(Uri.parse(url),
              mode: LaunchMode.externalApplication)
          : null,
      title: Row(
        children: [
          Text('\$${record.amountUsdc.toStringAsFixed(2)} USDC'),
          const SizedBox(width: 8),
          Text(
            record.chain.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
      subtitle: Text('$dateFormatted  $hashDisplay'),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: statusColor.withAlpha(30),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          record.status[0].toUpperCase() + record.status.substring(1),
          style: TextStyle(
            color: statusColor,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    try {
      final dt = DateTime.parse(isoDate);
      return DateFormat.yMMMd().format(dt);
    } catch (_) {
      return isoDate;
    }
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, size: 48,
              color: Theme.of(context).colorScheme.error),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
