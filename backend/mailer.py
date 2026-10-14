"""The few e-mails the app sends: for now, sign-in links.

With SMTP_HOST set they go out over SMTP (STARTTLS on port 587, the default; SMTP_USER and SMTP_PASSWORD
if the server wants them; MAIL_FROM as the sender). Without it nothing is sent, and MAIL_LOG_LINKS=1 writes
the link to the log instead, which is only for a developer's machine: a link in the log signs anyone in.
"""

import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("fifa.mail")

LOGIN_MAIL = {
    "en": {
        "subject": "Your Matchnight sign-in link",
        "body": "Tap the link to sign in to Matchnight:\n\n{link}\n\n"
        "It works once, for {minutes} minutes. If you didn't ask for it, ignore this e-mail.\n",
    },
    "tr": {
        "subject": "Matchnight giriş linkin",
        "body": "Matchnight'a girmek için linke dokun:\n\n{link}\n\n"
        "Link bir kez ve {minutes} dakika geçerli. Sen istemediysen bu e-postayı yok say.\n",
    },
}


def can_send() -> bool:
    return bool(os.getenv("SMTP_HOST")) or os.getenv("MAIL_LOG_LINKS") == "1"


def send_login_link(to: str, link: str, lang: str, minutes: int) -> None:
    text = LOGIN_MAIL.get(lang, LOGIN_MAIL["en"])
    host = os.getenv("SMTP_HOST")
    if not host:
        if os.getenv("MAIL_LOG_LINKS") == "1":
            log.warning("MAIL_LOG_LINKS: sign-in link for %s: %s", to, link)
        return
    message = EmailMessage()
    message["From"] = os.getenv("MAIL_FROM", "Matchnight <no-reply@localhost>")
    message["To"] = to
    message["Subject"] = text["subject"]
    message.set_content(text["body"].format(link=link, minutes=minutes))
    port = int(os.getenv("SMTP_PORT", "587"))
    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if port != 25:
                smtp.starttls()
            if os.getenv("SMTP_USER"):
                smtp.login(os.environ["SMTP_USER"], os.getenv("SMTP_PASSWORD", ""))
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        log.error("could not send the sign-in link to %s: %s", to, exc)
