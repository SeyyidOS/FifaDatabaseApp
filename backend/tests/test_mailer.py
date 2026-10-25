import socket
import threading

import mailer


def fake_smtp_server() -> tuple[int, list[str]]:
    """A one-message plain SMTP server on localhost: (its port, the lines it received)."""
    listener = socket.create_server(("127.0.0.1", 0))
    received: list[str] = []

    def serve():
        conn, _ = listener.accept()
        with conn, conn.makefile("rb") as lines:
            conn.sendall(b"220 fake\r\n")
            data = False
            for raw in lines:
                line = raw.decode().rstrip("\r\n")
                received.append(line)
                if data:
                    if line == ".":
                        data = False
                        conn.sendall(b"250 queued\r\n")
                elif line.upper().startswith("EHLO"):
                    conn.sendall(b"250 fake\r\n")
                elif line.upper() == "DATA":
                    data = True
                    conn.sendall(b"354 go on\r\n")
                elif line.upper() == "QUIT":
                    conn.sendall(b"221 bye\r\n")
                    break
                else:
                    conn.sendall(b"250 ok\r\n")
        listener.close()

    threading.Thread(target=serve, daemon=True).start()
    return listener.getsockname()[1], received


def test_mail_goes_through_the_relay(monkeypatch):
    port, received = fake_smtp_server()
    # the server's own name doesn't resolve here: only the relay is reachable, as on the live server
    monkeypatch.setenv("SMTP_HOST", "smtp.example.invalid")
    monkeypatch.setenv("SMTP_PORT", "25")
    monkeypatch.setenv("SMTP_RELAY", f"127.0.0.1:{port}")
    monkeypatch.setenv("MAIL_FROM", "")
    mailer._send("ozgun@example.com", "Hello", "A link\n")
    assert "rcpt to:<ozgun@example.com>" in [line.lower() for line in received]
    # an empty MAIL_FROM falls back to the default sender
    assert "From: Matchnight <no-reply@localhost>" in received
    assert "Subject: Hello" in received


def test_send_mail_says_when_it_could_not(monkeypatch):
    port, received = fake_smtp_server()
    monkeypatch.setenv("SMTP_HOST", "smtp.example.invalid")
    monkeypatch.setenv("SMTP_PORT", "25")
    monkeypatch.setenv("SMTP_RELAY", f"127.0.0.1:{port}")
    mailer.send_mail("login", "ozgun@example.com", "tr", link="https://x", minutes=15, code="123456")
    assert "rcpt to:<ozgun@example.com>" in [line.lower() for line in received]

    # nothing listens on the relay's port any more: the mail can't go, and the caller hears of it
    monkeypatch.setenv("SMTP_RELAY", f"127.0.0.1:{_closed_port()}")
    try:
        mailer.send_mail("login", "ozgun@example.com", "tr", link="https://x", minutes=15, code="123456")
    except mailer.MailError:
        pass
    else:
        raise AssertionError("send_mail should raise MailError")
    # after the reply has gone there is nobody to tell: it is only logged
    mailer.send_mail_later("changed", "ozgun@example.com", "tr", email="new@example.com")


def test_without_a_mail_server_development_logs_the_code(monkeypatch, caplog):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.setenv("MAIL_LOG_LINKS", "1")
    mailer.send_login_link("ozgun@example.com", "https://x/#/signin?token=t", "en", 15, "654321")
    assert "MAIL_LOG_LINKS: sign-in code for ozgun@example.com: 654321" in caplog.text


def _closed_port() -> int:
    with socket.create_server(("127.0.0.1", 0)) as s:
        return s.getsockname()[1]
