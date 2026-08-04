import { ref } from 'vue';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error';
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

export function useToast() {
  const show = (message: string, type: 'success' | 'info' | 'error' = 'success', duration = 3000) => {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  };

  return { toasts, show };
}
