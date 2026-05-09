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

        <style>{`
          #splash {
            position: fixed; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #fff; z-index: 9999;
            transition: opacity 0.35s ease;
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
          #splash-track {
            margin-top: 36px;
            width: 160px; height: 4px;
            background: #F0E8E0;
            border-radius: 2px;
            overflow: hidden;
          }
          #splash-bar {
            height: 100%; width: 0%;
            background: #FF6B1A;
            border-radius: 2px;
            transition: width 0.25s ease-out;
          }
        `}</style>
      </head>
      <body>
        <div id="splash">
          <img id="splash-logo" src="/jt-logo.jpg" alt="JobToo" />
          <div id="splash-name">JobToo</div>
          <div id="splash-track">
            <div id="splash-bar" />
          </div>
        </div>
        {children}
        <script>{`
          (function() {
            var bar = document.getElementById('splash-bar');
            var splash = document.getElementById('splash');
            var progress = 0;
            var done = false;

            // Gradually move bar toward 80% — slows as it gets closer
            var ticker = setInterval(function() {
              if (done) return;
              var gap = 80 - progress;
              var step = Math.max(gap * 0.07, 0.4);
              progress = Math.min(progress + step, 80);
              if (bar) bar.style.width = progress + '%';
            }, 80);

            function finish() {
              if (done) return;
              done = true;
              clearInterval(ticker);
              // Snap to 100% quickly, then fade out
              if (bar) {
                bar.style.transition = 'width 0.3s ease-in';
                bar.style.width = '100%';
              }
              setTimeout(function() {
                if (splash) {
                  splash.classList.add('hidden');
                  setTimeout(function() { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 400);
                }
              }, 320);
            }

            if (document.readyState === 'complete') {
              setTimeout(finish, 200);
            } else {
              window.addEventListener('load', function() { setTimeout(finish, 200); });
            }
            // Hard cap at 5s in case load never fires
            setTimeout(finish, 5000);
          })();
        `}</script>
      </body>
    </html>
  );
}
