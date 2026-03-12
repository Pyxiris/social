import base64
import email
import email.policy
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class MailInjectionQueue(models.Model):
    _name = "mail.injection_queue"
    _description = "Mail Injection Queue"

    subject = fields.Char()
    email_from = fields.Char()
    date = fields.Datetime(default=fields.Datetime.now)
    raw_message = fields.Binary("Raw Email Content", attachment=False)

    @api.model
    def decode_raw_message(self, raw_message):
        try:
            raw_message_bytes = base64.b64decode(raw_message)
            message = email.message_from_bytes(
                raw_message_bytes, policy=email.policy.SMTP
            )
            return message
        except Exception as e:
            _logger.error("Failed to decode and parse raw message: %s", e)
            return {}

    @api.model
    def assign_message(self, queue_id, model, res_id):
        queue_item = self.browse(queue_id)
        queue_item.check_access("read")

        target = self.env[model].browse(res_id)
        target.check_access("write")

        if not queue_item.raw_message:
            _logger.warning(
                "Mail Injection Queue item %d has no raw message, skipping.", queue_id
            )
            queue_item.unlink()
            return True

        message = self.decode_raw_message(queue_item.raw_message)

        msg_dict = self.env["mail.thread"].message_parse(message)

        subtype_xmlid = (
            "mail.mt_note" if msg_dict.get("is_internal") else "mail.mt_comment"
        )
        target.message_post(
            body=msg_dict.get("body"),
            subject=msg_dict.get("subject"),
            message_type="email",
            subtype_xmlid=subtype_xmlid,
            parent_id=msg_dict.get("parent_id"),
            email_from=msg_dict.get("from"),
            incoming_email_to=msg_dict.get("to"),
            incoming_email_cc=msg_dict.get("cc"),
            date=msg_dict.get("date"),
            message_id=msg_dict.get("message_id"),
            author_id=msg_dict.get("author_id"),
            attachments=msg_dict.get("attachments"),
        )

        queue_item.unlink()
        return True

    @api.model
    def discard_message(self, queue_id):
        queue_item = self.browse(queue_id)
        queue_item.check_access("unlink")
        queue_item.unlink()
        return True
