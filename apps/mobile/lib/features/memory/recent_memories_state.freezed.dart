// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'recent_memories_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$RecentMemoriesState {
  List<MemorySummary> get items => throw _privateConstructorUsedError;
  bool get isLoading => throw _privateConstructorUsedError;
  bool get isLoadingMore => throw _privateConstructorUsedError;
  bool get hasMore => throw _privateConstructorUsedError;
  String? get error => throw _privateConstructorUsedError;

  /// Create a copy of RecentMemoriesState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RecentMemoriesStateCopyWith<RecentMemoriesState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RecentMemoriesStateCopyWith<$Res> {
  factory $RecentMemoriesStateCopyWith(
    RecentMemoriesState value,
    $Res Function(RecentMemoriesState) then,
  ) = _$RecentMemoriesStateCopyWithImpl<$Res, RecentMemoriesState>;
  @useResult
  $Res call({
    List<MemorySummary> items,
    bool isLoading,
    bool isLoadingMore,
    bool hasMore,
    String? error,
  });
}

/// @nodoc
class _$RecentMemoriesStateCopyWithImpl<$Res, $Val extends RecentMemoriesState>
    implements $RecentMemoriesStateCopyWith<$Res> {
  _$RecentMemoriesStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RecentMemoriesState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? isLoading = null,
    Object? isLoadingMore = null,
    Object? hasMore = null,
    Object? error = freezed,
  }) {
    return _then(
      _value.copyWith(
            items: null == items
                ? _value.items
                : items // ignore: cast_nullable_to_non_nullable
                      as List<MemorySummary>,
            isLoading: null == isLoading
                ? _value.isLoading
                : isLoading // ignore: cast_nullable_to_non_nullable
                      as bool,
            isLoadingMore: null == isLoadingMore
                ? _value.isLoadingMore
                : isLoadingMore // ignore: cast_nullable_to_non_nullable
                      as bool,
            hasMore: null == hasMore
                ? _value.hasMore
                : hasMore // ignore: cast_nullable_to_non_nullable
                      as bool,
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
abstract class _$$RecentMemoriesStateImplCopyWith<$Res>
    implements $RecentMemoriesStateCopyWith<$Res> {
  factory _$$RecentMemoriesStateImplCopyWith(
    _$RecentMemoriesStateImpl value,
    $Res Function(_$RecentMemoriesStateImpl) then,
  ) = __$$RecentMemoriesStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({
    List<MemorySummary> items,
    bool isLoading,
    bool isLoadingMore,
    bool hasMore,
    String? error,
  });
}

/// @nodoc
class __$$RecentMemoriesStateImplCopyWithImpl<$Res>
    extends _$RecentMemoriesStateCopyWithImpl<$Res, _$RecentMemoriesStateImpl>
    implements _$$RecentMemoriesStateImplCopyWith<$Res> {
  __$$RecentMemoriesStateImplCopyWithImpl(
    _$RecentMemoriesStateImpl _value,
    $Res Function(_$RecentMemoriesStateImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of RecentMemoriesState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? isLoading = null,
    Object? isLoadingMore = null,
    Object? hasMore = null,
    Object? error = freezed,
  }) {
    return _then(
      _$RecentMemoriesStateImpl(
        items: null == items
            ? _value._items
            : items // ignore: cast_nullable_to_non_nullable
                  as List<MemorySummary>,
        isLoading: null == isLoading
            ? _value.isLoading
            : isLoading // ignore: cast_nullable_to_non_nullable
                  as bool,
        isLoadingMore: null == isLoadingMore
            ? _value.isLoadingMore
            : isLoadingMore // ignore: cast_nullable_to_non_nullable
                  as bool,
        hasMore: null == hasMore
            ? _value.hasMore
            : hasMore // ignore: cast_nullable_to_non_nullable
                  as bool,
        error: freezed == error
            ? _value.error
            : error // ignore: cast_nullable_to_non_nullable
                  as String?,
      ),
    );
  }
}

/// @nodoc

class _$RecentMemoriesStateImpl implements _RecentMemoriesState {
  const _$RecentMemoriesStateImpl({
    final List<MemorySummary> items = const [],
    this.isLoading = true,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.error,
  }) : _items = items;

  final List<MemorySummary> _items;
  @override
  @JsonKey()
  List<MemorySummary> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  @JsonKey()
  final bool isLoading;
  @override
  @JsonKey()
  final bool isLoadingMore;
  @override
  @JsonKey()
  final bool hasMore;
  @override
  final String? error;

  @override
  String toString() {
    return 'RecentMemoriesState(items: $items, isLoading: $isLoading, isLoadingMore: $isLoadingMore, hasMore: $hasMore, error: $error)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RecentMemoriesStateImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.isLoading, isLoading) ||
                other.isLoading == isLoading) &&
            (identical(other.isLoadingMore, isLoadingMore) ||
                other.isLoadingMore == isLoadingMore) &&
            (identical(other.hasMore, hasMore) || other.hasMore == hasMore) &&
            (identical(other.error, error) || other.error == error));
  }

  @override
  int get hashCode => Object.hash(
    runtimeType,
    const DeepCollectionEquality().hash(_items),
    isLoading,
    isLoadingMore,
    hasMore,
    error,
  );

  /// Create a copy of RecentMemoriesState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RecentMemoriesStateImplCopyWith<_$RecentMemoriesStateImpl> get copyWith =>
      __$$RecentMemoriesStateImplCopyWithImpl<_$RecentMemoriesStateImpl>(
        this,
        _$identity,
      );
}

abstract class _RecentMemoriesState implements RecentMemoriesState {
  const factory _RecentMemoriesState({
    final List<MemorySummary> items,
    final bool isLoading,
    final bool isLoadingMore,
    final bool hasMore,
    final String? error,
  }) = _$RecentMemoriesStateImpl;

  @override
  List<MemorySummary> get items;
  @override
  bool get isLoading;
  @override
  bool get isLoadingMore;
  @override
  bool get hasMore;
  @override
  String? get error;

  /// Create a copy of RecentMemoriesState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RecentMemoriesStateImplCopyWith<_$RecentMemoriesStateImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
