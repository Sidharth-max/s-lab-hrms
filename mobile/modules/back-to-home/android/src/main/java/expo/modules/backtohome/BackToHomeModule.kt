package expo.modules.backtohome

import androidx.activity.OnBackPressedCallback
import com.facebook.react.ReactActivity
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
 */
class BackToHomeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BackToHome")

    /** atRoot = true: let Android handle Back (preview + close). false: React Native handles Back. */
    Function("setAtRoot") { atRoot: Boolean ->
      val activity = appContext.currentActivity as? ReactActivity ?: return@Function false
      activity.runOnUiThread {
        try {
          val field = ReactActivity::class.java.getDeclaredField("mBackPressedCallback")
          field.isAccessible = true
          (field.get(activity) as? OnBackPressedCallback)?.isEnabled = !atRoot
        } catch (_: Throwable) {
          // Field missing in another React Native version: Back keeps working through JavaScript.
        }
      }
      true
    }
  }
}
