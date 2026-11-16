import { motion } from 'framer-motion'

/** A small friendly flower with a face. `mood` changes its expression. */
export default function Mascot({ size = 96, mood = 'happy', float = true, className = '' }) {
  const mouth = {
    happy: 'M40 56 Q50 66 60 56',
    calm: 'M43 58 Q50 62 57 58',
    sleepy: 'M44 59 Q50 57 56 59',
    sad: 'M42 61 Q50 54 58 61',
  }[mood]
  const eyes =
    mood === 'sleepy' ? (
      <>
        <path d="M36 47 q4 3 8 0" stroke="#5a3d5c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M56 47 q4 3 8 0" stroke="#5a3d5c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="40" cy="47" r="3.2" fill="#5a3d5c" />
        <circle cx="60" cy="47" r="3.2" fill="#5a3d5c" />
        <circle cx="41.2" cy="45.8" r="1" fill="#fff" />
        <circle cx="61.2" cy="45.8" r="1" fill="#fff" />
      </>
    )
  return (
    <motion.svg
      viewBox="0 0 100 110"
      width={size}
      height={size * 1.1}
      className={className}
      animate={float ? { y: [0, -5, 0] } : undefined}
      transition={float ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      role="img"
      aria-label="A friendly flower"
    >
      <path d="M50 78 C50 92 48 100 46 108" stroke="#8fc59a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M48 96 C36 94 30 88 28 82 C40 82 46 88 48 96Z" fill="#a9d8b2" />
      <g fill="#ffb7d0">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="50" cy="19" rx="13" ry="17" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="24" fill="#ffe7a3" />
      {eyes}
      <ellipse cx="33" cy="55" rx="4.5" ry="3" fill="#ffb0c9" opacity=".7" />
      <ellipse cx="67" cy="55" rx="4.5" ry="3" fill="#ffb0c9" opacity=".7" />
      <path d={mouth} stroke="#5a3d5c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </motion.svg>
  )
}
