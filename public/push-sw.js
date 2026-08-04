self.addEventListener('push', (event) => {
  let payload = { title: 'Dearlog', body: '새 알림이 도착했습니다.' };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch {
    payload = { title: 'Dearlog', body: event.data ? event.data.text() : payload.body };
  }

  event.waitUntil(
    // icon 은 지정하지 않습니다. 예전에는 /metadata.json 을 넣었는데 그런 파일도 없고
    // 이미지도 아니라서 브라우저가 아이콘 없이 그렸습니다.
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 앱이 이미 열려 있으면 창을 새로 띄우지 않고 그 창을 앞으로 가져옵니다.
      const existing = windowClients.find((client) => 'focus' in client);
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) {
          await existing.navigate(targetUrl).catch(() => undefined);
        }
        return;
      }
      await clients.openWindow(targetUrl);
    })()
  );
});
