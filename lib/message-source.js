// Extension UI can live in a tab; its browser-provided URL identifies the sender.
export function isExtensionPage(sender, runtime, paths) {
  return sender?.id === runtime.id && !(sender.frameId > 0) &&
    typeof sender.url === 'string' && paths.some(path => sender.url.split('#')[0] === runtime.getURL(path));
}
