package io.nvr.crickherose;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

/**
 * Covers the WebView whenever the app leaves the foreground, then requires the phone's
 * biometric / PIN / pattern before showing content again.
 */
final class AppLock {

    private static final long LOCK_AFTER_MS = 8_000L;

    private final AppCompatActivity activity;
    private final FrameLayout root;
    private final View cover;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private long backgroundedAt;
    private boolean unlockedThisSession;
    private boolean promptShowing;

    AppLock(AppCompatActivity activity, FrameLayout root) {
        this.activity = activity;
        this.root = root;
        this.cover = buildCover();
        root.addView(cover, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        cover.setVisibility(View.VISIBLE);
    }

    boolean deviceLockAvailable() {
        int can = BiometricManager.from(activity).canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        return can == BiometricManager.BIOMETRIC_SUCCESS;
    }

    void onPause() {
        backgroundedAt = System.currentTimeMillis();
        cover.setVisibility(View.VISIBLE);
    }

    void onResume() {
        long away = backgroundedAt == 0 ? Long.MAX_VALUE : System.currentTimeMillis() - backgroundedAt;
        if (!unlockedThisSession || away >= LOCK_AFTER_MS) {
            cover.setVisibility(View.VISIBLE);
            requestUnlock();
        } else {
            cover.setVisibility(View.GONE);
        }
    }

    private void requestUnlock() {
        if (promptShowing) return;
        if (!deviceLockAvailable()) {
            ((TextView) cover.findViewWithTag("msg")).setText(
                    activity.getString(R.string.lock_required));
            return;
        }
        promptShowing = true;
        BiometricPrompt prompt = new BiometricPrompt(
                activity,
                ContextCompat.getMainExecutor(activity),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        promptShowing = false;
                        unlockedThisSession = true;
                        cover.setVisibility(View.GONE);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        promptShowing = false;
                        if (errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                                || errorCode == BiometricPrompt.ERROR_CANCELED) {
                            // Stay covered; offer another try shortly.
                            handler.postDelayed(AppLock.this::requestUnlock, 600);
                        } else {
                            ((TextView) cover.findViewWithTag("msg")).setText(
                                    activity.getString(R.string.lock_failed, errString));
                        }
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // BiometricPrompt keeps the sheet open for another try.
                    }
                });

        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(activity.getString(R.string.lock_title))
                .setSubtitle(activity.getString(R.string.lock_subtitle))
                .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                                | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();
        prompt.authenticate(info);
    }

    private View buildCover() {
        FrameLayout cover = new FrameLayout(activity);
        cover.setBackgroundColor(0xFFFFFFFF);
        cover.setClickable(true);
        cover.setFocusable(true);
        cover.setFilterTouchesWhenObscured(true);

        TextView msg = new TextView(activity);
        msg.setTag("msg");
        msg.setText(activity.getString(R.string.lock_title));
        msg.setTextColor(0xFF334155);
        msg.setTextSize(18f);
        msg.setPadding(48, 48, 48, 48);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = android.view.Gravity.CENTER;
        cover.addView(msg, lp);
        return cover;
    }
}
