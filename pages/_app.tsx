import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>바이올린 운지 분석기</title>
        <meta name="description" content="악보를 업로드하여 바이올린 운지를 자동으로 계산합니다" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0ea5e9" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
