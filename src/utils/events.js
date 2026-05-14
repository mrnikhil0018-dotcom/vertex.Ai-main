const listeners = {};

export const onEvent = (name, callback) => {
  listeners[name] = listeners[name] || new Set();
  listeners[name].add(callback);
  return () => listeners[name]?.delete(callback);
};

export const emitEvent = (name, payload) => {
  listeners[name]?.forEach(callback => callback(payload));
};
