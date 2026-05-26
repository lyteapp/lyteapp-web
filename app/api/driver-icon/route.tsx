import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const size = Math.min(512, Math.max(16, parseInt(req.nextUrl.searchParams.get('size') ?? '192')))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(145deg, #7C3AED 0%, #4C1D95 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.22 + 'px',
        }}
      >
        {/* Motorcycle / delivery icon */}
        <svg
          viewBox="0 0 24 24"
          fill="white"
          width={size * 0.52}
          height={size * 0.52}
        >
          <path d="M5 11.5A3.5 3.5 0 1 0 8.5 15H10a1 1 0 0 0 1-1v-1.382l2-1V13a3.5 3.5 0 1 0 1-2.45V9.618l-4 2V11a1 1 0 0 0-1 1H8.5A3.5 3.5 0 0 0 5 11.5ZM5 13a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM14 6a1 1 0 0 1 1-1h2.5a1 1 0 0 1 .894.553l1.5 3A1 1 0 0 1 19 10h-4a1 1 0 0 1-1-1V6Z"/>
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
