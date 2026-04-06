// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'chat_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$ChatState {
  List<SettledMessage> get settled => throw _privateConstructorUsedError;
  StreamingMessage? get streamingMsg => throw _privateConstructorUsedError;
  bool get isLoadingOlder => throw _privateConstructorUsedError;
  bool get hasMore => throw _privateConstructorUsedError;
  String? get oldestTimestamp => throw _privateConstructorUsedError;
  String? get title => throw _privateConstructorUsedError;
  String? get model => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;

  /// Create a copy of ChatState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChatStateCopyWith<ChatState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChatStateCopyWith<$Res> {
  factory $ChatStateCopyWith(ChatState value, $Res Function(ChatState) then) =
      _$ChatStateCopyWithImpl<$Res, ChatState>;
  @useResult
  $Res call({
    List<SettledMessage> settled,
    StreamingMessage? streamingMsg,
    bool isLoadingOlder,
    bool hasMore,
    String? oldestTimestamp,
    String? title,
    String? model,
    String? error,
  });
}

/// @nodoc
class _$ChatStateCopyWithImpl<$Res, $Val extends ChatState>
    implements $ChatStateCopyWith<$Res> {
  _$ChatStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChatState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? settled = null,
    Object? streamingMsg = freezed,
    Object? isLoadingOlder = null,
    Object? hasMore = null,
    Object? oldestTimestamp = freezed,
    Object? title = freezed,
    Object? model = freezed,
    Object? error = freezed,
  }) {
    return _then(
      _value.copyWith(
            settled: null == settled
                ? _value.settled
                : settled // ignore: cast_nullable_to_non_nullable
                      as List<SettledMessage>,
            streamingMsg: freezed == streamingMsg
                ? _value.streamingMsg
                : streamingMsg // ignore: cast_nullable_to_non_nullable
                      as StreamingMessage?,
            isLoadingOlder: null == isLoadingOlder
                ? _value.isLoadingOlder
                : isLoadingOlder // ignore: cast_nullable_to_non_nullable
                      as bool,
            hasMore: null == hasMore
                ? _value.hasMore
                : hasMore // ignore: cast_nullable_to_non_nullable
                      as bool,
            oldestTimestamp: freezed == oldestTimestamp
                ? _value.oldestTimestamp
                : oldestTimestamp // ignore: cast_nullable_to_non_nullable
                      as String?,
            title: freezed == title
                ? _value.title
                : title // ignore: cast_nullable_to_non_nullable
                      as String?,
            model: freezed == model
                ? _value.model
                : model // ignore: cast_nullable_to_non_nullable
                      as String?,
            error: freezed == error
                ? _value.error
                : error // ignore: cast_nullable_to_non_nullable
                      as String?,
          )
          as $Val,
    );
  }
}

/// @nodoc
abstract class _$$ChatStateImplCopyWith<$Res>
    implements $ChatStateCopyWith<$Res> {
  factory _$$ChatStateImplCopyWith(
    _$ChatStateImpl value,
    $Res Function(_$ChatStateImpl) then,
  ) = __$$ChatStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    List<SettledMessage> settled,
    StreamingMessage? streamingMsg,
    bool isLoadingOlder,
    bool hasMore,
    String? oldestTimestamp,
    String? title,
    String? model,
    String? error,
  });
}

