import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

interface ProgressData {
  type: string;
  current?: number;
  total?: number;
  teamid?: string;
  teamname?: string;
  playerid?: string;
  playername?: string;
  status?: string;
  percentage?: number;
  found_link?: boolean;
  found_links?: number;
  total_teams?: number;
  total_players?: number;
  found_percentage?: number;
  estimated_time_remaining?: string;
  estimated_completion_time?: string;
  elapsed_time?: string;
  total_elapsed_time?: string;
  processing_speed?: number;
  last_updated?: string;
  function_name?: string;
  message?: string;
  // Batch loading fields
  batch_size?: number;
  batch_start?: number;
  batch_end?: number;
  // Дополнительные поля для Transfermarkt
  successful_teams?: number;
  success_percentage?: number;
  players_found?: number;
  has_error?: boolean;
  // Дополнительные поля для парсинга лиг
  confederation?: string;
  page?: number;
  page_leagues?: number;
  // Дополнительные поля для add_teams операции
  operation?: string;
  current_team?: string;
  current_category?: string;
  category_progress?: number;
  completed_teams?: string[];
  // Player processing fields
  current_processing_player?: string;
  players_processing_progress?: Record<string, {
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    message?: string;
  }>;
  team_data?: any;
}

interface ProgressContextType {
  progresses: ProgressData[];
  wsConnected: boolean;
  getActiveProcesses: () => ProgressData[];
  getTotalActiveCount: () => number;
  clearAllProgress: () => void;
  forceReconnect: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

interface ProgressProviderProps {
  children: React.ReactNode;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ children }) => {
  const [progresses, setProgresses] = useState<ProgressData[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 50; // Увеличено для более агрессивного переподключения
  const isReconnecting = useRef(false);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const lastPongTime = useRef<number>(Date.now());
  const connectionAttemptTime = useRef<number>(0);

  // Функция для получения уникального ID процесса
  const getProcessId = (progressData: ProgressData): string => {
    return progressData.function_name || 'unknown_process';
  };

  // Функции для получения информации о процессах
  const getActiveProcesses = (): ProgressData[] => {
    return progresses.filter(p => 
      p.status === 'processing' || 
      p.status === 'starting' || 
      (p.status !== 'completed' && p.status !== 'error' && p.status !== 'cancelled' && p.current !== p.total && p.percentage !== 100)
    );
  };

  const getTotalActiveCount = (): number => {
    return getActiveProcesses().length;
  };

  // Функция для ручной очистки всех процессов
  const clearAllProgress = () => {
    console.log('Clearing all progress data');
    setProgresses([]);
    localStorage.removeItem('activeProgresses');
  };

  // Очистка localStorage от старых неактивных процессов
  const cleanupOldProcesses = () => {
    try {
      const stored = localStorage.getItem('activeProgresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Удаляем все процессы старше 5 минут или завершенные процессы старше 30 секунд
        const cleanProgresses = parsed.filter((progress: ProgressData & { timestamp?: number }) => {
          if (!progress.timestamp) return false;
          
          const age = now - progress.timestamp;
          const fiveMinutes = 5 * 60 * 1000;
          const thirtySeconds = 30 * 1000;
          
          // Удаляем завершенные/отмененные процессы старше 30 секунд
          if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
            return age < thirtySeconds;
          }
          
          // Удаляем любые процессы старше 5 минут
          if (age > fiveMinutes) {
            return false;
          }
          
          // Удаляем процессы, которые выглядят завершенными (100% или current === total)
          if (progress.percentage === 100 || (progress.current && progress.total && progress.current >= progress.total)) {
            return age < thirtySeconds;
          }
          
          return true;
        });
        
        if (cleanProgresses.length !== parsed.length) {
          console.log('Cleaned up old processes from localStorage');
          if (cleanProgresses.length === 0) {
            localStorage.removeItem('activeProgresses');
          } else {
            localStorage.setItem('activeProgresses', JSON.stringify(cleanProgresses));
          }
        }
        
        return cleanProgresses;
      }
    } catch (error) {
      console.error('Error cleaning up old processes:', error);
      localStorage.removeItem('activeProgresses');
    }
    return [];
  };

  // Восстановление прогресса из localStorage
  const restoreProgressFromStorage = () => {
    try {
      const cleanProgresses = cleanupOldProcesses();
      
      if (cleanProgresses.length > 0) {
        // Фильтруем только действительно активные процессы
        const activeProgresses = cleanProgresses.filter((progress: ProgressData) => {
          return progress.status === 'processing' || 
                 progress.status === 'starting' ||
                 (progress.status !== 'completed' && 
                  progress.status !== 'error' && 
                  progress.status !== 'cancelled' &&
                  progress.percentage !== 100 &&
                  !(progress.current && progress.total && progress.current >= progress.total));
        });
        
        if (activeProgresses.length > 0) {
          console.log('Restored active progresses from localStorage:', activeProgresses);
          setProgresses(activeProgresses);
        } else {
          console.log('No active progresses found in localStorage');
          localStorage.removeItem('activeProgresses');
        }
      }
    } catch (error) {
      console.error('Error restoring progresses from localStorage:', error);
      localStorage.removeItem('activeProgresses');
    }
  };

  // Сохранение прогресса в localStorage
  const saveProgressToStorage = (progressesData: ProgressData[]) => {
    try {
      const dataWithTimestamp = progressesData.map(progress => ({
        ...progress,
        timestamp: Date.now()
      }));
      localStorage.setItem('activeProgresses', JSON.stringify(dataWithTimestamp));
    } catch (error) {
      console.error('Error saving progresses to localStorage:', error);
    }
  };

  // Проверка состояния соединения
  const checkConnectionHealth = useCallback(() => {
    if (!isMounted.current) return;

    const now = Date.now();
    const timeSinceLastPong = now - lastPongTime.current;
    const timeSinceConnectionAttempt = now - connectionAttemptTime.current;

    // Если WebSocket не подключен или не отвечает на ping более 60 секунд
    if (!wsRef.current || 
        wsRef.current.readyState !== WebSocket.OPEN || 
        timeSinceLastPong > 60000) {
      
      console.warn('WebSocket connection unhealthy, forcing reconnection...', {
        hasWebSocket: !!wsRef.current,
        readyState: wsRef.current?.readyState,
        timeSinceLastPong,
        timeSinceConnectionAttempt
      });
      
      // Принудительно переподключаемся, если прошло достаточно времени с последней попытки
      if (timeSinceConnectionAttempt > 5000) {
        forceReconnect();
      }
    }
  }, []);

  // Принудительное переподключение
  const forceReconnect = useCallback(() => {
    console.log('Force reconnecting WebSocket...');
    
    // Сбрасываем счетчик попыток для немедленного переподключения
    reconnectAttempts.current = 0;
    isReconnecting.current = false;
    
    // Закрываем существующее соединение
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.debug('Error closing WebSocket during force reconnect:', e);
      }
      wsRef.current = null;
    }
    
    // Очищаем все таймеры
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setWsConnected(false);
    
    // Немедленно пытаемся переподключиться
    setTimeout(() => {
      if (isMounted.current) {
        connectWebSocket();
      }
    }, 100);
  }, []);

  const connectWebSocket = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isReconnecting.current || !isMounted.current) {
      return;
    }

    // Check if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isReconnecting.current = true;
    connectionAttemptTime.current = Date.now();

    try {
      // Clean up existing connection if any
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        // Only close if not already closing or closed
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.close();
          } catch (e) {
            console.debug('Error closing previous WebSocket:', e);
          }
        }
        wsRef.current = null;
      }

      console.log(`Creating new WebSocket connection... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      // Устанавливаем таймаут для соединения
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('WebSocket connection timeout, closing...');
          ws.close();
        }
      }, 10000); // 10 секунд на подключение

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        
        if (!isMounted.current) return;
        
        console.log('✅ WebSocket connected successfully');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        isReconnecting.current = false;
        lastPongTime.current = Date.now();

        // Start ping interval to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
              console.debug('Sent ping to server');
            } catch (e) {
              console.debug('Error sending ping:', e);
            }
          }
        }, 20000); // Send ping every 20 seconds
      };

      ws.onmessage = (event) => {
        if (!isMounted.current) return;

        try {
          const data: ProgressData = JSON.parse(event.data);
          
          // Handle pong messages
          if (data.type === 'pong') {
            lastPongTime.current = Date.now();
            console.debug('Received pong from server');
            return;
          }
          
          // Ignore ping and connected messages
          if (data.type === 'ping' || data.type === 'connected') {
            return;
          }

          console.log('Received WebSocket message:', data);

          setProgresses(prev => {
            const processId = getProcessId(data);
            let newProgresses;

            if (data.type === 'error') {
              // Для ошибок обновляем существующий процесс или добавляем новый
              const existingIndex = prev.findIndex(p => getProcessId(p) === processId);
              if (existingIndex !== -1) {
                newProgresses = prev.map((p, index) =>
                  index === existingIndex ? { ...p, ...data } : p
                );
              } else {
                newProgresses = [...prev, data];
              }
            } else if (data.status === 'completed' || data.status === 'cancelled') {
              // Для завершенных/отмененных процессов обновляем или добавляем
              const existingIndex = prev.findIndex(p => getProcessId(p) === processId);
              if (existingIndex !== -1) {
                newProgresses = prev.map((p, index) =>
                  index === existingIndex ? { ...p, ...data } : p
                );
              } else {
                newProgresses = [...prev, data];
              }
              
              // Удаляем завершенные/отмененные процессы через 5 секунд
              setTimeout(() => {
                if (!isMounted.current) return;
                setProgresses(current => {
                  const filtered = current.filter(p => !(getProcessId(p) === processId && (p.status === 'completed' || p.status === 'cancelled')));
                  // Обновляем localStorage
                  saveProgressToStorage(filtered);
                  return filtered;
                });
              }, 5000);
            } else {
              // Для активных процессов обновляем существующий или добавляем новый
              const existingIndex = prev.findIndex(p => getProcessId(p) === processId);
              if (existingIndex !== -1) {
                newProgresses = prev.map((p, index) => {
                  if (index === existingIndex) {
                    // Обновляем данные команды, включая информацию о текущем игроке
                    const updatedProgress = { ...p, ...data };
                    
                    // Если есть данные о команде, обновляем их
                    if (data.team_data) {
                      updatedProgress.team_data = { 
                        ...p.team_data, 
                        ...data.team_data 
                      };
                    }
                    
                    // Обновляем информацию о текущем обрабатываемом игроке
                    if (data.current_processing_player) {
                      updatedProgress.current_processing_player = data.current_processing_player;
                    }
                    
                    // Обновляем прогресс обработки игроков
                    if (data.players_processing_progress) {
                      updatedProgress.players_processing_progress = {
                        ...p.players_processing_progress,
                        ...data.players_processing_progress
                      };
                    }
                    
                    return updatedProgress;
                  }
                  return p;
                });
              } else {
                newProgresses = [...prev, data];
              }
            }

            // Сохраняем в localStorage
            saveProgressToStorage(newProgresses);
            return newProgresses;
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        if (!isMounted.current) return;

        console.log('❌ WebSocket disconnected', event.code, event.reason);
        setWsConnected(false);
        wsRef.current = null;
        isReconnecting.current = false;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Don't reconnect if it was a clean close or component is unmounting
        if (event.code === 1000 || !isMounted.current) {
          return;
        }

        // Более агрессивное переподключение
        if (reconnectAttempts.current < maxReconnectAttempts && isMounted.current) {
          // Уменьшенная задержка для более быстрого переподключения
          const delay = Math.min(Math.pow(1.5, reconnectAttempts.current) * 1000, 10000); // Max 10 seconds
          console.log(`🔄 Attempting to reconnect in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted.current) {
              reconnectAttempts.current++;
              connectWebSocket();
            }
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. Will retry in 30 seconds...');
          // Сбрасываем счетчик и пытаемся снова через 30 секунд
          setTimeout(() => {
            if (isMounted.current) {
              reconnectAttempts.current = 0;
              connectWebSocket();
            }
          }, 30000);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
        isReconnecting.current = false;
      };

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      isReconnecting.current = false;
      
      // Retry connection after delay
      if (reconnectAttempts.current < maxReconnectAttempts && isMounted.current) {
        const delay = Math.min(Math.pow(1.5, reconnectAttempts.current) * 1000, 10000);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted.current) {
            reconnectAttempts.current++;
            connectWebSocket();
          }
        }, delay);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    restoreProgressFromStorage();
    
    // Add a small delay before initial connection to ensure everything is initialized
    const connectionTimer = setTimeout(() => {
      if (isMounted.current) {
        connectWebSocket();
      }
    }, 100);

    // Устанавливаем интервал для периодической очистки старых процессов
    const cleanupInterval = setInterval(() => {
      if (!isMounted.current) return;
      
      const cleanProgresses = cleanupOldProcesses();
      setProgresses(current => {
        const activeProgresses = cleanProgresses.filter((progress: ProgressData) => {
          return progress.status === 'processing' ||
                 progress.status === 'starting' ||
                 (progress.status !== 'completed' &&
                  progress.status !== 'error' &&
                  progress.status !== 'cancelled' &&
                  progress.percentage !== 100 &&
                  !(progress.current && progress.total && progress.current >= progress.total));
        });
        
        if (activeProgresses.length !== current.length ||
            JSON.stringify(activeProgresses) !== JSON.stringify(current)) {
          console.log('Periodic cleanup: updating progresses');
          return activeProgresses;
        }
        return current;
      });
    }, 30000); // Каждые 30 секунд

    // Устанавливаем интервал для проверки состояния соединения
    connectionCheckIntervalRef.current = setInterval(checkConnectionHealth, 15000); // Каждые 15 секунд

    // Обработка видимости страницы для переподключения WebSocket
    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted.current) {
        console.log('Page became visible, checking WebSocket connection...');
        // Проверяем соединение через небольшую задержку
        setTimeout(() => {
          if (isMounted.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            console.log('WebSocket not connected, forcing reconnection...');
            forceReconnect();
          }
        }, 1000);
      }
    };

    // Обработка фокуса окна
    const handleWindowFocus = () => {
      if (isMounted.current) {
        console.log('Window focused, checking WebSocket connection...');
        setTimeout(() => {
          if (isMounted.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            console.log('WebSocket not connected after focus, forcing reconnection...');
            forceReconnect();
          }
        }, 500);
      }
    };

    // Обработка онлайн/оффлайн статуса
    const handleOnline = () => {
      if (isMounted.current) {
        console.log('Network came online, checking WebSocket connection...');
        setTimeout(() => {
          if (isMounted.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            console.log('WebSocket not connected after coming online, forcing reconnection...');
            forceReconnect();
          }
        }, 2000);
      }
    };

    // Добавляем обработчики событий
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // Cleanup function
    return () => {
      isMounted.current = false;
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      
      // Clear all intervals and timeouts
      if (connectionTimer) {
        clearTimeout(connectionTimer);
      }
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        
        // Remove all event listeners first
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        
        // Only close if not already closing or closed
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, 'Component unmounting');
          } catch (e) {
            console.debug('Error closing WebSocket on unmount:', e);
          }
        }
      }
    };
  }, [connectWebSocket, checkConnectionHealth, forceReconnect]);

  const value: ProgressContextType = {
    progresses,
    wsConnected,
    getActiveProcesses,
    getTotalActiveCount,
    clearAllProgress,
    forceReconnect
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}; 