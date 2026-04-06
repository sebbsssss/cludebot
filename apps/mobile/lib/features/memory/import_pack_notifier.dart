import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client_provider.dart';
import 'import_pack_state.dart';

final importPackNotifierProvider =
    StateNotifierProvider<ImportPackNotifier, ImportPackState>(
  (ref) => ImportPackNotifier(ref),
);

class ImportPackNotifier extends StateNotifier<ImportPackState> {
  ImportPackNotifier(this._ref) : super(const ImportPackState.idle());

  final Ref _ref;
  Map<String, dynamic>? _lastParsedPack;

  Future<void> pickFile() async {
    state = const ImportPackState.picking();
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['json'],
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        state = const ImportPackState.idle();
        return;
      }

      final file = result.files.first;

      // Size check: reject >10MB.
      if (file.size > 10 * 1024 * 1024) {
        state = const ImportPackState.error(
          message: 'File is too large. Maximum 10 MB.',
        );
        return;
      }

      final bytes = file.bytes;
      if (bytes == null) {
        state = const ImportPackState.error(message: 'Could not read file.');
        return;
      }

      final content = utf8.decode(bytes);
      final pack = _parseAndValidate(content);
      if (pack == null) return; // state already set to error

      await _runImport(pack);
    } catch (e) {
      if (mounted) {
        state = ImportPackState.error(message: e.toString());
      }
    }
  }

  Future<void> pasteFromClipboard() async {
    try {
      final clipData = await Clipboard.getData(Clipboard.kTextPlain);
      final text = clipData?.text?.trim();

      if (text == null || text.isEmpty) {
        state = const ImportPackState.error(message: 'Clipboard is empty.');
        return;
      }

      final pack = _parseAndValidate(text);
      if (pack == null) return;

      await _runImport(pack);
    } catch (e) {
      if (mounted) {
        state = ImportPackState.error(message: e.toString());
      }
    }
  }

  Map<String, dynamic>? _parseAndValidate(String content) {
    dynamic parsed;
    try {
      parsed = jsonDecode(content);
    } catch (_) {
      state = const ImportPackState.error(
        message: 'Does not contain valid JSON.',
      );
      return null;
    }

    if (parsed is! Map<String, dynamic>) {
      state = const ImportPackState.error(
        message: 'Pack must be a JSON object.',
      );
      return null;
    }

    if (parsed.isEmpty) {
      state = const ImportPackState.error(
        message: 'Pack contains no memories.',
      );
      return null;
    }

    return parsed;
  }

  Future<void> _runImport(Map<String, dynamic> pack) async {
    _lastParsedPack = pack;
    state = const ImportPackState.importing();
    try {
      final client = _ref.read(apiClientProvider);
      final result = await client.importMemoryPack(pack);
      if (!mounted) return;
      state = ImportPackState.success(imported: result.imported);
    } catch (e) {
      if (!mounted) return;
      state = ImportPackState.error(message: e.toString());
    }
  }

  Future<void> retry() async {
    if (_lastParsedPack != null) {
      await _runImport(_lastParsedPack!);
    }
  }

  void reset() {
    state = const ImportPackState.idle();
  }

  @visibleForTesting
  void setStateForTest(ImportPackState newState) {
    state = newState;
  }
}
