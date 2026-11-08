// Content scripts cannot be ES modules, so this classic script loads the module
// entry point from the extension package (listed in web_accessible_resources).
(async () => {
  try {
    const { start } = await import(chrome.runtime.getURL('content/main.js'));
    await start();
  } catch (error) {
    // Never let extension failures affect Google Search itself.
    console.warn('[Keyword Volume Finder] failed to start:', error);
  }
})();
