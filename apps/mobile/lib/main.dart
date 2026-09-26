import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// NVR.io mobile shell — same server data as the website.
/// Display name: NVR.io. Install with user permission only.
const String kAppUrl = String.fromEnvironment(
  'NVR_APP_URL',
  defaultValue: 'https://nvr-io-web.vercel.app/login',
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const NvrApp());
}

class NvrApp extends StatelessWidget {
  const NvrApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NVR.io',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1D4ED8),
          brightness: Brightness.dark,
          surface: const Color(0xFF0B1220),
        ),
        scaffoldBackgroundColor: const Color(0xFF0B1220),
        useMaterial3: true,
      ),
      home: const NvrHomePage(),
    );
  }
}

class NvrHomePage extends StatefulWidget {
  const NvrHomePage({super.key});

  @override
  State<NvrHomePage> createState() => _NvrHomePageState();
}

class _NvrHomePageState extends State<NvrHomePage> {
  late final WebViewController _controller;
  var _loading = true;
  var _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0B1220))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) => setState(() => _progress = value),
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (error) {
            setState(() => _loading = false);
          },
        ),
      )
      ..loadRequest(Uri.parse(kAppUrl));
  }

  Future<bool> _onWillPop() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await _onWillPop();
        if (leave && context.mounted) {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loading)
                const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image(
                        image: AssetImage('assets/logo.jpg'),
                        width: 96,
                        height: 96,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'NVR.io',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 12),
                      CircularProgressIndicator(color: Color(0xFF3B82F6)),
                    ],
                  ),
                ),
              if (_loading && _progress > 0 && _progress < 100)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: LinearProgressIndicator(
                    value: _progress / 100,
                    color: const Color(0xFF3B82F6),
                    backgroundColor: Colors.white12,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
