import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import removeConsole from 'vite-plugin-remove-console'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(), 
      tailwindcss(),
      // Remove console.log, console.warn, console.debug in production
      // Keep console.error for error tracking
      isProduction && removeConsole({
        includes: ['log', 'warn', 'debug'],
        exclude: ['error'],
      }),
    ].filter(Boolean),
    server: {
      host: '0.0.0.0', // Allow access from outside container
      port: 5173,
      watch: {
        usePolling: true, // Enable polling for file changes in Docker
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      minify: isProduction ? 'esbuild' : false,
      sourcemap: isProduction ? false : 'inline', // Disable sourcemaps in production
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['@radix-ui/react-avatar', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            'vendor-maps': ['@googlemaps/js-api-loader'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
      assetsInlineLimit: 4096, // Inline assets smaller than 4kb
      // Report compressed size
      reportCompressedSize: true,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    // Optimize dependencies in production
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  };
});
