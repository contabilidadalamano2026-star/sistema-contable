package com.contabilidad.calm;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationListenerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
