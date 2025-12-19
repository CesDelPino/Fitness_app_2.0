// Service Worker registration for PWA installability
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('✅ Service Worker registered successfully!', {
            scope: registration.scope,
            updatefound: registration.installing !== null
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', {
            message: error.message,
            name: error.name,
            error: error
          });
        });
    });
  } else {
    console.warn('Service Workers are not supported in this browser');
  }
}
