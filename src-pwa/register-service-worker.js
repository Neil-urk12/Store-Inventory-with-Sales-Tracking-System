import { register } from 'register-service-worker'
import { Notify } from 'quasar'

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their arguments.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

register(process.env.SERVICE_WORKER_FILE, {
  // The registrationOptions object will be passed as the second argument
  // to ServiceWorkerContainer.register()
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

  registrationOptions: { scope: './' },

  ready (registration) {
    console.log('Service worker is active.')
    // Initialize push notifications if needed
    initializePushNotifications(registration)
  },

  registered (registration) {
    console.log('Service worker has been registered.')
    // Check for updates periodically
    setInterval(() => {
      registration.update()
    }, 1000 * 60 * 60) // Check every hour
  },

  cached (registration) {
    console.log('Content has been cached for offline use.')
    Notify.create({
      message: 'App ready for offline use',
      color: 'positive'
    })
  },

  updatefound (registration) {
    console.log('New content is downloading.')
    Notify.create({
      message: 'New content is downloading...',
      color: 'info'
    })
  },

  updated (registration) {
    console.log('New content is available; please refresh.')
    Notify.create({
      message: 'New content is available!',
      caption: 'Please refresh the page',
      color: 'negative',
      actions: [
        {
          label: 'Refresh',
          color: 'white',
          handler: () => {
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' })
              window.location.reload()
            } else 
              window.location.reload()
          }
        }
      ],
      timeout: 0
    })
  },

  offline () {
    console.log('No internet connection found. App is running in offline mode.')
    Notify.create({
      message: 'No internet connection',
      caption: 'App is running in offline mode',
      color: 'warning'
    })
  },

  error (error) {
    console.error('Error during service worker registration:', error)
    Notify.create({
      message: 'Service worker registration error',
      caption: error.message,
      color: 'negative'
    })
  }
})

// Helper function for push notifications
async function initializePushNotifications(registration) {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      // Setup push notification subscription
      try {
        const options = {
          userVisibleOnly: true,
          applicationServerKey: process.env.VAPID_PUBLIC_KEY
        }
        const subscription = await registration.pushManager.subscribe(options)
        console.log('Push notification subscription:', subscription)
        // Send subscription to your server
      } catch (error) {
        console.error('Push notification subscription error:', error)
      }
    }
  }
}
