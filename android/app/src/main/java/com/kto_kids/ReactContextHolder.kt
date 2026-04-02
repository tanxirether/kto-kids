package com.kto_kids

import com.facebook.react.bridge.ReactApplicationContext
import java.lang.ref.WeakReference

object ReactContextHolder {
  @Volatile private var ref: WeakReference<ReactApplicationContext>? = null

  fun set(ctx: ReactApplicationContext) {
    ref = WeakReference(ctx)
  }

  fun get(): ReactApplicationContext? = ref?.get()
}

