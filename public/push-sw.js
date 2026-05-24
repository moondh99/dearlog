self.addEventListener('push', (event) => {
  let payload = { title: 'Dearlog', body: '새 알림이 도착했습니다.' };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch {
    payload = { title: 'Dearlog', body: event.data ? event.data.text() : payload.body };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/metadata.json',
      data: payload,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(targetUrl));
});
