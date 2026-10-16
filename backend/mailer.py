"""The few e-mails the app sends: for now, sign-in links.

With SMTP_HOST set they go out over SMTP (STARTTLS on port 587, the default, checked against the server's
certificate; SMTP_USER and SMTP_PASSWORD if the server wants them; MAIL_FROM as the sender). SMTP_RELAY
(host:port) is a way out for a server without internet of its own: the connection goes there and is passed
on to SMTP_HOST untouched, and TLS is still checked against SMTP_HOST's name. Without SMTP_HOST nothing is
sent, and MAIL_LOG_LINKS=1 writes the link to the log instead, which is only for a developer's machine: a
link in the log signs anyone in.

`python mailer.py ADDRESS` sends a test e-mail and says what went wrong, if anything.
"""

import logging
import os
import smtplib
import socket
import ssl
import sys
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


class _SMTP(smtplib.SMTP):
    """An SMTP client that connects through `relay` ("host:port") when given; smtplib still takes `host` as
    the server's name, which STARTTLS checks the certificate against."""

    def __init__(self, host: str, port: int, relay: str | None):
        self._relay = relay
        super().__init__(host, port, timeout=15)

    def _get_socket(self, host, port, timeout):
        if not self._relay:
            return super()._get_socket(host, port, timeout)
        relay_host, _, relay_port = self._relay.rpartition(":")
        return socket.create_connection((relay_host, int(relay_port)), timeout)


def _send(to: str, subject: str, body: str) -> None:
    """Sends one plain-text e-mail over SMTP_HOST; raises if it can't."""
    message = EmailMessage()
    message["From"] = os.getenv("MAIL_FROM") or "Matchnight <no-reply@localhost>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    port = int(os.getenv("SMTP_PORT") or "587")
    with _SMTP(os.environ["SMTP_HOST"], port, os.getenv("SMTP_RELAY")) as smtp:
        if port != 25:
            smtp.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USER"):
            smtp.login(os.environ["SMTP_USER"], os.getenv("SMTP_PASSWORD", ""))
        smtp.send_message(message)


def send_login_link(to: str, link: str, lang: str, minutes: int) -> None:
    text = LOGIN_MAIL.get(lang, LOGIN_MAIL["en"])
    if not os.getenv("SMTP_HOST"):
        if os.getenv("MAIL_LOG_LINKS") == "1":
            log.warning("MAIL_LOG_LINKS: sign-in link for %s: %s", to, link)
        return
    try:
        _send(to, text["subject"], text["body"].format(link=link, minutes=minutes))
    except (OSError, smtplib.SMTPException) as exc:
        log.error("could not send the sign-in link to %s: %s", to, exc)


if __name__ == "__main__":
    if len(sys.argv) != 2 or not os.getenv("SMTP_HOST"):
        sys.exit("usage: python mailer.py ADDRESS (with SMTP_HOST and the rest set)")
    try:
        _send(sys.argv[1], "Matchnight test", "This is a test from Matchnight: e-mail works.\n")
    except (OSError, smtplib.SMTPException) as exc:
        sys.exit(f"not sent: {exc!r}")
    print(f"sent to {sys.argv[1]} via {os.environ['SMTP_HOST']}")
