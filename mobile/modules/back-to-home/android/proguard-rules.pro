-keepclassmembers class com.facebook.react.ReactActivity {
  private androidx.activity.OnBackPressedCallback mBackPressedCallback;
}
-keepclassmembers class androidx.activity.OnBackPressedCallback {
  public void setEnabled(boolean);
}
