package pub.ylh.shiguang;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
