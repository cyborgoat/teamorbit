export const DEFAULT_AVATAR_PATH = '/avatars/content-capybara.png';

// Curated product assets, shared by the API and every client; no demo data.
export const avatarPresets = [
  {
    id: 'grumpy-raven',
    name: 'Grumpy Raven',
    path: '/avatars/default-raven.png',
    isDefault: false,
  },
  {
    id: 'frazzled-owl',
    name: 'Frazzled Owl',
    path: '/avatars/frazzled-owl.png',
    isDefault: false,
  },
  {
    id: 'smug-raccoon',
    name: 'Smug Raccoon',
    path: '/avatars/smug-raccoon.png',
    isDefault: false,
  },
  {
    id: 'scheming-fox',
    name: 'Scheming Fox',
    path: '/avatars/scheming-fox.png',
    isDefault: false,
  },
  {
    id: 'offended-toad',
    name: 'Offended Toad',
    path: '/avatars/offended-toad.png',
    isDefault: false,
  },
  {
    id: 'tiny-dragon',
    name: 'Tiny Dragon',
    path: '/avatars/tiny-dragon.png',
    isDefault: false,
  },
  {
    id: 'frazzled-goblin',
    name: 'Frazzled Goblin',
    path: '/avatars/frazzled-goblin.png',
    isDefault: false,
  },
  {
    id: 'sleepy-yeti',
    name: 'Sleepy Yeti',
    path: '/avatars/sleepy-yeti.png',
    isDefault: false,
  },
  {
    id: 'happy-red-panda',
    name: 'Happy Red Panda',
    path: '/avatars/happy-red-panda.png',
    isDefault: false,
  },
  {
    id: 'playful-otter',
    name: 'Playful Otter',
    path: '/avatars/playful-otter.png',
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
    path: DEFAULT_AVATAR_PATH,
    isDefault: true,
  },
] as const;
