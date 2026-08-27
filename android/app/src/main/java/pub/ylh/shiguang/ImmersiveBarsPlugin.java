package pub.ylh.shiguang;

import android.app.Activity;

import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 沉浸式系统栏控制（屏保专用，勿全局常开——其他页面需要正常系统栏）。
 *
 * WebView 内 requestFullscreen 无权控制系统栏（实测：fullscreenchange 正常触发、
 * 状态栏仍浮在时钟上方），故提供原生入口：
 * - hide：状态栏+手势条（systemBars）一起隐藏，边缘滑动临时唤出（TRANSIENT）
 * - show：恢复 systemBars（targetSdk 36 强制 edge-to-edge 常态 = 内容延伸+系统栏浮层）
 *
 * 命名说明：@capacitor/core 8 内置了同名 SystemBars 插件（原生端
 * com.getcapacitor.plugin.SystemBars，hide/show/setStyle，无 TRANSIENT 滑动行为），
 * 撞名会导致 JS 侧注册警告/行为歧义——本插件特意取名 ImmersiveBars 以区分，
 * 差异化价值 = BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE（边缘滑动临时浮层唤出，不挤压布局）。
 */
@CapacitorPlugin(name = "ImmersiveBars")
public class ImmersiveBarsPlugin extends Plugin {

    private WindowInsetsControllerCompat insetsController() {
        Activity activity = getActivity();
        if (activity == null || activity.getWindow() == null) {
            return null;
        }
        return new WindowInsetsControllerCompat(
                activity.getWindow(),
                activity.getWindow().getDecorView());
    }

    @PluginMethod
    public void hide(PluginCall call) {
        WindowInsetsControllerCompat controller = insetsController();
        if (controller == null) {
            call.reject("activity not available");
            return;
        }
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        call.resolve();
    }

    @PluginMethod
    public void show(PluginCall call) {
        WindowInsetsControllerCompat controller = insetsController();
        if (controller == null) {
            call.reject("activity not available");
            return;
        }
        controller.show(WindowInsetsCompat.Type.systemBars());
        call.resolve();
    }
}
