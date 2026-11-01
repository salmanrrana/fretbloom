import 'react'

declare module 'react' {
  interface CSSProperties {
    /** CSS custom properties, e.g. `style={{ '--start': 3 }}`. */
    [key: `--${string}`]: string | number | undefined
  }
}
