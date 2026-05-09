import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>JobToo</title>
        <meta name="description" content="Подработки на складе в Москве" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#FF6B1A" />

        {/* iOS Add to Home Screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="JobToo" />
        <link rel="apple-touch-icon" href="/jt-logo.jpg" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        <ScrollViewStyleReset />

        {/* Splash shown while JS loads — hides once React mounts */}
        <style>{`
          #splash {
            position: fixed; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #fff; z-index: 9999;
            transition: opacity 0.3s;
          }
          #splash.hidden { opacity: 0; pointer-events: none; }
          #splash-logo {
            width: 80px; height: 80px; border-radius: 20px;
            object-fit: cover;
          }
          #splash-name {
            margin-top: 14px; font-size: 24px; font-weight: 800;
            color: #FF6B1A; font-family: -apple-system, sans-serif;
          }
          #splash-dot {
            margin-top: 32px; width: 36px; height: 4px;
            border-radius: 2px; background: #FF6B1A;
            animation: pulse 1.2s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; } 50% { opacity: 1; }
          }
        `}</style>
      </head>
      <body>
        <div id="splash">
          <img id="splash-logo" src="/jt-logo.jpg" alt="JobToo" />
          <div id="splash-name">JobToo</div>
          <div id="splash-dot" />
        </div>
        {children}
        <script>{`
          (function() {
            var splash = document.getElementById('splash');
            function hideSplash() {
              if (splash) { splash.classList.add('hidden'); setTimeout(function(){ splash.remove(); }, 400); }
            }
            // Hide once React renders or after 4s max
            if (document.readyState === 'complete') {
              setTimeout(hideSplash, 300);
            } else {
              window.addEventListener('load', function() { setTimeout(hideSplash, 300); });
            }
            setTimeout(hideSplash, 4000);
          })();
        `}</script>
      </body>
    </html>
  );
}
