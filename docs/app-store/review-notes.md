# App Review information

App Store Connect › the version › App Review Information. Apple reads English; the Turkish text is for
the owner. The demo account's values are placeholders: never put the real ones in this repository.
They live in the server's `secrets.env` (`REVIEW_EMAIL`, `REVIEW_CODE`) and are typed into App Store
Connect by the owner.

- **Sign-in required:** yes
- **User name:** `[REVIEW_EMAIL]`
- **Password:** `[REVIEW_CODE]` (the six-digit code; there are no passwords)
- **Contact:** the owner's name, phone and e-mail (App Store Connect asks; not stored here)

## Türkçe (sahibi için)

Matchnight, futbol oyunu oynayan arkadaş gruplarının maç gecelerini kaydettiği bir uygulama: skorlar,
Elo puanları, puan durumu ve her gecenin özeti.

Giriş: Şifre yok. "Giriş yap"a dokun, [REVIEW_EMAIL] yaz, "Kodu gönder"e dokun ve kod alanına
[REVIEW_CODE] yaz. Bu demo hesaba e-posta gitmez; kod her seferinde aynıdır.

Ligler özel ve sadece davetle girilir; bu yüzden demo hesap, örnek maçlarla dolu "Friday Night League"in
sahibidir. Bakılacaklar: Ana sayfa (son maç gecesi ve Gece Postası), Tablo, Maçlar, bir oyuncunun profili,
"+" ile yeni maç (takımları ve kulüpleri kur, maçı başlat, sonucu kaydet).

Hesap silme: Profilim › kalem (Profili düzenle) › Hesabı sil. Silmeden önce her lige ne olacağı gösterilir. Demo hesabı
silerseniz bize yazın, yeniden kurarız.

Yapay zekâ: Bir maça fotoğraf eklerken (maç kartındaki fotoğraf düğmesi) uygulama önce, maç özeti
ekranının fotoğrafını istatistikleri okuması için bir yapay zekâ servisine (Anthropic'in Claude'u)
gönderip göndermeyeceğini sorar. Hayır denirse fotoğraf sadece saklanır.

Bağımsızlık: Uygulama herhangi bir oyun yayıncısı (EA SPORTS dahil) ya da futbol kulübüyle bağlantılı
değildir ve onlardan içerik barındırmaz: arma yok, oyun verisi ya da kart puanı yok. Kulüpler kendi
renklerinde genel formalarla çizilir; kulüp adları sadece maçın hangi kulüple oynandığını belirtir. Bu
not Ayarlar'ın ve giriş sayfalarının altında da yazar.

## English (paste into App Store Connect)

    Matchnight lets a group of friends who play football video games keep their match nights: scores, Elo ratings, a league table and a recap of every night.

    SIGNING IN: There are no passwords. Tap "Sign in", enter [REVIEW_EMAIL], tap "Send me a code" and type [REVIEW_CODE] in the code field. No e-mail is sent to this demo account; its code is always the same.

    Leagues are private and invite-only, so the demo account owns "Friday Night League", a league with sample matches. Worth a look: Home (the last match night, with its Night Post), Table, Matches, a player's profile, and "+" to log a match (draw teams and clubs, start the match, save the result).

    ACCOUNT DELETION: My profile › the pencil (Edit profile) › Delete account. Before anything is deleted it shows what happens to each of the account's leagues. If you delete the demo account, write to us and we'll set it up again.

    AI: When adding photos to a match (the photo button on a match card), the app first asks whether a photo of the match summary screen may be sent to an AI service, Anthropic's Claude, to read its stats. If not, the photo is only kept.

    INDEPENDENCE: The app is not affiliated with any game publisher (EA SPORTS included) or football club, and holds no content of theirs: no crests, no game data or card ratings. Clubs are drawn as generic shirts in their colours; club names only say which club a match was played with. The app says so at the foot of Settings and of the sign-in pages.
