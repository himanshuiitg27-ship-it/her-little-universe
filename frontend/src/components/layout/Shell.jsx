import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Grid2x2, Moon, Sun, X } from 'lucide-react'
import { NAV } from './nav'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { useReminderNotifier } from '../../hooks/useReminderNotifier'
import RewardsCelebrations from '../../context/RewardsContext'
import Mascot from '../ui/Mascot'

function ThemeButton({ className = '' }) {
  const { settings, update } = useSettings()
  const toast = useToast()
  const dark = settings?.theme === 'dark'
  return (
    <button
      className={`grid h-10 w-10 place-items-center rounded-2xl bg-soft text-ink-2 transition hover:bg-lavender-100 hover:text-lavender-600 ${className}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => update({ theme: dark ? 'light' : 'dark' }).catch((e) => toast.error(e.message))}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line/70 bg-surface/80 p-5 backdrop-blur md:flex">
      <div className="mb-6 flex items-center gap-3">
        <Mascot size={44} float={false} />
        <div>
          <p className="font-display text-lg font-semibold leading-tight">Her Little</p>
          <p className="font-script text-2xl leading-none text-blush-500">Universe</p>
        </div>
      </div>
      <nav className="scroll-soft -mr-2 flex-1 space-y-1 overflow-y-auto pr-2" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative block">
            {({ isActive }) => (
              <span className={`relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition ${isActive ? 'text-blush-600' : 'text-ink-2 hover:bg-soft'}`}>
                {isActive && <motion.span layoutId="side-active" className="absolute inset-0 rounded-2xl bg-blush-100" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
                <Icon size={19} className="relative" />
                <span className="relative">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-soft p-3">
        <p className="font-script text-xl text-ink-2">be gentle with yourself</p>
        <ThemeButton />
      </div>
    </aside>
  )
}

function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])
  const primary = NAV.filter((n) => n.primary)
  const secondary = NAV.filter((n) => !n.primary)
  const secondaryActive = secondary.some((n) => n.to === location.pathname)

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <motion.div className="fixed inset-0 z-40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="absolute inset-x-3 bottom-24 rounded-4xl border border-line bg-surface p-4 shadow-lift"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="font-display text-lg font-semibold">More</p>
                <div className="flex items-center gap-2">
                  <ThemeButton />
                  <button className="grid h-10 w-10 place-items-center rounded-2xl bg-soft" aria-label="Close menu" onClick={() => setMoreOpen(false)}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {secondary.map(({ to, label, short, icon: Icon }) => (
                  <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-[11px] font-bold ${isActive ? 'bg-blush-100 text-blush-600' : 'bg-soft text-ink-2'}`}>
                    <Icon size={22} />
                    {short || label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-surface/90 px-2 pt-2 backdrop-blur md:hidden" aria-label="Main">
        <ul className="mx-auto flex max-w-md items-stretch justify-between">
          {primary.map(({ to, label, short, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={to === '/'} className="relative flex flex-col items-center gap-0.5 py-1.5">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="bottom-active" className="absolute inset-x-3 inset-y-0 rounded-2xl bg-blush-100" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
                    <Icon size={22} className={`relative ${isActive ? 'text-blush-600' : 'text-ink-3'}`} />
                    <span className={`relative text-[11px] font-bold ${isActive ? 'text-blush-600' : 'text-ink-3'}`}>{short || label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="relative flex w-full flex-col items-center gap-0.5 py-1.5">
              {(moreOpen || secondaryActive) && <span className="absolute inset-x-3 inset-y-0 rounded-2xl bg-lavender-100" />}
              <Grid2x2 size={22} className={`relative ${moreOpen || secondaryActive ? 'text-lavender-600' : 'text-ink-3'}`} />
              <span className={`relative text-[11px] font-bold ${moreOpen || secondaryActive ? 'text-lavender-600' : 'text-ink-3'}`}>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}

export default function Shell() {
  const location = useLocation()
  useReminderNotifier()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <div className="min-h-screen">
      <Sidebar />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/60 bg-bg/80 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Mascot size={30} float={false} />
          <p className="font-display font-semibold">
            Her Little <span className="font-script text-xl text-blush-500">Universe</span>
          </p>
        </div>
        <ThemeButton className="!h-9 !w-9" />
      </header>
      <main className="px-4 pb-28 pt-5 md:ml-64 md:px-8 md:pb-12 md:pt-8">
        <div className="mx-auto max-w-6xl">
          {/* Enter-only fade: no exit animation to wait for, so a route change can never get stuck on the old page. */}
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </div>
      </main>
      <MobileNav />
      <RewardsCelebrations />
    </div>
  )
}
