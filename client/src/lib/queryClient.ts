import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          // Check content type to handle HTML errors
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error('Received HTML response instead of JSON');
          }

          if (res.status >= 500) {
            throw new Error(`Server Error: ${res.status}`);
          }

          const errorText = await res.text();
          throw new Error(`${res.status}: ${errorText}`);
        }

        return res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});