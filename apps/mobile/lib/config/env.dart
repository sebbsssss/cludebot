class Env {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://clude.io',
  );
  static const String devBaseUrl = 'http://localhost:3000';

  static String get apiBaseUrl =>
      const bool.fromEnvironment('dart.vm.product') ? baseUrl : devBaseUrl;

  static const String privyAppId = String.fromEnvironment(
    'PRIVY_APP_ID',
    defaultValue: 'cmm8y16dq037y0cjr4nsqjtaa',
  );
}
