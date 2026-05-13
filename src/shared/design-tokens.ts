export const colorTokens = {
  primary: {
    50: '#eef6ff',
    100: '#d9ebff',
    200: '#acd5ff',
    300: '#78b8ff',
    400: '#3f91ff',
    500: '#0a6dff',
    600: '#0064ff',
    700: '#0050cc',
    800: '#003f9e',
    900: '#0a2f73'
  },
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f4f8',
    200: '#e6ebf2',
    300: '#d3dbe6',
    400: '#aeb9c8',
    500: '#7d8898',
    600: '#596475',
    700: '#394252',
    800: '#202938',
    900: '#101725'
  },
  semantic: {
    success: {
      background: '#eafaf1',
      text: '#0a7a45',
      border: '#8ee0b4'
    },
    warning: {
      background: '#fff6df',
      text: '#9a6400',
      border: '#ffd36b'
    },
    error: {
      background: '#fff0f0',
      text: '#d33131',
      border: '#ffaaa5'
    },
    info: {
      background: '#eef6ff',
      text: '#0050cc',
      border: '#acd5ff'
    }
  }
} as const;

export const typeTokens = {
  fontFamily: {
    display: "'Pretendard Variable', 'SUIT', 'Avenir Next', sans-serif",
    body: "'Pretendard Variable', 'SUIT', 'Avenir Next', sans-serif"
  },
  scale: {
    display: {
      fontSize: '3rem',
      lineHeight: '3.375rem',
      letterSpacing: '-0.052em',
      fontWeight: 800
    },
    title: {
      fontSize: '1.75rem',
      lineHeight: '2.125rem',
      letterSpacing: '-0.045em',
      fontWeight: 800
    },
    heading: {
      fontSize: '1.375rem',
      lineHeight: '1.875rem',
      letterSpacing: '-0.035em',
      fontWeight: 760
    },
    body: {
      fontSize: '1rem',
      lineHeight: '1.625rem',
      letterSpacing: '-0.01em',
      fontWeight: 500
    },
    bodyStrong: {
      fontSize: '1rem',
      lineHeight: '1.5rem',
      letterSpacing: '-0.015em',
      fontWeight: 700
    },
    caption: {
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
      letterSpacing: '-0.005em',
      fontWeight: 600
    },
    micro: {
      fontSize: '0.75rem',
      lineHeight: '1rem',
      letterSpacing: '0.08em',
      fontWeight: 800
    }
  }
} as const;

export const spacingTokens = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem'
} as const;

export const radiusTokens = {
  none: '0',
  xs: '0.375rem',
  sm: '0.625rem',
  md: '0.875rem',
  lg: '1.25rem',
  xl: '1.75rem',
  pill: '999rem'
} as const;

export const shadowTokens = {
  none: 'none',
  card: '0 0.75rem 2rem rgb(16 23 37 / 0.08)',
  raised: '0 1.25rem 3rem rgb(16 23 37 / 0.12)',
  focus: '0 0 0 0.25rem rgb(0 100 255 / 0.16)'
} as const;

export const routeIa = {
  tenant: {
    path: '/',
    label: 'Tenant mobile app',
    entry: 'tenant',
    buildHtml: 'dist/index.html'
  },
  verify: {
    pathPattern: '/verify/:id',
    basePath: '/verify/',
    label: 'Landlord verify app',
    entry: 'verify',
    buildHtml: 'dist/verify/index.html'
  },
  issuer: {
    path: '/issuer',
    label: 'Issuer ops console',
    entry: 'issuer',
    buildHtml: 'dist/issuer/index.html'
  }
} as const;

export const designTokens = {
  color: colorTokens,
  type: typeTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadow: shadowTokens
} as const;

export type AppRouteKey = keyof typeof routeIa;
export type DesignTokens = typeof designTokens;
