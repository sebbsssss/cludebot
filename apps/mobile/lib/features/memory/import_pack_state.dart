import 'package:freezed_annotation/freezed_annotation.dart';

part 'import_pack_state.freezed.dart';

@freezed
sealed class ImportPackState with _$ImportPackState {
  const factory ImportPackState.idle() = ImportPackIdle;
  const factory ImportPackState.picking() = ImportPackPicking;
  const factory ImportPackState.importing() = ImportPackImporting;
  const factory ImportPackState.success({required int imported}) =
      ImportPackSuccess;
  const factory ImportPackState.error({required String message}) =
      ImportPackError;
}
