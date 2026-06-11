import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export type ReactRootHandle = {
  render: (node: ReactNode) => void;
  unmount: () => void;
};

export function mountReactRoot(
  container: Element | DocumentFragment,
  node: ReactNode,
): ReactRootHandle {
  const root: Root = createRoot(container);
  let mounted = true;

  root.render(node);

  return {
    render(nextNode) {
      if (!mounted) {
        throw new Error('Cannot render into an unmounted React root');
      }
      root.render(nextNode);
    },
    unmount() {
      if (!mounted) return;
      root.unmount();
      mounted = false;
    },
  };
}
