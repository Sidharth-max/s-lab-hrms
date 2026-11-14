package expo.modules.backtohome

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android predictive back on the start screen.
 *
 * React Native's ReactActivity always keeps an enabled back callback (it forwards every Back to
 * JavaScript). While a callback is enabled, Android cannot play its own back-to-home preview during
 * the swipe. On the app's start screen (Today, nothing open on top) the app turns that callback off,
 * so Android handles Back itself: the swipe shows the real back-to-home preview and the app closes.
 * Everywhere else it is on again and Back works inside the app as before.
 *
 * The classes are looked up at run time (this small module does not link React Native or AndroidX);
 * if anything is missing, nothing changes and Back keeps working through JavaScript.
 */
class BackToHomeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BackToHome")

    /** atRoot = true: let Android handle Back (preview + close). false: React Native handles Back. */
    Function("setAtRoot") { atRoot: Boolean ->
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        try {
          var cls: Class<*>? = activity.javaClass
          var field: java.lang.reflect.Field? = null
          while (cls != null && field == null) {
            field = try { cls.getDeclaredField("mBackPressedCallback") } catch (_: NoSuchFieldException) { null }
            cls = cls.superclass
          }
          val callback = field?.let { it.isAccessible = true; it.get(activity) } ?: return@runOnUiThread
          callback.javaClass.getMethod("setEnabled", Boolean::class.javaPrimitiveType).invoke(callback, !atRoot)
        } catch (_: Throwable) {
          // Not available in this React Native version: Back keeps working through JavaScript.
        }
      }
      true
    }
  }
}
