'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    embeddedservice_bootstrap?: {
      settings: { language: string };
      init: (orgId: string, deploymentName: string, siteUrl: string, options: { scrt2URL: string }) => void;
    };
    initEmbeddedMessaging?: () => void;
  }
}

/** Loads the Salesforce Enhanced Chat v2 deployment on the public restaurant site. */
export default function AgentforceChat() {
  useEffect(() => {
    const src = 'https://orgfarm-3181b9f7b4-dev-ed.develop.my.site.com/ESWMylaporeWebC1794571797516/assets/js/bootstrap.min.js';
    if (document.querySelector(`script[src="${src}"]`)) return;

    window.initEmbeddedMessaging = () => {
      try {
        const bootstrap = window.embeddedservice_bootstrap;
        if (!bootstrap) throw new Error('Salesforce Embedded Messaging did not load.');
        bootstrap.settings.language = 'en_US';
        bootstrap.init(
          '00Dfj00000mbzot',
          'Mylapore_Web_Chat',
          'https://orgfarm-3181b9f7b4-dev-ed.develop.my.site.com/ESWMylaporeWebC1794571797516',
          { scrt2URL: 'https://orgfarm-3181b9f7b4-dev-ed.develop.my.salesforce-scrt.com' },
        );
      } catch (error) {
        console.error('Error loading Embedded Messaging:', error);
      }
    };

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => window.initEmbeddedMessaging?.();
    script.onerror = () => console.error('Unable to load Salesforce Embedded Messaging bootstrap.');
    document.body.appendChild(script);
  }, []);

  return null;
}
