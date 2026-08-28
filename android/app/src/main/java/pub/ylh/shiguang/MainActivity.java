package pub.ylh.shiguang;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自定义插件必须在 super.onCreate 之前注册：BridgeActivity.onCreate 尾部的
        // load() 就会用 bridgeBuilder 构建 bridge，之后再 registerPlugin 等于空操作
        registerPlugin(BatteryOptimPlugin.class);
        super.onCreate(savedInstanceState);

        // 官方 edge-to-edge 三件套的最后一块（SHORT_EDGES + viewport-fit=cover 已就位）：
        // 关掉 decor 级 inset 让位，WebView 才能真正铺满到挖孔/栏区。Android 15+ 系统
        // 已强制 edge-to-edge（此行等价 belt-and-suspenders）；<15 上是白条根因的修复。
        // 前提：SystemBars 插件 passthrough 生效（WebView ≥140 + viewport-fit=cover），
        // 让位职责移交注入的 --safe-area-inset-* 变量；WebView <140 的老设备会退化为
        // 栏叠内容（该组合 2026 年已不现实，遇真机再议）
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // 横屏内容延伸进挖孔区（SHORT_EDGES）：默认 cutoutMode 会让 WebView 避开
        // 横屏后位于左侧的摄像头挖孔，露出 window 白底（真机"左侧白条"根因）；
        // 屏保纯黑底延伸无视觉副作用，Android 15 强制 edge-to-edge 下为官方推荐模式
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // 全局系统栏唤出策略：隐藏态下边缘滑动=临时浮层唤出并自动消退（TRANSIENT），
        // 系统栏保持隐藏、全屏不被破坏（退出只靠应用内按钮）。官方 SystemBars 插件
        // 无 behavior API，此处一次性设置全局策略；系统栏常显的页面不受影响
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView())
                .setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
