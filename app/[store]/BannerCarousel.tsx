'use client'

import { useEffect, useRef, useState } from 'react'
import { isVideoUrl, resizedImg } from '../lib/storeImages'
import { CachedVideo } from './videoCache'

// The store banner: one photo/video, or several as a slideshow. The first
// slide sets the banner's height (same as the single-banner layout); the rest
// fade in over it. Photos stay 5 s, videos play through once (muted) before
// moving on. Swipe left/right, or tap a dot.

const PHOTO_MS = 5000

export default function BannerCarousel({ slides, alt }: { slides: string[]; alt: string }) {
  const [idx, setIdx] = useState(0)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const touchX = useRef<number | null>(null)
  const many = slides.length > 1
  const go = (i: number) => setIdx(((i % slides.length) + slides.length) % slides.length)

  // photos advance on a timer; videos when they end (see onEnded)
  useEffect(() => {
    if (!many || isVideoUrl(slides[idx])) return
    const t = setTimeout(() => go(idx + 1), PHOTO_MS)
    return () => clearTimeout(t)
  }, [idx, many, slides]) // eslint-disable-line react-hooks/exhaustive-deps

  // only the current video plays
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return
      if (i === idx) { v.currentTime = 0; v.play().catch(() => {}) } else v.pause()
    })
  }, [idx])

  return (
    <div
      className={`sf-banner sf-banner-slides${many ? ' many' : ''}`}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (!many || touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1))
      }}
    >
      {slides.map((src, i) => {
        const cls = `sf-banner-slide${i === 0 ? ' sizer' : ''}${i === idx ? ' on' : ''}`
        return isVideoUrl(src) ? (
          <CachedVideo
            key={src + i}
            ref={el => { videos.current[i] = el }}
            src={src}
            className={`sf-banner-img ${cls}`}
            muted playsInline autoPlay={i === 0} loop={!many}
            preload={i === 0 ? 'auto' : 'metadata'}
            onEnded={() => many && i === idx && go(idx + 1)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + i} src={resizedImg(src, 1600)} alt={i === 0 ? alt : ''} className={`sf-banner-img ${cls}`} loading={i === 0 ? 'eager' : 'lazy'} />
        )
      })}
      {many && (
        <div className="sf-banner-dots">
          {slides.map((_, i) => (
            <button key={i} className={i === idx ? 'on' : ''} onClick={() => go(i)} aria-label={`Banner ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}
