# App Store

What goes into App Store Connect for the iPhone app, drafted here so it can be reviewed like code. The
app itself: [frontend/ios/README.md](../../frontend/ios/README.md).

| File | For |
|---|---|
| [listing.md](listing.md) | name, subtitle, keywords, promotional text, description, category, URLs (TR, EN); `check-lengths.py` counts the limits |
| [app-privacy.md](app-privacy.md) | App Privacy answers, export compliance, content rights |
| [age-rating.md](age-rating.md) | the age rating questionnaire |
| [review-notes.md](review-notes.md) | App Review information: the demo account (placeholders only) and what to look at |
| [screenshots/](screenshots/) | 6.9″ iPhone screenshots, 1320×2868, from the store edition with made-up data |

## Before the first submission

- [ ] App record created with the bundle id (`frontend/ios/README.md`), name checked as free
- [ ] TestFlight build uploaded and tried on a phone
- [ ] Demo account live on the server (`REVIEW_EMAIL`, `REVIEW_CODE`, `deploy/review-league.py`) and signed into once
- [ ] `SUPPORT_EMAIL` set, so `/support` shows a contact
- [ ] Listing, privacy answers, age rating and review notes pasted in; the demo values typed in by hand
- [ ] Screenshots uploaded (6.9″; App Store Connect scales them for smaller iPhones)
