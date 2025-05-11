<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
      <Analytics />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt';
import * as Sentry from "@sentry/vue";
import { onMounted } from 'vue';

// Initialize Sentry with tracing
onMounted(() => {
  const nuxtApp = useNuxtApp();
  Sentry.init({
    app: nuxtApp.vueApp,
    dsn: "https://fbf544894f3299ae96ad76cc0711c108@o4508795242414080.ingest.us.sentry.io/4509305576620032",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.vueIntegration({
        tracingOptions: {
          trackComponents: true,
          hooks: ["create", "mount"],
        },
      }),
    ],
    // Set sample rate to 1.0 for development, lower it in production
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    // Configure which URLs to enable trace propagation for
    tracePropagationTargets: ["localhost", /yourserver\.io\/api/],
  });
});

// Application-wide setup code can go here
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f9f9f9;
  color: #1a1a1a;
}

#__nuxt {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
