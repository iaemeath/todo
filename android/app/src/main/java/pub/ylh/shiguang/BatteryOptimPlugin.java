package pub.ylh.shiguang;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 电池优化豁免引导（提醒可靠性的官方干预点）：纯本地闹钟提醒会被部分 ROM 的
 * 激进查杀（划掉=强停语义，闹钟被系统清空）吞掉；标准系统对此的唯一公开入口是
 * 请求「忽略电池优化」（Doze 白名单）。ROM 私有的自启动/后台管理无公开 Intent，
 * 只能靠设置页文案引导。
 *
 * 标准 API（PowerManager/Settings），无第三方依赖，Android 6.0+ 全版本可用。
 */
@CapacitorPlugin(name = "BatteryOptim")
public class BatteryOptimPlugin extends Plugin {

    /** 当前是否已在忽略电池优化白名单（设置页状态文案用） */
    @PluginMethod
    public void getStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("ignoring", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    /** 拉起系统「忽略电池优化？」确认弹窗（需清单声明 REQUEST_IGNORE_BATTERY_OPTIMIZATIONS） */
    @PluginMethod
    public void requestIgnore(PluginCall call) {
        Intent intent = new Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getContext().getPackageName()));
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            // 极少数 ROM 裁剪了该入口：reject 让 JS 侧走文案引导兜底
            call.reject("battery-optimization-dialog-unavailable", ex);
        }
    }
}
