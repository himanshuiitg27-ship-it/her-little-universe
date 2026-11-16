import { BookOpen, CalendarDays, Flower2, Gift, HeartHandshake, Home, Moon, NotebookPen, Settings, Sparkles, Sprout, Trophy } from 'lucide-react'

export const NAV = [
  { to: '/', label: 'Home', icon: Home, primary: true },
  { to: '/study', label: 'Study', icon: BookOpen, primary: true },
  { to: '/habits', label: 'Goals & Habits', short: 'Habits', icon: Sprout, primary: true },
  { to: '/garden', label: 'Garden', icon: Flower2, primary: true },
  { to: '/sleep', label: 'Sleep', icon: Moon },
  { to: '/mood', label: 'Mood Journal', short: 'Mood', icon: NotebookPen },
  { to: '/reflection', label: 'Night Reflection', short: 'Reflect', icon: HeartHandshake },
  { to: '/surprise', label: 'Surprise Box', short: 'Surprise', icon: Gift },
  { to: '/achievements', label: 'Achievements', short: 'Badges', icon: Trophy },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/assistant', label: 'AI Companion', short: 'AI', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]
