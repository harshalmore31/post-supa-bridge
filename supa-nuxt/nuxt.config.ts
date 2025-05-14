// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devtools: {
    enabled: true,

    timeline: {
      enabled: true
    }
  },

  // Make environment variables available in the app
  runtimeConfig: {
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    }
  },

  // Import global CSS
  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@nuxt/ui',
    // Commented out modules that need to be installed first
    // '@vercel/analytics/nuxt',
    '@sentry/nuxt/module'
  ],

  // Add Font Awesome and Google Fonts
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
        },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ],
      script: [
        {
          defer: true,
          src: 'https://static.cloudflareinsights.com/beacon.min.js',
          'data-cf-beacon': '{"token": "e7b00b29c6cd4115ae3a71bfd012b576"}'
        }
      ]
    }
  },

  // Comment out Sentry config until the module is installed
  /*
  sentry: {
    sourceMapsUploadOptions: {
      org: 'harshalmore31',
      project: 'javascript-nuxt'
    },

    autoInjectServerSentry: 'top-level-import'
  },
  */

  sourcemap: {
    client: 'hidden'
  }
})