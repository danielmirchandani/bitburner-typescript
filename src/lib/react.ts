import type ReactNamespace from 'react';
import type ReactDomNamespace from 'react-dom';

declare global {
  interface Window {
    React: typeof ReactNamespace;
    ReactDOM: typeof ReactDomNamespace;
  }
}

const React = window.React;
const ReactDOM = window.ReactDOM;

export default React;
export {ReactDOM};
