// Подавление ошибок подключения в dev режиме
if (import.meta.env.DEV) {
  const isConnectionError = (error: unknown): boolean => {
    if (typeof error === 'string') {
      return (
        error.includes('ERR_CONNECTION_REFUSED') ||
        error.includes('ERR_NETWORK') ||
        error.includes('Network Error') ||
        error.includes('ECONNREFUSED') ||
        error.includes('Failed to fetch') ||
        error.includes('net::ERR_CONNECTION_REFUSED')
      )
    }
    
    if (error instanceof Error) {
      return (
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('Network Error') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('net::ERR_CONNECTION_REFUSED')
      )
    }
    
    if (error && typeof error === 'object') {
      const err = error as { code?: string; message?: string; name?: string }
      return (
        err.code === 'ERR_NETWORK' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('ERR_CONNECTION_REFUSED') ||
        err.message?.includes('ERR_NETWORK') ||
        err.message?.includes('Network Error') ||
        err.name === 'NetworkError'
      )
    }
    
    return false
  }

  // Сохраняем оригинальные методы
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn

  // Переопределяем console.error
  console.error = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : 
      arg instanceof Error ? arg.message : 
      JSON.stringify(arg)
    ).join(' ')
    
    if (isConnectionError(message) || args.some(isConnectionError)) {
      return // Подавляем ошибки подключения
    }
    
    originalConsoleError.apply(console, args)
  }

  // Переопределяем console.warn для сетевых предупреждений
  console.warn = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : 
      arg instanceof Error ? arg.message : 
      JSON.stringify(arg)
    ).join(' ')
    
    if (isConnectionError(message) || args.some(isConnectionError)) {
      return // Подавляем предупреждения о подключении
    }
    
    originalConsoleWarn.apply(console, args)
  }

  // Глобальный обработчик ошибок
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes('ERR_CONNECTION_REFUSED') ||
      event.message?.includes('ERR_NETWORK') ||
      event.message?.includes('Network Error') ||
      event.message?.includes('Failed to fetch') ||
      event.filename?.includes('xhr.js') ||
      event.filename?.includes('dispatchRequest')
    ) {
      event.preventDefault()
    }
  }, true)

  // Глобальный обработчик необработанных промисов
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason
    if (isConnectionError(error)) {
      event.preventDefault()
    }
  })
}
