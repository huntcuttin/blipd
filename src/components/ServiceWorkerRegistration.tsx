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
