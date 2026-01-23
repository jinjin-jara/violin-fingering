"use client";

import React from "react";

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({
  message = "악보를 분석하는 중...",
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-gray-600 font-medium">{message}</p>
      <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
    </div>
  );
}
