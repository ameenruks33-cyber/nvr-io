# Keep WebView / biometric entry points when R8 shrinks the release APK.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class androidx.biometric.** { *; }
-dontwarn androidx.biometric.**
