export const DEFAULT_AVATAR_PATH = '/avatars/baby-bird.png';

// Curated product assets, shared by the API and every client; no demo data.
export const avatarPresets = [
  {
    id: 'grumpy-raven',
    name: 'Grumpy Raven',
    path: '/avatars/default-raven.png',
    isDefault: false,
  },
  {
    id: 'innocent-raccoon',
    name: 'Innocent Raccoon',
    path: '/avatars/innocent-raccoon.png',
    isDefault: false,
  },
  {
    id: 'smart-fox',
    name: 'Smart Fox',
    path: '/avatars/smart-fox.png',
    isDefault: false,
  },
  {
    id: 'offended-toad',
    name: 'Offended Toad',
    path: '/avatars/offended-toad.png',
    isDefault: false,
  },
  {
    id: 'curious-red-panda',
    name: 'Curious Red Panda',
    path: '/avatars/curious-red-panda.png',
    isDefault: false,
  },
  {
    id: 'sunny-corgi',
    name: 'Sunny Corgi',
    path: '/avatars/sunny-corgi.png',
    isDefault: false,
  },
  {
    id: 'content-capybara',
    name: 'Content Capybara',
    path: '/avatars/content-capybara.png',
    isDefault: false,
  },
  {
    id: 'baby-bird',
    name: 'Baby Bird',
    path: DEFAULT_AVATAR_PATH,
    isDefault: true,
  },
] as const;
