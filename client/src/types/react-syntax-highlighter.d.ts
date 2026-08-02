declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import { PrismLight } from "react-syntax-highlighter";
  export default PrismLight;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/tsx" {
  const language: unknown;
  export default language;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism/one-light" {
  import type { CSSProperties } from "react";
  const style: { [key: string]: CSSProperties };
  export default style;
}
