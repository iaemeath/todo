import { ref } from 'vue'

/**
 * Mobile detection (singleton).
 *
 * Previously every component called useMobile() independently, each spinning
 * up its own resize listener. Now there is one module-level ref and one
 * listener for the whole app. The resize handler is throttled via
 * requestAnimationFrame so rapid resizes coalesce into a single update.
 */
const DEFAULT_BREAKPOINT = 768
const isMobile = ref(false)

let initialized = false
let ticking = false

const checkMobile = (breakpoint: number) => {
  isMobile.value = window.innerWidth <= breakpoint
}

/** Initialise the shared listener once (idempotent). */
const init = (breakpoint = DEFAULT_BREAKPOINT) => {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  checkMobile(breakpoint)
  window.addEventListener('resize', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      checkMobile(breakpoint)
      ticking = false
    })
  })
}

export function useMobile(breakpoint = DEFAULT_BREAKPOINT) {
  init(breakpoint)
  return { isMobile }
}
