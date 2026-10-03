"""邮件外发服务。

默认走标准库 smtplib（同步，在请求/后台任务中调用）；
提供 provider 入口，测试可整体替换为记录 sender。
邮件外发失败由调用方捕获，不阻塞业务。
"""
import smtplib
from email.message import EmailMessage
from typing import Callable, Protocol


class EmailSender(Protocol):
    def send(self, *, to: str, subject: str, text: str, from_: str | None) -> None:
        ...


class SMTPEmailSender:
    def __init__(
        self,
        host: str,
        port: int = 25,
        username: str | None = None,
        password: str | None = None,
        default_from: str | None = None,
        use_tls: bool = False,
    ):
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._default_from = default_from
        self._use_tls = use_tls

    def send(self, *, to, subject, text, from_=None):
        message = EmailMessage()
        sender = from_ or self._default_from
        message["Subject"] = subject
        message["From"] = sender or "juno@localhost"
        message["To"] = to
        message.set_content(text)

        with smtplib.SMTP(self._host, self._port, timeout=20) as smtp:
            if self._use_tls:
                smtp.starttls()
            if self._username:
                smtp.login(self._username, self._password or "")
            smtp.send_message(message)


def _default_provider(*, config: dict) -> EmailSender:
    return SMTPEmailSender(
        host=config["smtp_host"],
        port=int(config.get("smtp_port", 25)),
        username=config.get("smtp_username"),
        password=config.get("smtp_password"),
        default_from=config.get("smtp_from"),
        use_tls=bool(config.get("smtp_use_tls", False)),
    )


_sender_provider: Callable[..., EmailSender] = _default_provider


def get_sender(*, config: dict) -> EmailSender:
    return _sender_provider(config=config)


def set_sender_provider(provider: Callable[..., EmailSender]) -> None:
    global _sender_provider
    _sender_provider = provider
