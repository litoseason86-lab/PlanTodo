import {useCallback, useRef, useState} from 'react';

type ToastType = 'success' | 'error';

export function useToast() {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearSuccess = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setSuccessMsg(null);
  }, []);

  const clearError = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    setErrorMsg(null);
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    if (type === 'success') {
      clearSuccess();
      setSuccessMsg(msg);
      successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3500);
      return;
    }

    clearError();
    setErrorMsg(msg);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 4500);
  }, [clearError, clearSuccess]);

  return {
    successMsg,
    errorMsg,
    showToast,
    clearSuccess,
    clearError,
  };
}
