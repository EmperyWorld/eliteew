# P1a — Any device, including immersive displays

**Call / GAF detail:** P7a / P7b (here: any-device + immersive displays only)  
**Mobile subset:** P7e · **Desktop client:** P8

## Thesis

EliteEW opens wherever there is a modern **browser** contour — PC, laptop,
tablet in the browser, Android satellite, and also an **immersive headset**
(VR / XR) through the headset browser.

The product does **not** ship a separate “VR app from the headset store.”
Headset use is the **same web layer**: desk, apps, and internal video calls
(including from GAF Chat) when the headset browser, mic, and camera are usable.

**Checked:** the headset scenario was checked; **the headset model
is not named in public text**.

## Device map

| Contour | What you get | Not this |
|---------|--------------|----------|
| Browser (PC / laptop / tablet) | Full work layer in the browser | Host-OS replacement |
| Android satellite | Feed / chat / push subset ([P7e](07e-mobile-capability-matrix.md)) | Full desk as on desktop |
| Immersive headset browser | Web layer + internal calls when hardware allows | Native VR-OS · store app · “any headset without browser/mic/camera” |
| Tauri desktop client | Connected client contour ([P8](08-tauri-clients-ota.md)) | A second product tree |

## Honest framing

| | |
|--|--|
| **Present** | Browser access · Android satellite · calls = web/WebRTC contour · headset checked without model name |
| **Checked** | Headset browser path for product web UI and internal calls |
| **Not promised** | Native VR-OS · headset store listing · “every headset works offline without a browser” · phone = full EliteEW |

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
