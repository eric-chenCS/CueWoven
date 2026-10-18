# Recall v3.3.16: neutral gray themes

Dark mode uses the reference screenshots' charcoal **#333333** for panels and lighter **#3D3D3D** for the background. Focus borders/rings are pure white, regular borders use neutral grays, and actions, links and controls no longer use teal/blue. Red danger borders remain red, including keyboard focus.

Light mode reverses the hierarchy with pale panels over a gray background, dark text and pure-black focus rings. Explicit Light/Dark choices and the System setting remain supported. Layout, capture, storage limits and saved data are unchanged; this update adds no model, dependency or background processing.

The Chromium theme check verifies popup/settings colors, white/black focus, neutral control borders, red danger borders, system-theme switching and no horizontal overflow at 320, 768, 1024 and 1440 pixels. The existing preferences test is updated for the new intended background colors. Browser screenshots were visually reviewed in both themes.

The existing Node-toolchain dependency advisories are unchanged: three high `sharp` advisories and one moderate `sprintf-js` advisory, outside the shipped browser bundle. The audit is not clean; remediation remains scheduled for review by 2026-11-17.
