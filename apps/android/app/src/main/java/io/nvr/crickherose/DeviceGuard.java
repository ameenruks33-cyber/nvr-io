package io.nvr.crickherose;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Debug;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Locale;

/**
 * Blocks the app on rooted, debugger-attached, or obviously tampered devices.
 */
final class DeviceGuard {

    private DeviceGuard() {}

    /** @return human reason to refuse starting, or null when the device looks clean. */
    static String threat(Context context) {
        if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) {
            return "Debugger attached";
        }
        boolean debuggable =
                (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable && !BuildConfig.DEBUG) {
            return "Debuggable package";
        }
        if (isRooted()) {
            return "Device integrity check failed";
        }
        if (isHostileInstrumentationPresent()) {
            return "Hostile instrumentation detected";
        }
        return null;
    }

    private static boolean isRooted() {
        String[] paths = {
                "/system/bin/su",
                "/system/xbin/su",
                "/sbin/su",
                "/system/app/Superuser.apk",
                "/system/app/SuperSU.apk",
                "/system/xbin/daemonsu",
                "/data/local/su",
                "/data/local/bin/su",
                "/data/local/xbin/su",
                "/su/bin/su",
                "/sbin/.magisk",
                "/data/adb/magisk",
                "/data/adb/modules",
        };
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }
        String tags = Build.TAGS;
        if (tags != null && tags.toLowerCase(Locale.US).contains("test-keys")) return true;

        Process process = null;
        try {
            process = Runtime.getRuntime().exec(new String[]{"which", "su"});
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line = reader.readLine();
            reader.close();
            if (line != null && !line.trim().isEmpty()) return true;
        } catch (IOException ignored) {
            /* no shell helper */
        } finally {
            if (process != null) process.destroy();
        }
        return false;
    }

    private static boolean isHostileInstrumentationPresent() {
        String[] markers = {"frida", "xposed", "substrate"};
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/self/maps"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String lower = line.toLowerCase(Locale.US);
                for (String marker : markers) {
                    if (lower.contains(marker)) return true;
                }
            }
        } catch (IOException ignored) {
            /* maps unavailable */
        }
        return false;
    }
}
