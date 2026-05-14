export type ToastType = 'success' | 'error' | 'info';

export interface ToastEvent {
  id: string;
  message: string;
  type: ToastType;
}

function dispatch(type: ToastType, message: string) {
  const event = new CustomEvent<ToastEvent>('anachron-toast', {
    detail: {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
    },
  });
  window.dispatchEvent(event);
}

export const toast = {
  success: (message: string) => dispatch('success', message),
  error: (message: string) => dispatch('error', message),
  info: (message: string) => dispatch('info', message),
};
