/// <reference types="vite/client" />

// react-dom 不自带类型声明，而 @types/react-dom 的版本必须和 @types/react（本项目是 19.x）
// 严格对齐，装错版本反而会让整棵 React 类型树报错。main.tsx 只用到 createRoot 一个 API，
// 这里给出最小声明，让 `tsc --noEmit` 能覆盖到入口文件而不必动 node_modules。
declare module "react-dom/client" {
  import type { ReactNode } from "react";

  export type Root = {
    render(children: ReactNode): void;
    unmount(): void;
  };

  export function createRoot(container: Element | DocumentFragment): Root;
  export function hydrateRoot(container: Element | Document, children: ReactNode): Root;
}
