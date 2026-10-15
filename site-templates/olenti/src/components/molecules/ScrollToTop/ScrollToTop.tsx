import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

interface ScrollToTopProps {
  threshold?: number
  smooth?: boolean
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  threshold = 400,
  smooth = true,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const ticking = useRef(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Throttle с requestAnimationFrame для оптимизации
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          setIsVisible(window.scrollY > threshold)
          ticking.current = false
        })
        ticking.current = true
      }
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true })
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [threshold])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 z-40 p-3 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:scale-110 transition-all duration-300"
          aria-label="Прокрутить наверх"
        >
          <ArrowUp size={24} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
