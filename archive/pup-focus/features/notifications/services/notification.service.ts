export type NotificationPayload = {
  userId: string;
  title: string;
  message: string;
};

export async function queueNotification(payload: NotificationPayload) {
  return {
    ok: true,
    queuedAt: new Date().toISOString(),
    payload,
  };
}
