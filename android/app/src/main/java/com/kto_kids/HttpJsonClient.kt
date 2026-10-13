package com.kto_kids

import java.io.BufferedWriter
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/** Tiny JSON-over-HTTP POST helper shared by native background sync paths. */
object HttpJsonClient {
  /** Returns null on 2xx success, otherwise a short error description. */
  fun postJson(url: String, jsonBody: String): String? {
    return try {
      val connection =
        (URL(url).openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = 15000
          readTimeout = 15000
          doOutput = true
          setRequestProperty("Content-Type", "application/json")
        }

      BufferedWriter(OutputStreamWriter(connection.outputStream, Charsets.UTF_8)).use { writer ->
        writer.write(jsonBody)
      }

      val code = connection.responseCode
      if (code in 200..299) null else "HTTP $code"
    } catch (t: Throwable) {
      t.message ?: "network_error"
    }
  }

  /** Posts to the first URL that accepts it (2xx); returns true on success. */
  fun postFirstSuccess(urls: List<String>, jsonBody: String): Boolean {
    for (url in urls) {
      if (postJson(url, jsonBody) == null) return true
    }
    return false
  }
}
