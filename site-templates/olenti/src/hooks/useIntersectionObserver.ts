/**
 * Custom hook for intersection observer with performance optimization
 */

import { useState, useEffect, useRef, RefObject } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number | number[]
  rootMargin?: string
  root?: Element | null
  freezeOnceVisible?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [RefObject<HTMLElement | null>, boolean] {
  const {
    threshold = 0,
    rootMargin = '0px',
    root = null,
    freezeOnceVisible = false,
  } = options

  const [isInView, setIsInView] = useState(false)
  const [hasBeenInView, setHasBeenInView] = useState(false)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const callback = ([entry]: IntersectionObserverEntry[]) => {
      const isElementInView = entry.isIntersecting

      if (freezeOnceVisible && hasBeenInView) return

      setIsInView(isElementInView)
      
      if (isElementInView && freezeOnceVisible) {
        setHasBeenInView(true)
      }
    }

    const observer = new IntersectionObserver(callback, {
      threshold,
      rootMargin,
      root,
    })

    observer.observe(target)

    return () => {
      observer.unobserve(target)
      observer.disconnect()
    }
  }, [threshold, rootMargin, root, freezeOnceVisible, hasBeenInView])

  return [targetRef, isInView]
}
