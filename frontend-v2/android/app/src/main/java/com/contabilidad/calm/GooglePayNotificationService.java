package com.contabilidad.calm;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import android.content.Intent;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

public class GooglePayNotificationService extends NotificationListenerService {

    public static final String ACTION_PAYMENT_RECEIVED = "com.contabilidad.calm.PAYMENT_RECEIVED";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // Filter for Google Pay, Bank apps, etc.
        // For demonstration we will match a generic check or let the bridge filter it.
        // e.g., com.google.android.apps.walletnfcrel
        
        Bundle extras = sbn.getNotification().extras;
        String title = extras.getString("android.title");
        String text = extras.getCharSequence("android.text") != null ? extras.getCharSequence("android.text").toString() : "";
        
        if (title != null && (title.toLowerCase().contains("pago") || text.toLowerCase().contains("recibiste"))) {
            Intent intent = new Intent(ACTION_PAYMENT_RECEIVED);
            intent.putExtra("package", packageName);
            intent.putExtra("title", title);
            intent.putExtra("text", text);
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Not used
    }
}
