import React, { useEffect, useRef, useState } from 'react'
import { Leaf, Flower2, Sparkles } from 'lucide-react'

interface NatureBackgroundProps {
  className?: string
}

export const NatureBackground: React.FC<NatureBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  const [noMotion, setNoMotion] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkMotion = () => {
      const hasNoMotion = document.body.classList.contains('effect-no-motion')
      const isAmbientDisabled = document.body.classList.contains('effect-ambient-disabled')
      setNoMotion(hasNoMotion || isAmbientDisabled)
    }
    checkMotion()
    const observer = new MutationObserver(checkMotion)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mounted) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Частицы листьев
    interface Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      rotation: number
      rotationSpeed: number
      opacity: number
      color: string
    }

    const particles: Particle[] = []
    const particleCount = 36

    const colors = ['#4f8f7f', '#6faa99', '#bfdccd', '#d08c2c', '#3a7264']

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 22 + 10,
        speedX: (Math.random() - 0.5) * 0.45,
        speedY: Math.random() * 0.35 + 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        opacity: Math.random() * 0.35 + 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const drawLeaf = (x: number, y: number, size: number, rotation: number, opacity: number, color: string) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.globalAlpha = opacity

      // Рисуем лист с градиентом
      const gradient = ctx.createLinearGradient(-size * 0.6, -size, size * 0.6, size)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, color + '80')

      ctx.beginPath()
      ctx.fillStyle = gradient
      ctx.ellipse(0, 0, size * 0.6, size, 0, 0, Math.PI * 2)
      ctx.fill()

      // Центральная жилка
      ctx.beginPath()
      ctx.strokeStyle = color + 'aa'
      ctx.lineWidth = 1.2
      ctx.moveTo(0, -size * 0.7)
      ctx.lineTo(0, size * 0.7)
      ctx.stroke()

      // Боковые жилки
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue
        ctx.beginPath()
        ctx.strokeStyle = color + '60'
        ctx.lineWidth = 0.45
        ctx.moveTo(0, -size * 0.25)
        ctx.lineTo(size * 0.42 * (i / 2), size * 0.28)
        ctx.stroke()
      }

      ctx.restore()
    }

    let animationFrame: number
    const animate = () => {
      if (noMotion) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY
        particle.rotation += particle.rotationSpeed

        // Плавное изменение прозрачности
        particle.opacity += (Math.random() - 0.5) * 0.015
        particle.opacity = Math.max(0.1, Math.min(0.45, particle.opacity))

        if (particle.x < -30) particle.x = canvas.width + 30
        if (particle.x > canvas.width + 30) particle.x = -30
        if (particle.y > canvas.height + 30) {
          particle.y = -30
          particle.x = Math.random() * canvas.width
        }

        drawLeaf(particle.x, particle.y, particle.size, particle.rotation, particle.opacity, particle.color)
      })

      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [mounted, noMotion])

  if (!mounted) return null

  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden pointer-events-none ${className}`}>
      {/* Градиентный фон с мягким движением */}
      <div className="absolute inset-0 bg-nature-canvas opacity-85" />
      <div className={`absolute inset-0 bg-gradient-to-br from-primary-50/55 via-neutral-50/28 to-accent-50/20 ${noMotion ? '' : 'animate-gradient-shift'}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_22%,rgba(99,149,126,0.42),transparent_62%),radial-gradient(circle_at_82%_18%,rgba(219,170,101,0.38),transparent_58%),radial-gradient(circle_at_32%_82%,rgba(74,118,95,0.32),transparent_60%),radial-gradient(circle_at_78%_78%,rgba(181,210,179,0.28),transparent_62%)]" />
      <div
        className="absolute inset-0 opacity-25 mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233a7264' stop-opacity='0.25'/%3E%3Cstop offset='100%25' stop-color='%23d08c2c' stop-opacity='0.18'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M55 35c22 12 32 32 22 52-15-10-35-8-52 8-14-24-6-47 30-60z' fill='url(%23g)' fill-opacity='0.45'/%3E%3Cpath d='M170 70c18 10 26 26 18 42-12-8-28-6-42 6-11-19-5-38 24-48z' fill='url(%23g)' fill-opacity='0.35'/%3E%3Cpath d='M110 150c26-7 46 6 58 28-30 10-56 5-82-18 6-8 13-8 24-10z' fill='url(%23g)' fill-opacity='0.28'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Световые вуали */}
      <div className="absolute inset-0">
        <div className="absolute inset-x-[-10%] top-[-25%] h-[55vh] bg-gradient-to-b from-primary-200/28 via-transparent to-transparent blur-3xl" />
        <div className="absolute inset-x-[-20%] bottom-[-30%] h-[60vh] bg-gradient-to-t from-accent-200/24 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-[12%] left-[8%] w-[420px] h-[420px] rounded-full bg-gradient-to-br from-primary-300/26 via-primary-200/12 to-transparent blur-2xl" />
        <div className="absolute bottom-[14%] right-[12%] w-[460px] h-[460px] rounded-full bg-gradient-to-tr from-accent-300/24 via-transparent to-transparent blur-2xl" />
      </div>

      {/* Декоративные элементы */}
      <div className="absolute top-0 left-0 w-full h-full">
        {/* Плавающие листья */}
        {[...Array(20)].map((_, i) => {
          const delay = Math.random() * 8
          const duration = 8 + Math.random() * 6
          const startX = Math.random() * 100
          const startY = Math.random() * 100

          return (
            <div
              key={`leaf-${i}`}
              className={`absolute ${noMotion ? '' : 'animate-float'}`}
              style={{
                left: `${startX}%`,
                top: `${startY}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            >
              <Leaf
                size={18 + Math.random() * 24}
                className="text-primary-400/45 drop-shadow-[0_8px_18px_rgba(17,41,35,0.25)]"
                style={{ filter: 'blur(0.3px)' }}
              />
            </div>
          )
        })}

        {/* Плавающие цветы */}
        {[...Array(12)].map((_, i) => {
          const delay = Math.random() * 10
          const duration = 10 + Math.random() * 8

          return (
            <div
              key={`flower-${i}`}
              className={`absolute ${noMotion ? '' : 'animate-float'}`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            >
              <Flower2
                size={14 + Math.random() * 16}
                className="text-accent-400/35 drop-shadow-[0_6px_14px_rgba(208,140,44,0.25)]"
              />
            </div>
          )
        })}

        {/* Блестки */}
        {[...Array(15)].map((_, i) => (
          <div
            key={`sparkle-${i}`}
            className={`absolute ${noMotion ? '' : 'animate-pulse'}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            <Sparkles size={8 + Math.random() * 6} className="text-accent-200/55" />
          </div>
        ))}
      </div>

      {/* Canvas для анимированных листьев */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-40" style={{ mixBlendMode: 'multiply' }} />

      {/* Органические формы с анимацией */}
      <div
        className="absolute top-16 right-10 w-96 h-96 bg-primary-200/26 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '4.5s' }}
      />
      <div
        className="absolute bottom-16 left-12 w-80 h-80 bg-primary-100/24 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: '1.5s', animationDuration: '6s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] bg-accent-200/18 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '7s' }}
      />

      {/* Дополнительные декоративные элементы */}
      <div
        className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary-100/18 rounded-full blur-2xl animate-pulse"
        style={{ animationDelay: '2.3s', animationDuration: '7.5s' }}
      />
      <div
        className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-accent-100/20 rounded-full blur-2xl animate-pulse"
        style={{ animationDelay: '3s', animationDuration: '8.5s' }}
      />
    </div>
  )
}
