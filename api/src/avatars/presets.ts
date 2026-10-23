export const DEFAULT_AVATAR_PATH = '/avatars/default-raven.png';

// Curated product assets, shared by the API and every client; no demo data.
export const avatarPresets = [
  {
    id: 'grumpy-raven',
    name: 'Grumpy Raven',
    path: DEFAULT_AVATAR_PATH,
    isDefault: true,
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
] as const;
