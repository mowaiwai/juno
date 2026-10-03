"""测试用邮件 sender：不触网，记录外发邮件供断言。"""


class RecordingEmailSender:
    sent: list[dict] = []

    def send(self, *, to, subject, text, from_=None):
        RecordingEmailSender.sent.append(
            {"to": to, "subject": subject, "text": text, "from": from_}
        )


def clear_sent():
    RecordingEmailSender.sent.clear()
