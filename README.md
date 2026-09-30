# ToneX One Studio

A desktop and mobile web editor for the original IK Multimedia ToneX One. Independent community project; not affiliated with IK Multimedia.

## Implemented

- Compact editor with a fixed four-column effect grid, double-click/double-tap effect toggles, and saved light/dark theme. Slot buttons switch the pedal and display its assigned preset. A load badge loads a browsed preset into the active slot and selects the Amp editor; all effect cards except EQ support double-tap toggling; firmware sits beneath connection status and the last refresh time above the library.
- Mac/desktop Chrome Web Serial transport over USB, with 115200/8N1, DTR/RTS, authorized-port reconnection and stream cleanup.
- Android WebUSB CDC-ACM transport (VID `1963`, PID `00d1`), 115200/8N1, DTR/RTS setup.
- Wake/full-state handshake (also connects when an already-awake pedal skips its wake acknowledgement), continuous HDLC receive loop, CRC-16/X-25, bounded frame sizes, timeout handling and a command queue.
- Sequential reading of all 20 preset names and FX-era parameter summaries without loading those presets.
- Preset assignment/loading into A/B (Dual) or C (Stomp), slot switching, and global bypass. State is refreshed before mutation and read back to confirm it.
- Live amp, EQ, gate, compressor, cabinet, modulation, delay and reverb controls, including per-model parameters and pre/post placement. Controls require a complete supported 109-value parameter block.
- Parameter updates coalesced at 80 ms, followed by preset readback; physical parameter and state notifications are observed.
- Mobile preset/editor navigation, search, numeric inputs, explicit demo mode, settings JSON export and diagnostic JSON export.
- PWA manifest and offline app-shell cache; no backend or build dependencies.

## Run locally

Node.js 20 or newer:

```sh
npm run dev
```

Open http://localhost:5173. Choose **Explore demo** to test the interface without a pedal. To run checks:

```sh
npm run check
npm test
```

The Codex-provided Node executable can also run `server.js` and `--test tests/*.test.js` directly if Node is absent from your PATH.

## Use on Mac Chrome over USB

1. Connect the powered ToneX One to your Mac with a USB **data** cable.
2. Close TONEX Editor/Librarian and any other app using the pedal's serial port.
3. Open **http://localhost:5173** in **Google Chrome** (or use an HTTPS-hosted copy). Plain localhost works for Web Serial; a LAN IP over HTTP does not.
4. Click **Connect pedal** and choose the ToneX One USB serial port in Chrome's picker. Accept macOS accessory access if prompted.
5. The app reads all 20 preset summaries. Use the same preset, slot and effect controls as on Android.
6. Disconnect from the app before opening the official editor. Use **Reconnect authorized pedal** after reconnecting the cable.

Desktop selects Web Serial automatically. This uses macOS's USB serial driver rather than trying to claim its CDC interfaces with WebUSB. Android continues to select WebUSB, including Android versions that expose Web Serial for Bluetooth only. Safari is not supported by this connection path. If no port appears, check power/data cable and macOS accessory access; if opening fails, close other editors. Export diagnostics if the handshake fails.

## Test on an Android phone

1. Serve this directory on an **HTTPS** static host, preserving the `/src` and `/public` directories. There is no build step. Do not upload the temporary reference repositories from `/tmp`.
2. Alternatively run the local server with a trusted certificate for a hostname reachable from the phone:

   ```sh
   TLS_CERT=/path/to/certificate.pem TLS_KEY=/path/to/key.pem npm run dev
   ```

   Plain `http://<computer-LAN-IP>:5173` is useful for demo preview but does **not** enable WebUSB. Desktop localhost is a secure-context exception; your phone's LAN URL is not.
3. Power the ToneX One and connect the phone with an OTG-capable **data** cable. Use a powered OTG hub if needed for the phone/pedal power arrangement.
4. Open the HTTPS URL in Chrome on Android, tap **Connect pedal**, select ToneX One, and accept Android's USB permission prompt.
5. The app handshakes, reads device state and then reads the 20 stored preset summaries. Select a preset and tap **Load preset**, or edit the currently active preset.
6. If it fails, expand **Connection diagnostics** and download the USB log. It includes device descriptors and received/transmitted messages.

