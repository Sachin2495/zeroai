/** @type {import('next').NextConfig} */
const nextConfig = {
    // Self-contained server bundle for the Lambda container image
    output: "standalone",
    poweredByHeader: false,
};

export default nextConfig;
