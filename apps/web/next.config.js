/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@horizon/config',
    '@horizon/types',
    '@horizon/utils',
    '@horizon/validation',
  ],
};

module.exports = nextConfig;