The website cannot open itself automatically when a cable is inserted. Initial access requires a click and permission. **Reconnect authorized pedal** can reopen an already authorized attached device without choosing it again.

## Publish with GitHub Pages

Use a separate repository for this app, not the parent MIXIE repository. The app works at a repository URL such as `https://YOUR-USERNAME.github.io/tonex-one-app/` and at a domain root.

1. Upload this project to an empty public repository with a `main` branch. Keep `.github/workflows/pages.yml` included.
2. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Run **Actions → Publish ToneX One Studio → Run workflow**, or push a commit to `main`.
4. Once deployment succeeds, open the URL shown in the `github-pages` environment. Enable **Enforce HTTPS** in Pages settings if it is not already enforced.
5. Connect the pedal in desktop Chrome or Android Chrome. The new website origin asks for its own device permission, even if localhost was already authorized.

The workflow checks the code, runs the tests, and publishes only `dist/`. `npm run build` creates that folder from the app assets and third-party licenses. The local server, tests, README and diagnostics are excluded from the hosted website. No server process or credentials are required in the website. GitHub Pages HTTPS hosts the interface; USB data stays local to the browser and pedal.

## Verification status and limitations

Automated protocol checks use a real state fixture and command/notification vectors published by TUSB, plus streaming, corruption and malformed-layout checks. Browser interactions have been checked in demo mode. A read-only native serial check on the connected Mac pedal successfully decoded its state and all 20 preset summaries, each containing 109 parameter values. It also confirmed that repeated wake requests and the legacy short hello may receive no reply. A regression test covers the captured state and silent-wake reconnect. Mac Chrome and Android Chrome USB connections have been confirmed by the user. New UI interactions are checked in demo mode; live effect toggles still need a hardware check. Serial transport tests use simulated streams; the native check does not substitute for a Chrome permission/stream test. A working native Android implementation establishes a protocol reference, not a guarantee of browser USB access.

- The app supports the observed FX-era state layout. It refuses unknown headers/extensions rather than guessing state write offsets. Firmware variants may need additional parsers.
- Live edits do not implement a permanent save command. Do not assume edits survive a preset switch or power cycle.
- Settings export contains names and parameter values only, not complete tone-model/IR binaries; restore/import is not implemented.
- When writing state, direct monitoring is enabled to preserve audible output while USB editing, matching TUSB's behavior. All other unrelated state bytes are preserved.
- Preset requests are serialized; do not operate the physical footswitch during a library scan. Response association across asynchronous unsolicited preset details still requires hardware validation.
- Browser sleep/background behavior depends on the device and operating system. Reconnect/refresh after resuming if needed.
- A USB `claimInterface` error means Chrome could not obtain the interface. Another app or an OS driver may own it. Desktop Mac Chrome uses Web Serial to access the OS-owned CDC port. Close other editors before connecting. On Android, test WebUSB on the target phone. If Android cannot claim the interface, an Android native USB bridge is the fallback; it is not implemented here.
- Offline loading works after the app has been successfully opened and cached online. Web fonts are optional and fall back to system fonts.

## Protocol sources and licensing

- [acf1210/TUSB](https://github.com/acf1210/TUSB), MIT: protocol framing, messages, captured state/command fixtures and Android setup reference. Source copyright (c) 2026 acf1210.
- [Builty/TonexOneController](https://github.com/Builty/TonexOneController), Apache-2.0: preset-summary request verification, parameter ranges and model-specific layout. Parameter table copyright (C) 2025 Greg Smith.
- [vit3k protocol notes](https://github.com/vit3k/tonex_controller/blob/main/protocol.md): background reference; some examples describe older firmware.

Adapted code and table retain attribution in source. See `THIRD_PARTY_LICENSES.txt` and `licenses/Apache-2.0.txt`.
