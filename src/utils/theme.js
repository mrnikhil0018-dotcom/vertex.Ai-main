export const COLORS = {
  bg: '#050507',
  card: '#0d0f16',
  card2: '#11131c',
  panel: 'rgba(8,9,16,0.98)',
  text: '#f0f2ff',
  soft: '#8a93b8',
  cyan: '#5be7ff',
  purple: '#8b5bff',
  gold: '#ffd36e',
  green: '#4ade80',
  red: '#f87171',
  indigo: '#6366f1',
  blue: '#0ea5e9',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.17)',
  input: 'rgba(0,0,0,0.50)',
};

export const GRADIENTS = {
  brand: [COLORS.cyan, COLORS.purple, COLORS.gold],
  gold: ['#ffe4a8', '#f9d17a', '#9a69ff'],
  userBubble: ['#7c3aed', COLORS.indigo, COLORS.blue],
  logo: ['#fff3ce', COLORS.gold, COLORS.purple],
  cyanPurple: [COLORS.cyan, COLORS.purple],
  darkCard: ['rgba(18,18,24,0.97)', 'rgba(8,8,10,0.98)'],
};

export const FONT = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extraBold: 'PlusJakartaSans-ExtraBold',
};

export const radius = {
  sm: 8,
  md: 11,
  lg: 17,
  xl: 22,
  pill: 999,
};

export const shadow = {
  glowPurple: {
    shadowColor: COLORS.purple,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: {width: 0, height: 0},
    elevation: 10,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 10},
    elevation: 8,
  },
};
