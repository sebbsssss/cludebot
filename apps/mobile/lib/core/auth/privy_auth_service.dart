import 'dart:async';

import 'package:dio/dio.dart';
import 'package:uni_links/uni_links.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/env.dart';

/// Handles the Privy wallet OAuth flow via system browser + deep-link callback.
///
/// Flow: open browser → user connects wallet on hosted auth page →
/// page redirects to clude://auth/callback?token=JWT&wallet=ADDRESS →
/// app receives callback → calls POST /api/chat/auto-register → returns API key.
///
/// The hosted auth page at `${Env.apiBaseUrl}/auth/mobile` must embed Privy's
/// React SDK and redirect back with token + wallet params. This page does not
/// exist yet — see spec 007 backend dependency.
class PrivyAuthService {
  StreamSubscription<Uri?>? _linkSub;

  /// Starts the OAuth flow and returns API key + wallet on success.
  Future<({String apiKey, String wallet})> startOAuthFlow() async {
    // 1. Build auth URL (hosted page that embeds Privy SDK)
    final uri = Uri.parse('${Env.apiBaseUrl}/auth/mobile').replace(
      queryParameters: {
        'app_id': Env.privyAppId,
        'redirect_uri': 'clude://auth/callback',
      },
    );

    // 2. Open system browser
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('Could not open authentication page.');
    }

    // 3. Wait for deep-link callback
    final callbackUri = await _waitForCallback();
    final token = callbackUri.queryParameters['token'];
    final wallet = callbackUri.queryParameters['wallet'];

    if (token == null || wallet == null) {
      throw Exception('Missing token or wallet in callback.');
    }

    // 4. Exchange for API key via auto-register
    final result = await _autoRegister(token, wallet);
    return (apiKey: result, wallet: wallet);
  }

  /// Listens for the deep-link callback URI.
  Future<Uri> _waitForCallback({
    Duration timeout = const Duration(minutes: 5),
  }) {
    final completer = Completer<Uri>();

    _linkSub = uriLinkStream.listen(
      (uri) {
        if (uri != null &&
            uri.scheme == 'clude' &&
            uri.host == 'auth' &&
            uri.path.startsWith('/callback')) {
          _linkSub?.cancel();
          completer.complete(uri);
        }
      },
      onError: (Object err) {
        _linkSub?.cancel();
        completer.completeError(err);
      },
    );

    return completer.future.timeout(timeout, onTimeout: () {
      _linkSub?.cancel();
      throw TimeoutException('Wallet connect timed out.', timeout);
    });
  }

  /// Calls POST /api/chat/auto-register with the Privy JWT.
  Future<String> _autoRegister(String privyToken, String wallet) async {
    final dio = Dio();
    final res = await dio.post(
      '${Env.apiBaseUrl}/api/chat/auto-register',
      data: {'wallet': wallet},
      options: Options(
        headers: {
          'Authorization': 'Bearer $privyToken',
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => true,
      ),
    );

    if (res.statusCode != 200) {
      throw Exception('Auto-register failed: ${res.statusCode}');
    }

    final apiKey = res.data['api_key'] as String?;
    if (apiKey == null) {
      throw Exception('No API key in auto-register response.');
    }
    return apiKey;
  }

  /// Cancel a pending OAuth flow.
  void cancel() {
    _linkSub?.cancel();
    _linkSub = null;
  }
}
