package com.kto_kids

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

class BlockedAppActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }

    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
    )

    val pkg = intent.getStringExtra("blockedPackage") ?: ""

    val root =
      LinearLayout(this).apply {
        setBackgroundColor(Color.BLACK)
        gravity = Gravity.CENTER
        orientation = LinearLayout.VERTICAL
        layoutParams =
          ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
          )
        setPadding(48, 48, 48, 48)
      }

    val title =
      TextView(this).apply {
        text = "App blocked"
        setTextColor(Color.WHITE)
        textSize = 24f
        gravity = Gravity.CENTER
      }

    val subtitle =
      TextView(this).apply {
        text = if (pkg.isNotBlank()) pkg else "This app is not allowed right now."
        setTextColor(Color.LTGRAY)
        textSize = 14f
        gravity = Gravity.CENTER
      }

    root.addView(title)
    root.addView(subtitle)
    setContentView(root)
  }
}

