/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals ?? []
      config.externals = [
        ...externals,
        '@napi-rs/canvas',
        ({ request }, callback) => {
          if (request?.startsWith('@napi-rs/canvas')) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
    ]
  },
  transpilePackages: ['@excalidraw/excalidraw'],
}

module.exports = nextConfig