/// @nodoc
class __$$ChatStateImplCopyWithImpl<$Res>
    extends _$ChatStateCopyWithImpl<$Res, _$ChatStateImpl>
    implements _$$ChatStateImplCopyWith<$Res> {
  __$$ChatStateImplCopyWithImpl(
    _$ChatStateImpl _value,
    $Res Function(_$ChatStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of ChatState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? settled = null,
    Object? streamingMsg = freezed,
    Object? isLoadingOlder = null,
    Object? hasMore = null,
    Object? oldestTimestamp = freezed,
    Object? title = freezed,
    Object? model = freezed,
    Object? error = freezed,
  }) {
    return _then(
      _$ChatStateImpl(
        settled: null == settled
            ? _value._settled
            : settled // ignore: cast_nullable_to_non_nullable
                  as List<SettledMessage>,
        streamingMsg: freezed == streamingMsg
            ? _value.streamingMsg
            : streamingMsg // ignore: cast_nullable_to_non_nullable
                  as StreamingMessage?,
        isLoadingOlder: null == isLoadingOlder
            ? _value.isLoadingOlder
            : isLoadingOlder // ignore: cast_nullable_to_non_nullable
                  as bool,
        hasMore: null == hasMore
            ? _value.hasMore
            : hasMore // ignore: cast_nullable_to_non_nullable
                  as bool,
        oldestTimestamp: freezed == oldestTimestamp
            ? _value.oldestTimestamp
            : oldestTimestamp // ignore: cast_nullable_to_non_nullable
                  as String?,
        title: freezed == title
            ? _value.title
            : title // ignore: cast_nullable_to_non_nullable
                  as String?,
        model: freezed == model
            ? _value.model
            : model // ignore: cast_nullable_to_non_nullable
                  as String?,
        error: freezed == error
            ? _value.error
            : error // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc

class _$ChatStateImpl implements _ChatState {
  const _$ChatStateImpl({
    final List<SettledMessage> settled = const [],
    this.streamingMsg,
    this.isLoadingOlder = false,
    this.hasMore = true,
    this.oldestTimestamp,
    this.title,
    this.model,
    this.error,
  }) : _settled = settled;

  final List<SettledMessage> _settled;
  @override
  @JsonKey()
  List<SettledMessage> get settled {
    if (_settled is EqualUnmodifiableListView) return _settled;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_settled);
  }

  @override
  final StreamingMessage? streamingMsg;
  @override
  @JsonKey()
  final bool isLoadingOlder;
  @override
  @JsonKey()
  final bool hasMore;
  @override
  final String? oldestTimestamp;
  @override
  final String? title;
  @override
  final String? model;
  @override
  final String? error;

  @override
  String toString() {
    return 'ChatState(settled: $settled, streamingMsg: $streamingMsg, isLoadingOlder: $isLoadingOlder, hasMore: $hasMore, oldestTimestamp: $oldestTimestamp, title: $title, model: $model, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChatStateImpl &&
            const DeepCollectionEquality().equals(other._settled, _settled) &&
            const DeepCollectionEquality().equals(
              other.streamingMsg,
              streamingMsg,
            ) &&
            (identical(other.isLoadingOlder, isLoadingOlder) ||
                other.isLoadingOlder == isLoadingOlder) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore) &&
            (identical(other.oldestTimestamp, oldestTimestamp) ||
                other.oldestTimestamp == oldestTimestamp) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.model, model) || other.model == model) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(_settled),
    const DeepCollectionEquality().hash(streamingMsg),
    isLoadingOlder,
    hasMore,
    oldestTimestamp,
    title,
    model,
    error,
  );

  /// Create a copy of ChatState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChatStateImplCopyWith<_$ChatStateImpl> get copyWith =>
      __$$ChatStateImplCopyWithImpl<_$ChatStateImpl>(this, _$identity);
}

abstract class _ChatState implements ChatState {
  const factory _ChatState({
    final List<SettledMessage> settled,
    final StreamingMessage? streamingMsg,
    final bool isLoadingOlder,
    final bool hasMore,
    final String? oldestTimestamp,
    final String? title,
    final String? model,
    final String? error,
  }) = _$ChatStateImpl;

  @override
  List<SettledMessage> get settled;
  @override
  StreamingMessage? get streamingMsg;
  @override
  bool get isLoadingOlder;
  @override
  bool get hasMore;
  @override
  String? get oldestTimestamp;
  @override
  String? get title;
  @override
  String? get model;
  @override
  String? get error;

  /// Create a copy of ChatState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChatStateImplCopyWith<_$ChatStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
