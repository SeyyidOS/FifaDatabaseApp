# The iPhone app

The web app (`frontend/`), built as the **store** edition (`.env.app`), inside a Capacitor shell. Nothing
is built on a Mac by hand: GitHub Actions does it ([.github/workflows/ios.yml](../../.github/workflows/ios.yml)).

    npm run build:app    # the web app for the shell: store edition, the API by its full address, no crests
    npx cap sync ios     # copies it into ios/App/App/public with the native plugins (needs Node 22)

| What | Where (the one place to change it) |
|---|---|
| Bundle id, `com.hotspotkeeper.matchnight` | `appId` in `frontend/capacitor.config.ts`. CI hands it to Xcode, so the value in `project.pbxproj` only matters when building in Xcode by hand. Changing it later also needs a new app record in App Store Connect. |
| Version shown in the App Store, `1.0.0` | `version` in `frontend/package.json` |
| Build number | the workflow run's number, so every upload is a new build |
| Name on the home screen | `appName` in `capacitor.config.ts` and `CFBundleDisplayName` in `App/App/Info.plist` |
| Icon and launch screen | `App/App/Assets.xcassets` (the icon is 1024×1024, no transparency) |

## Builds

- **simulator**: every pull request and push that touches `frontend/`. Checks that the app still builds,
  unsigned; the `.app` is kept as an artifact for a week.
- **testflight**: every push to `main` that touches `frontend/`, and by hand (Actions › iOS › Run
  workflow). It signs the app by hand through the App Store Connect API key, with a temporary
  certificate and profile ("Known problems" says why), and uploads it to TestFlight. Until all four
  secrets below exist it is skipped with a notice, without starting a Mac.

## What the owner sets up once

1. **App Store Connect › Apps › +**: a new iOS app with the bundle id above (register it under
   Certificates, Identifiers & Profiles › Identifiers first if it isn't offered) and the name.
2. **Users and Access › Integrations › App Store Connect API › Team Keys › +**, with **Admin** access:
   the lane creates and revokes a distribution certificate, which App Manager keys may not. Download
   the `.p8` (it can be downloaded once) and note the Key ID and the Issuer ID.
3. **GitHub › Settings › Secrets and variables › Actions**, four repository secrets:

   | Secret | Value |
   |---|---|
   | `ASC_KEY_ID` | the key's id |
   | `ASC_ISSUER_ID` | the issuer id shown above the keys |
   | `ASC_KEY_P8` | the whole `.p8` file, `-----BEGIN PRIVATE KEY-----` to the end |
   | `APPLE_TEAM_ID` | the team id (developer.apple.com › Account › Membership details) |

4. Run Actions › iOS › Run workflow. Once App Store Connect has processed the build (some minutes), it
   shows under TestFlight; add yourself as an internal tester to install it with the TestFlight app.

## Known problems

- **"Code failed to satisfy specified code requirement(s)"** (ITMS-90035). This is Apple's bug when the
  team's name has a letter outside ASCII (here the "İ" of SEVGİLİ). The certificate keeps the letter
  composed (U+0130), while the designated requirement Xcode writes gets it decomposed ("I" + U+0307), so
  an app signed by Xcode never satisfies its own signature
  ([developer forums thread 843700](https://developer.apple.com/forums/thread/843700), FB24633162).
  - **How the lane gets round it:** it doesn't let Xcode sign. It archives unsigned, then
    `ci/asc_signing.py` makes a temporary Apple Distribution certificate (its key made in the run) and an
    App Store profile through the App Store Connect API. `codesign` then signs the frameworks and the app
    with a designated requirement of identifier plus team id, which never names the team. The certificate
    is revoked and the profile deleted at the end; uploaded builds aren't affected, because Apple signs
    them again.
  - **If Apple renames the team to ASCII** (case 103008214933), Xcode's own signing would work again too,
    but nothing needs to change.
