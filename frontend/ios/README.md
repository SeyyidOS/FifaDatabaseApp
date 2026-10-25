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
  workflow). It signs the app with the App Store Connect API key (automatic signing: Xcode makes the
  certificate and profile itself) and uploads it to TestFlight. Until all four secrets below exist it is
  skipped with a notice, without starting a Mac.

## What the owner sets up once

1. **App Store Connect › Apps › +**: a new iOS app with the bundle id above (register it under
   Certificates, Identifiers & Profiles › Identifiers first if it isn't offered) and the name.
2. **Users and Access › Integrations › App Store Connect API › Team Keys › +**, with **Admin** access:
   automatic signing in CI creates the distribution certificate, which App Manager keys may not. Download
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

- **"Code failed to satisfy specified code requirement(s)"** (ITMS-90035), and the workflow's signature
  check says the app "does not satisfy its designated Requirement". This is Apple's bug, when the team's
  name has a letter outside ASCII (here the "İ" of SEVGİLİ). The certificate keeps the letter composed,
  while the signature's requirement gets it decomposed, so they never match
  ([developer forums thread 843700](https://developer.apple.com/forums/thread/843700), FB24633162).
  - **The fix:** ask Apple Developer Programs (developer.apple.com/contact) to change the team name to
    ASCII only.
  - Once it's changed, revoke every Apple Distribution certificate that still carries the old name
    (Certificates, Identifiers & Profiles › Certificates). The next run then gets a new one.
