# App Privacy, export compliance and content rights

Answers for App Store Connect › the app › App Privacy, and the two questions asked at submission. They
must match what the app does and what `/privacy` says; check both again when either changes.

## Türkçe

### Veri toplanıyor mu?

Evet. Hiçbiri **takip** (tracking) için kullanılmıyor, hiçbiri reklama ya da başka şirketlerin verileriyle
birleştirilmeye gitmiyor. Hepsi kullanıcının hesabına **bağlı** (linked) ve tek amaç **Uygulama
İşlevselliği** (App Functionality).

| Apple'ın kategorisi | Ne | Neden |
|---|---|---|
| Contact Info › Email Address | giriş e-postası | giriş kodu göndermek |
| Contact Info › Name | hesabın adı | ligde görünmesi |
| User Content › Photos or Videos | profil fotoğrafı, maç fotoğrafları | profil; maçla birlikte saklanması, izin verilirse istatistiklerin okunması |
| User Content › Other User Content | maçlar, skorlar, kulüpler, oyuncu adları, istatistikler | ligin kendisi |
| Identifiers › User ID | hesap numarası | hesabı ve liglerdeki üyeliği tanımak |

Toplanmayanlar: konum, kişiler, sağlık, finans, tarama ve arama geçmişi, kullanım verisi (analitik yok),
tanılama (çökme raporlayıcısı yok), satın almalar, hassas bilgiler.

Karar sende: sunucu, sorunları bulmak için isteklerin IP adresini ve zamanını bir süre tutuyor (gizlilik
sayfasında yazıyor). Apple'ın IP için ayrı bir kategorisi yok; bu kayıtlar ne analize ne kişiyle
eşleştirmeye gidiyor. Önerim bunları beyan etmemek; temkinli olmak istersen "Diagnostics › Other
Diagnostic Data", bağlı değil, Uygulama İşlevselliği.

### Veriyi işleyen servisler (Apple sormuyor, gizlilik sayfasıyla tutarlı olsun)

- **Resend**: giriş ve e-posta değişikliği mailleri; e-posta adresini ve kodu görür.
- **Anthropic (Claude)**: sadece kişi izin verirse, maç özeti fotoğrafından istatistikleri okumak için.
- **Cloudflare R2**: şifreli gece yedekleri; off-server yedek açıldığında (deploy/README.md).

### Şifreleme (export compliance)

`ITSAppUsesNonExemptEncryption = false` Info.plist'te var: uygulama sadece standart HTTPS kullanıyor,
her yüklemede soru sorulmaz.

### İçerik hakları (Content Rights)

"Uygulama üçüncü taraf içeriği içeriyor, gösteriyor ya da erişiyor mu?" Önerim **Hayır**: mağaza
sürümünde hiçbir arma, oyun verisi ya da kart puanı yok; kulüpler kendi renklerinde genel formalarla
çiziliyor. Kulüp adları sadece hangi kulüple oynandığını söyleyen düz metin. Emin olmak istersen
"Evet, haklarım var" demek yerine Hayır deyip inceleme notunda açıklamak daha doğru (review-notes.md).

## English

### Is data collected?

Yes. None of it is used for **tracking**, none goes to ads or is combined with other companies' data.
All of it is **linked** to the user's account and used only for **App Functionality**.

| Apple's category | What | Why |
|---|---|---|
| Contact Info › Email Address | the sign-in e-mail | to send sign-in codes |
| Contact Info › Name | the account's name | shown in the league |
| User Content › Photos or Videos | profile photo, match photos | the profile; kept with the match, stats read with consent |
| User Content › Other User Content | matches, scores, clubs, player names, stats | the league itself |
| Identifiers › User ID | the account's id | to know the account and its memberships |

Not collected: location, contacts, health, financial info, browsing or search history, usage data (no
analytics), diagnostics (no crash reporter), purchases, sensitive info.

The owner's call: the server keeps the IP address and time of requests for a while, to find and fix
problems (the privacy page says so). Apple has no category for IP addresses, and these logs go to no
analysis or profile. I'd leave them out; to be cautious, declare "Diagnostics › Other Diagnostic Data",
not linked, App Functionality.

### Services that process data (Apple doesn't ask; keep in step with the privacy page)

- **Resend**: sign-in and e-mail-change e-mails; sees the address and the code.
- **Anthropic (Claude)**: only with the person's consent, to read the stats from a match summary photo.
- **Cloudflare R2**: encrypted nightly backups, once off-server backups are on (deploy/README.md).

### Encryption (export compliance)

`ITSAppUsesNonExemptEncryption = false` is in Info.plist: the app uses standard HTTPS only, so the
question isn't asked on every upload.

### Content Rights

"Does your app contain, show, or access third-party content?" I'd answer **No**: the store edition has
no crests, no game data and no card ratings; clubs are drawn as generic shirts in their colours. Club
names are plain text saying which club was played. The review notes explain this (review-notes.md).
