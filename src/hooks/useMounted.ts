import { useEffect, useState } from 'react';

/**
 * Hook to determine if the component has mounted on the client.
 * Used to prevent hydration mismatches when rendering dynamic content
 * like dates, random IDs, or window-dependent values.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
