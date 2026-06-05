import { useEffect, useRef } from 'react';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

/**
 * Custom hook to poll chat task status from the backend.
 * Automatically manages cleaning up timeout triggers on unmount, task change, or chat change.
 * 
 * @param {string|null} taskId - The active background task ID to poll.
 * @param {string|null} activeChatId - The currently selected active chat ID.
 * @param {object} callbacks - Callback configuration.
 * @param {function} callbacks.onSuccess - Called when status is 'completed'. Receives task result.
 * @param {function} callbacks.onError - Called when status is 'failed' or if checking status fails.
 */
export const useChatPolling = (taskId, activeChatId, { onSuccess, onError }) => {
  const timerRef = useRef(null);
  
  // Keep the latest callbacks in a mutable ref to avoid re-triggering the effect
  const callbacksRef = useRef({ onSuccess, onError });
  
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // If there is no active task ID, ensure timers are cleared and exit
    if (!taskId) {
      clearTimer();
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/status/${taskId}`);
        if (!response.ok) {
          throw new Error('No se pudo verificar el estado de la consulta.');
        }

        const taskData = await response.json();

        if (taskData.status === 'completed') {
          callbacksRef.current.onSuccess(taskData.result);
        } else if (taskData.status === 'failed') {
          throw new Error(taskData.error || 'Error en el procesamiento backend.');
        } else {
          // If task status is pending/running, schedule next check in 2 seconds
          timerRef.current = setTimeout(pollStatus, 2000);
        }
      } catch (err) {
        callbacksRef.current.onError(err);
      }
    };

    // Reset timer when taskId or activeChatId changes
    clearTimer();
    
    // Start polling with an initial delay of 1.5 seconds
    timerRef.current = setTimeout(pollStatus, 1500);

    // Cleanup timer on dependencies change or component unmount
    return () => {
      clearTimer();
    };
  }, [taskId, activeChatId]);
};
export default useChatPolling;
