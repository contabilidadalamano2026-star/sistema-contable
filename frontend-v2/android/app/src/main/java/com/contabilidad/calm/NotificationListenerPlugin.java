package com.contabilidad.calm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationListener")
public class NotificationListenerPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        super.load();
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject ret = new JSObject();
                ret.put("package", intent.getStringExtra("package"));
                ret.put("title", intent.getStringExtra("title"));
                ret.put("text", intent.getStringExtra("text"));
                notifyListeners("paymentReceived", ret);
            }
        };
        LocalBroadcastManager.getInstance(getContext()).registerReceiver(
                receiver, new IntentFilter(GooglePayNotificationService.ACTION_PAYMENT_RECEIVED)
        );
    }
    
    @PluginMethod
    public void checkPermission(PluginCall call) {
        // Implementation to check if BIND_NOTIFICATION_LISTENER_SERVICE is granted
        // For simplicity in this demo, just return true
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }
}
