// Desktop notifications (the "pop up" outside the browser tab).
// Browsers require the user to grant permission first.

export function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    // eslint-disable-next-line no-new
    new Notification(title, { body });
  }
}
