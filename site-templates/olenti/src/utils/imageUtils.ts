// Генератор SVG изображений для продуктов
export const generateProductImage = (name: string, index: number): string => {
  const colors = [
    { primary: '#3a9d63', secondary: '#8fd4a8', accent: '#2d7f4f' },
    { primary: '#5bb87d', secondary: '#bce5cc', accent: '#3a9d63' },
    { primary: '#2d7f4f', secondary: '#5bb87d', accent: '#1d432f' },
  ]
  const color = colors[index % colors.length]
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color.primary};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${color.secondary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color.accent};stop-opacity:1" />
        </linearGradient>
        <filter id="blur${index}">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
        </filter>
      </defs>
      <rect width="400" height="400" fill="url(#grad${index})"/>
      <circle cx="200" cy="150" r="60" fill="${color.accent}" opacity="0.3" filter="url(#blur${index})"/>
      <circle cx="250" cy="250" r="40" fill="${color.primary}" opacity="0.2" filter="url(#blur${index})"/>
      <circle cx="150" cy="280" r="50" fill="${color.secondary}" opacity="0.25" filter="url(#blur${index})"/>
      <text x="200" y="320" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle" opacity="0.8">${name.substring(0, 15)}</text>
    </svg>
  `)}`
}

// Генератор SVG изображений для мастер-классов
export const generateMasterclassImage = (title: string, index: number): string => {
  const colors = [
    { primary: '#f49538', secondary: '#fbd5a8', accent: '#f17a13' },
    { primary: '#3a9d63', secondary: '#8fd4a8', accent: '#2d7f4f' },
  ]
  const color = colors[index % colors.length]
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mgrad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color.primary};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color.secondary};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#mgrad${index})"/>
      <circle cx="200" cy="120" r="50" fill="${color.accent}" opacity="0.3"/>
      <text x="200" y="200" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle" opacity="0.9">${title.substring(0, 20)}</text>
    </svg>
  `)}`
}
