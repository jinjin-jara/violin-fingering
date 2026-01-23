import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OMR API를 사용하기 위해 서버 모드 필요
  // output: "export"는 API Routes와 호환되지 않으므로 제거
  // 프로덕션 배포 시 서버 환경 필요 (Vercel, AWS, 등)
  images: {
    unoptimized: true,
  },
  // PWA 설정은 별도로 처리
  webpack: (config, { isServer }) => {
    // PDF.js 워커 설정
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
