import AsyncStorage from "@react-native-async-storage/async-storage";
import instance from "../api/api_instance";
import { getCurrentLocation } from "./AccessibilityServiceBridge";

/**
 * Sends an SOS alert for this device to the parents (POST /alerts, type "SOS").
 * The current location is attached when it can be read; the alert is sent even without it.
 */
export async function sendSos() {
  const trackId = String((await AsyncStorage.getItem("trackid")) || "").trim();
  if (!trackId) {
    throw new Error("This device is not linked to a parent yet.");
  }

  let location = null;
  try {
    location = await getCurrentLocation();
  } catch (e) {
    location = null;
  }

  const payload = {
    trackId,
    type: "SOS",
    message: "Emergency! Your child pressed the SOS button.",
  };
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.latitude = latitude;
    payload.longitude = longitude;
  }

  const response = await instance.post("/alerts", payload, { timeout: 15000 });
  return { alert: response?.data?.data, hasLocation: "latitude" in payload };
}
