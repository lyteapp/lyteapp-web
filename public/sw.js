self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nuevo pedido', {
      body: data.body || 'Tienes un pedido asignado',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'delivery',
      renotify: true,
      // requireInteraction isn't supported on Safari/iOS — some WebKit
      // versions handle an unrecognized option by falling back to a bare
      // system sound instead of rendering the custom banner at all.
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if (client.url.includes(event.notification.data?.url || '/') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(event.notification.data?.url || '/')
    })
  )
})
