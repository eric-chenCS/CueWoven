let busy = false;
const listeners = new Set();
export const libraryBusy = () => busy;
export const onLibraryBusy = (listener) => listeners.add(listener);
export function beginLibraryTask() {
  if (busy) return null;
  busy = true;
  for (const listener of listeners) listener();
  return () => {
    busy = false;
    for (const listener of listeners) listener();
  };
}
