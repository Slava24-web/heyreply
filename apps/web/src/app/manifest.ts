import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'heyreply',
    short_name: 'heyreply',
    description: 'A free tracker of job applications with statistics and a browser extension.',
    start_url: '/',
    display: 'standalone',
    background_color: '#131015',
    theme_color: '#7a2e8e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
