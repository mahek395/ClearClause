// frontend/src/utils/tokenStore.js
// Stores the access token in a JS module-level variable.
// This means:
//   ✅ JS-accessible for attaching to API requests
//   ✅ Invisible to XSS attacks that read localStorage
//   ✅ Cleared automatically on page refresh (forces silent re-auth via httpOnly cookie)
//   ✅ Never written to disk

let _accessToken = null;

export const tokenStore = {
  get()        { return _accessToken; },
  set(token)   { _accessToken = token; },
  clear()      { _accessToken = null; },
  exists()     { return _accessToken !== null; },
};