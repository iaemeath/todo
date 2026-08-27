package pub.ylh.shiguang;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 自定义插件：沉浸式系统栏控制（屏保全屏时隐藏状态栏/手势条，TRANSIENT 滑动唤出）
        registerPlugin(ImmersiveBarsPlugin.class);
    }
}
