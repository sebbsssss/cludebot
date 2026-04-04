import 'package:flutter/material.dart';

import '../models/display_message.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({super.key, required this.message});

  final DisplayMessage message;

  @override
  Widget build(BuildContext context) {
    return switch (message) {
      SettledMessage m => _SettledBubble(message: m),
      StreamingMessage m => _StreamingBubble(message: m),
    };
  }
}

class _SettledBubble extends StatelessWidget {
  const _SettledBubble({required this.message});

  final SettledMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';
    final colorScheme = Theme.of(context).colorScheme;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isUser ? colorScheme.primary : colorScheme.secondary,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            message.content,
            style: TextStyle(
              color: isUser ? colorScheme.onPrimary : colorScheme.onSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _StreamingBubble extends StatelessWidget {
  const _StreamingBubble({required this.message});

  final StreamingMessage message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: colorScheme.secondary,
            borderRadius: BorderRadius.circular(16),
          ),
          child: message.content.isEmpty
              ? Text(
                  '...',
                  style: TextStyle(
                    color: colorScheme.onSecondary.withAlpha(150),
                    fontSize: 20,
                  ),
                )
              : Text(
                  message.content,
                  style: TextStyle(color: colorScheme.onSecondary),
                ),
        ),
      ),
    );
  }
}
