package io.nvr.crickherose;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;

/**
 * Private, hardened wrapper around the live web app.
 * Pages never enter Chrome history; screenshots and the recent-apps preview are blocked;
 * TLS is pinned; the device lock is required after backgrounding.
 */
public class MainActivity extends AppCompatActivity {

    private static final String HOST = "nvr-io-web.vercel.app";
    private static final String API_HOST = "nvr-io-api.vercel.app";
    private static final String START_URL = "https://" + HOST + "/login";

    private static final int REQ_FILE = 10;
    private static final int REQ_PERM_MEDIA = 20;
    private static final int REQ_PERM_LOCATION = 21;
    private static final int REQ_PERM_CHOOSER = 22;

    private FrameLayout root;
    private WebView web;
    private AppLock appLock;

    private ValueCallback<Uri[]> fileCallback;
    private WebChromeClient.FileChooserParams chooserParams;
    private Uri cameraUri;

    private PermissionRequest pendingMediaRequest;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 33) {
            setRecentsScreenshotEnabled(false);
        }

        String threat = DeviceGuard.threat(this);
        if (threat != null) {
            showBlocked(threat);
            return;
        }

        WebView.setWebContentsDebuggingEnabled(false);

        root = new FrameLayout(this);
        root.setFilterTouchesWhenObscured(true);
        setContentView(root);

        appLock = new AppLock(this, root);
        if (!appLock.deviceLockAvailable()) {
            showBlocked(getString(R.string.lock_required));
            return;
        }

        web = new WebView(this);
        web.setFilterTouchesWhenObscured(true);
        root.addView(web, 0, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        hardenWebView(web);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutside(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
            }
        });
        web.setWebChromeClient(new Chrome());

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    private void hardenWebView(WebView view) {
        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSaveFormData(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(true);
        }
        s.setUserAgentString(s.getUserAgentString() + " NVRApp");
    }

    private void showBlocked(String reason) {
        TextView tv = new TextView(this);
        tv.setText(getString(R.string.security_blocked, reason));
        tv.setTextColor(0xFF334155);
        tv.setTextSize(16f);
        tv.setPadding(48, 96, 48, 48);
        setContentView(tv);
    }

    private static boolean isOwnSite(Uri uri) {
        if (uri == null || !"https".equals(uri.getScheme())) return false;
        String host = uri.getHost();
        return HOST.equalsIgnoreCase(host) || API_HOST.equalsIgnoreCase(host);
    }

    private static boolean isAllowedNavigation(Uri uri) {
        return uri != null
                && "https".equals(uri.getScheme())
                && HOST.equalsIgnoreCase(uri.getHost());
    }

    /** Returns true when the link was handed to another app instead of loading in the WebView. */
    private boolean openOutside(Uri uri) {
        if (isAllowedNavigation(uri)) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if ("about".equals(scheme) || "blob".equals(scheme) || "data".equals(scheme)) return false;

        // Never navigate the WebView to a third-party https page (would leave our pin / privacy shell).
        Uri target = uri;
        String host = uri.getHost() == null ? "" : uri.getHost();
        boolean googleMaps = host.endsWith("maps.google.com")
                || (host.equals("www.google.com") && uri.getPath() != null && uri.getPath().startsWith("/maps"));
        if (googleMaps) {
            String q = uri.getQueryParameter("q");
            if (q != null && q.matches("-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?")) {
                target = Uri.parse("geo:0,0?q=" + q);
            }
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, target);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            /* stay on current page */
        }
        return true;
    }

    private void showOffline() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;"
                + "height:90vh;margin:0;color:#334155;text-align:center'><div>"
                + "<p style='font-size:18px'>No internet connection</p>"
                + "<a href='" + START_URL + "' style='display:inline-block;margin-top:12px;padding:10px 20px;"
                + "background:#0f766e;color:#fff;border-radius:10px;text-decoration:none'>Try again</a>"
                + "</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private boolean has(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                boolean wantsCamera = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                }
                if (!wantsCamera || !isOwnSite(request.getOrigin())) {
                    request.deny();
                    return;
                }
                if (has(Manifest.permission.CAMERA)) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    if (pendingMediaRequest != null) pendingMediaRequest.deny();
                    pendingMediaRequest = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERM_MEDIA);
                }
            });
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (!isOwnSite(Uri.parse(origin))) {
                callback.invoke(origin, false, false);
                return;
            }
            if (has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                callback.invoke(origin, true, false);
            } else {
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }, REQ_PERM_LOCATION);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            chooserParams = params;
            if (!has(Manifest.permission.CAMERA)) {
                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERM_CHOOSER);
            } else {
                openChooser();
            }
            return true;
        }
    }

    private void openChooser() {
        FileChooserSpec spec = FileChooserSpec.from(chooserParams);

        Intent camera = null;
        cameraUri = null;
        if (spec.images && has(Manifest.permission.CAMERA)) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("no camera dir");
                File photo = File.createTempFile("photo_", ".jpg", dir);
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
                camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (IOException e) {
                camera = null;
                cameraUri = null;
            }
        }

        Intent launch;
        if (spec.capture && camera != null) {
            launch = camera;
        } else {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType(spec.images ? "image/*" : "*/*");
            if (spec.multiple) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            launch = Intent.createChooser(pick, "Choose photo");
            if (camera != null) launch.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try {
            startActivityForResult(launch, REQ_FILE);
        } catch (ActivityNotFoundException e) {
            finishChooser(null);
        }
    }

    private void finishChooser(Uri[] result) {
        if (fileCallback != null) fileCallback.onReceiveValue(result);
        fileCallback = null;
        chooserParams = null;
        cameraUri = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_FILE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            ClipData clip = data == null ? null : data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraUri != null) {
                result = new Uri[]{cameraUri};
            }
        }
        finishChooser(result);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        boolean granted = false;
        for (int g : grantResults) {
            if (g == PackageManager.PERMISSION_GRANTED) granted = true;
        }
        if (requestCode == REQ_PERM_MEDIA && pendingMediaRequest != null) {
            if (granted) {
                pendingMediaRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingMediaRequest.deny();
            }
            pendingMediaRequest = null;
        } else if (requestCode == REQ_PERM_LOCATION && pendingGeoCallback != null) {
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        } else if (requestCode == REQ_PERM_CHOOSER && fileCallback != null) {
            openChooser();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (appLock != null) appLock.onPause();
        clearClipboard();
    }

    @Override
    protected void onResume() {
        super.onResume();
        String threat = DeviceGuard.threat(this);
        if (threat != null) {
            showBlocked(threat);
            return;
        }
        if (appLock != null) appLock.onResume();
    }

    private void clearClipboard() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm == null) return;
            if (Build.VERSION.SDK_INT >= 28) {
                cm.clearPrimaryClip();
            } else {
                cm.setPrimaryClip(ClipData.newPlainText("", ""));
            }
        } catch (Exception ignored) {
            /* some OEMs restrict clipboard clear */
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (web != null && isFinishing()) {
            web.clearHistory();
            web.clearCache(true);
            web.clearFormData();
            CookieManager.getInstance().removeSessionCookies(null);
            deleteRecursively(new File(getCacheDir(), "camera"));
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    private static final class FileChooserSpec {
        boolean images;
        boolean capture;
        boolean multiple;

        static FileChooserSpec from(WebChromeClient.FileChooserParams params) {
            FileChooserSpec spec = new FileChooserSpec();
            spec.images = true;
            if (params == null) return spec;
            String[] accept = params.getAcceptTypes();
            if (accept != null && accept.length > 0) {
                boolean anyImage = false;
                boolean anyType = false;
                for (String a : accept) {
                    if (a == null || a.trim().isEmpty()) continue;
                    anyType = true;
                    if (a.contains("image")) anyImage = true;
                }
                spec.images = !anyType || anyImage;
            }
            spec.capture = params.isCaptureEnabled();
            spec.multiple = params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
            return spec;
        }
    }
}
