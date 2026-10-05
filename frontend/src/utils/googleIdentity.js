// Google Identity Services, loaded once per page however many buttons mount.
let loader = null;

export const loadGoogleIdentity = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        loader = null; // let a later mount try again
        reject(new Error('Google sign-in could not load'));
      };
      document.head.appendChild(script);
    });
  }
  return loader;
};
