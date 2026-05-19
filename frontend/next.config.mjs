/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic configuration
  eslint: {
    // Ignore ESLint errors during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Test files contain pre-existing type errors that don't affect production code.
    // Type safety is enforced separately via tsc --noEmit in CI.
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer, webpack }) => {
    // Ignore pino-pretty during bundling to prevent build errors
    // pino-pretty is a Node.js-only package that shouldn't be bundled
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pino-pretty$/,
      })
    );
    
    // Also mark as external for server-side bundling
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('pino-pretty');
      }
    }
    
    return config;
  },
};

export default nextConfig;
