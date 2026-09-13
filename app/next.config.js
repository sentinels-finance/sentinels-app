/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    const extras = ["pino-pretty", "lokijs", "encoding"];
    if (Array.isArray(config.externals)) {
      config.externals.push(...extras);
    } else if (config.externals) {
      config.externals = [config.externals, ...extras];
    } else {
      config.externals = extras;
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/ox\// },
      { module: /virtualMasterPool\.js/, message: /Critical dependency/ },
    ];
    return config;
  },
  async redirects() {
    return [
      { source: "/connect", destination: "/", permanent: false },
      { source: "/market", destination: "/", permanent: false },
      { source: "/app/market", destination: "/", permanent: false },
      { source: "/app/liquidity", destination: "/", permanent: false },
    ];
  },
  webpack: (config) => {
    // @pythnetwork/solana-utils (a dependency of @pythnetwork/pyth-solana-receiver, used only
    // for pyth-updater.ts's price-posting) eagerly imports its `jito.mjs` submodule from its
    // own index, which pulls in `jito-ts` — a Jito MEV-bundle helper we never call (we only
    // use the plain price-update-posting path, not Jito bundles). jito-ts bundles its own old
    // `@solana/web3.js`, which in turn expects `rpc-websockets` export subpaths that don't
    // exist in the version actually installed — an upstream version-skew bug, not something
    // fixable from our side. Since the jito code path is genuinely dead for us, null it out at
    // bundle time rather than dragging in a second, incompatible web3.js just to satisfy an
    // import we never execute.
    config.resolve.alias["jito-ts"] = false;
    return config;
  },
};

module.exports = nextConfig;
