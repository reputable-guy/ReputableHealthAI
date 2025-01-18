import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        // Ensure the URL starts with /api/
        const url = (queryKey[0] as string).startsWith('/api/') 
          ? queryKey[0] as string
          : `/api${queryKey[0]}`;

        const res = await fetch(url, {
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
            console.error('Received HTML instead of JSON. URL:', url);
            throw new Error('API endpoint returned HTML instead of JSON. Please check the URL.');
          }

          const errorText = await res.text();
          console.error('API Error:', {
            status: res.status,
            url,
            error: errorText
          });

          throw new Error(`API Error (${res.status}): ${errorText}`);
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