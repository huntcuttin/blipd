"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export default function ServiceWorkerRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        if (!user) return;
        if (Notification.permission !== "granted") return;
        const token = await getAccessToken();
        if (token) await subscribeToPush(registration, token);
      })
      .catch((err) => console.error("SW registration failed:", err));
  }, [user]);

  return null;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const token = await getAccessToken();
    if (!token) return false;
    const registration = await navigator.serviceWorker.ready;
    await subscribeToPush(registration, token);
    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

async function subscribeToPush(registration: ServiceWorkerRegistration, token: string) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(subscription.toJSON()),
  });
}

// Call before signing out — otherwise the push subscription row survives
// sign-out entirely, and on a shared device the browser hands the *same*
// existing subscription (see subscribeToPush's getSubscription() ?? ...
// above) to whoever logs in next, silently reassigning it to them.
export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const token = await getAccessToken();
    if (token) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }

    // Unsubscribe at the browser level too, so the next user on this device
    // gets a fresh subscription rather than inheriting this one.
    await subscription.unsubscribe();
  } catch (err) {
    console.error("Failed to unsubscribe from push:", err);
  }
}
