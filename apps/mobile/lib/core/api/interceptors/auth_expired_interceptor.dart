import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/auth_provider.dart';

class AuthExpiredInterceptor extends Interceptor {
  final Ref _ref;

  AuthExpiredInterceptor(this._ref);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      final auth = _ref.read(authNotifierProvider);
      if (auth.isAuthenticated) {
        _ref.read(authNotifierProvider.notifier).clearAuth();
        // GoRouter redirect handles navigation to /login
      }
    }
    handler.next(err);
  }
}
